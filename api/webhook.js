import crypto from "node:crypto";

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > 64 * 1024) {
      const error = new Error("Webhook body too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function supabaseHeaders(extra = {}) {
  const key = process.env.SUPABASE_SECRET_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

function verifyNexusSignature(signature, rawBody) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || typeof signature !== "string" || !Buffer.isBuffer(rawBody)) return false;

  const fields = Object.fromEntries(signature.split(",").map((part) => {
    const index = part.indexOf("=");
    return index < 0
      ? [part.trim(), ""]
      : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }));

  const timestamp = Number(fields.t);
  const receivedHex = fields.v1 || "";
  if (!Number.isInteger(timestamp) || !/^[a-f0-9]{64}$/i.test(receivedHex)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest();
  const received = Buffer.from(receivedHex, "hex");

  return received.length === expected.length && crypto.timingSafeEqual(expected, received);
}

async function findDonation(externalId) {
  const query = `${process.env.SUPABASE_URL}/rest/v1/doacoes?pagamento_id=eq.${encodeURIComponent(externalId)}&provedor=eq.nexuspag&select=id,valor_centavos,status`;
  const response = await fetch(query, { headers: supabaseHeaders() });
  if (!response.ok) throw new Error(`Supabase lookup failed: ${response.status}`);
  const rows = await response.json();
  return rows[0] || null;
}

async function markDonationPaid(donation, paidAt) {
  if (!donation) return "missing";
  if (donation.status === "pago") return "already_paid";
  // A confirmação real do provedor deve prevalecer sobre um cancelamento
  // local anterior: webhooks podem chegar atrasados ou ser reenviados.
  if (donation.status !== "pendente" && donation.status !== "cancelado") return "not_pending";

  const query = `${process.env.SUPABASE_URL}/rest/v1/doacoes?id=eq.${encodeURIComponent(donation.id)}&status=in.(pendente,cancelado)&select=id,status`;
  const response = await fetch(query, {
    method: "PATCH",
    headers: supabaseHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify({ status: "pago", pago_em: paidAt })
  });

  if (!response.ok) throw new Error(`Supabase paid update failed: ${response.status}`);

  const updatedRows = await response.json();
  if (Array.isArray(updatedRows) && updatedRows.some((row) => row.id === donation.id && row.status === "pago")) {
    return "updated";
  }

  // Outra chamada pode ter confirmado a mesma doação entre a consulta e o PATCH.
  const current = await findDonationById(donation.id);
  if (current?.status === "pago") return "already_paid";
  throw new Error("Donation was not updated to paid.");
}

async function findDonationById(id) {
  const query = `${process.env.SUPABASE_URL}/rest/v1/doacoes?id=eq.${encodeURIComponent(id)}&select=id,status&limit=1`;
  const response = await fetch(query, { headers: supabaseHeaders() });
  if (!response.ok) throw new Error(`Supabase status verification failed: ${response.status}`);
  const rows = await response.json();
  return rows[0] || null;
}

function normalizePaidAt(value) {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ erro: "Método não permitido." });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY || !process.env.WEBHOOK_SECRET) {
    return res.status(500).json({ erro: "Webhook NexusPag não configurado." });
  }

  let rawBody;
  let event;
  try {
    rawBody = await readRawBody(req);
    event = JSON.parse(rawBody.toString("utf8"));
  } catch (bodyError) {
    if (bodyError?.statusCode === 413) {
      return res.status(413).json({ erro: "Corpo do webhook excede o limite permitido." });
    }
    return res.status(400).json({ erro: "Corpo JSON inválido." });
  }

  if (!verifyNexusSignature(req.headers["x-webhook-signature"], rawBody)) {
    return res.status(401).json({ erro: "Assinatura NexusPag inválida." });
  }

  // A NexusPag documenta esse header como obrigatório. Conferimos o header
  // com o corpo para impedir que um evento de outro tipo siga pelo fluxo de PIX.
  const headerEvent = req.headers["x-webhook-event"];
  if (typeof headerEvent !== "string" || headerEvent !== event.event) {
    return res.status(400).json({ erro: "Tipo de evento NexusPag inválido." });
  }

  if (event.event !== "payment.confirmed" || event.status !== "paid") {
    return res.status(200).json({ recebido: true, ignorado: true });
  }

  const externalId = typeof event.external_id === "string" ? event.external_id : "";
  const amount = Number(event.amount);
  if (!externalId || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ erro: "Dados de pagamento inválidos." });
  }

  try {
    const donation = await findDonation(externalId);
    if (!donation) return res.status(404).json({ erro: "Contribuição não encontrada." });

    if (Math.abs(Number(donation.valor_centavos) / 100 - amount) > 0.009) {
      console.error("NexusPag webhook amount mismatch", externalId);
      return res.status(400).json({ erro: "Valor do pagamento não corresponde à contribuição." });
    }

    const result = await markDonationPaid(donation, normalizePaidAt(event.paid_at));
    if (result === "not_pending") {
      return res.status(200).json({ recebido: true, ignorado: true });
    }

    return res.status(200).json({
      recebido: true,
      ...(result === "already_paid" ? { duplicado: true } : {})
    });
  } catch (error) {
    console.error("NexusPag webhook processing failed", error?.message || error);
    return res.status(500).json({ erro: "Falha ao processar confirmação." });
  }
}
