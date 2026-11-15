import crypto from "node:crypto";

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function supabaseHeaders(extra = {}) {
  const key = process.env.SUPABASE_SECRET_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

function verifySignature(signature, rawBody, secret) {
  if (!secret || typeof signature !== "string") return false;
  const fields = Object.fromEntries(signature.split(",").map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? [part, ""] : [part.slice(0, index), part.slice(index + 1)];
  }));
  const timestamp = Number(fields.t);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${fields.t}.${rawBody}`).digest("hex");
  if (typeof fields.v1 !== "string" || !/^[a-f0-9]+$/i.test(fields.v1) || fields.v1.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(fields.v1, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

async function findDonation(reference) {
  const query = `${process.env.SUPABASE_URL}/rest/v1/doacoes?pagamento_id=eq.${encodeURIComponent(reference)}&select=id,valor_centavos,status`;
  const response = await fetch(query, { headers: supabaseHeaders() });
  if (!response.ok) throw new Error(`Supabase lookup failed: ${response.status}`);
  const rows = await response.json();
  return rows[0] || null;
}

async function setDonationStatus(donation, status, paidAt) {
  if (!donation || donation.status !== "pendente") return false;
  const query = `${process.env.SUPABASE_URL}/rest/v1/doacoes?id=eq.${donation.id}&status=eq.pendente`;
  const fields = status === "pago"
    ? { status: "pago", pago_em: paidAt || new Date().toISOString() }
    : { status: "cancelado" };
  const response = await fetch(query, {
    method: "PATCH",
    headers: supabaseHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(fields)
  });
  if (!response.ok) throw new Error(`Supabase update failed: ${response.status}`);
  return true;
}

async function handlePixBlack(event) {
  const data = event?.data || {};
  const eventType = event?.type || event?.event;
  const externalReference = typeof data.external_reference === "string" ? data.external_reference : "";
  if (!externalReference) return { status: 400, body: { erro: "Referência da cobrança ausente." } };

  const donation = await findDonation(externalReference);
  if (!donation) return { status: 404, body: { erro: "Contribuição não encontrada." } };
  if (donation.status === "pago" || donation.status === "cancelado") {
    return { status: 200, body: { recebido: true, duplicado: true } };
  }

  if (eventType === "charge.expired") {
    await setDonationStatus(donation, "cancelado");
    return { status: 200, body: { recebido: true } };
  }
  if (eventType !== "charge.paid") return { status: 200, body: { recebido: true, ignorado: true } };

  const chargeId = typeof data.charge_id === "string" ? data.charge_id : "";
  if (!chargeId) return { status: 400, body: { erro: "Identificador da cobrança ausente." } };

  const apiKey = process.env.PIXBLACK_API_KEY;
  if (!apiKey) throw new Error("PIXBLACK_API_KEY is not configured");
  const verifyResponse = await fetch(`https://pixxblack.com/api/v1/charges/${encodeURIComponent(chargeId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const verified = await verifyResponse.json().catch(() => ({}));
  if (!verifyResponse.ok) throw new Error(`Pix Black charge verification failed: ${verifyResponse.status}`);

  const charge = verified?.data || verified?.charge || verified;
  if (charge.status !== "paid" || Number(charge.amount_cents) !== donation.valor_centavos) {
    return { status: 400, body: { erro: "A cobrança não está paga ou o valor não corresponde." } };
  }
  if (charge.external_reference && charge.external_reference !== externalReference) {
    return { status: 400, body: { erro: "A referência da cobrança não corresponde." } };
  }

  await setDonationStatus(donation, "pago", charge.paid_at || data.paid_at);
  return { status: 200, body: { recebido: true } };
}

async function handleNexusPag(event) {
  if (event.event !== "payment.confirmed" || event.status !== "paid") {
    return { status: 200, body: { recebido: true, ignorado: true } };
  }
  const externalId = typeof event.external_id === "string" ? event.external_id : "";
  const amount = Number(event.amount);
  if (!externalId || !Number.isFinite(amount) || amount <= 0) {
    return { status: 400, body: { erro: "Dados de pagamento inválidos." } };
  }
  const donation = await findDonation(externalId);
  if (!donation) return { status: 404, body: { erro: "Contribuição não encontrada." } };
  if (Math.abs(donation.valor_centavos / 100 - amount) > 0.009) {
    console.error("NexusPag webhook amount mismatch", externalId);
    return { status: 400, body: { erro: "Valor do pagamento não corresponde à contribuição." } };
  }
  if (donation.status === "pago") return { status: 200, body: { recebido: true, duplicado: true } };
  if (donation.status !== "pendente") return { status: 200, body: { recebido: true, ignorado: true } };
  await setDonationStatus(donation, "pago", event.paid_at);
  return { status: 200, body: { recebido: true } };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ erro: "Método não permitido." });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return res.status(500).json({ erro: "Webhook não configurado." });
  }

  let rawBody;
  let event;
  try {
    rawBody = await readRawBody(req);
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ erro: "Corpo JSON inválido." });
  }

  try {
    let result;
    const pixBlackSignature = req.headers["x-pixblack-signature"];
    if (pixBlackSignature) {
      if (!verifySignature(pixBlackSignature, rawBody, process.env.PIXBLACK_WEBHOOK_SECRET)) {
        return res.status(401).json({ erro: "Assinatura Pix Black inválida." });
      }
      result = await handlePixBlack(event);
    } else {
      if (!verifySignature(req.headers["x-webhook-signature"], rawBody, process.env.WEBHOOK_SECRET)) {
        return res.status(401).json({ erro: "Assinatura NexusPag inválida." });
      }
      result = await handleNexusPag(event);
    }
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Webhook processing failed", error?.message || error);
    return res.status(500).json({ erro: "Falha ao processar confirmação." });
  }
}
