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

function verifyNexusSignature(signature, rawBody) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || typeof signature !== "string") return false;
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

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  const received = Buffer.from(receivedHex, "hex");
  return received.length === expected.length && crypto.timingSafeEqual(expected, received);
}

async function findDonation(externalId) {
  const query = `${process.env.SUPABASE_URL}/rest/v1/doacoes?pagamento_id=eq.${encodeURIComponent(externalId)}&select=id,valor_centavos,status`;
  const response = await fetch(query, { headers: supabaseHeaders() });
  if (!response.ok) throw new Error(`Supabase lookup failed: ${response.status}`);
  const rows = await response.json();
  return rows[0] || null;
}

async function markDonationPaid(donation, paidAt) {
  if (!donation || donation.status !== "pendente") return false;
  const query = `${process.env.SUPABASE_URL}/rest/v1/doacoes?id=eq.${donation.id}&status=eq.pendente`;
  const response = await fetch(query, {
    method: "PATCH",
    headers: supabaseHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify({ status: "pago", pago_em: paidAt || new Date().toISOString() })
  });
  if (!response.ok) throw new Error(`Supabase paid update failed: ${response.status}`);
  return true;
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
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ erro: "Corpo JSON inválido." });
  }

  if (!verifyNexusSignature(req.headers["x-webhook-signature"], rawBody)) {
    return res.status(401).json({ erro: "Assinatura NexusPag inválida." });
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
    if (donation.status === "pago") return res.status(200).json({ recebido: true, duplicado: true });
    if (donation.status !== "pendente") return res.status(200).json({ recebido: true, ignorado: true });

    await markDonationPaid(donation, event.paid_at);
    return res.status(200).json({ recebido: true });
  } catch (error) {
    console.error("NexusPag webhook processing failed", error?.message || error);
    return res.status(500).json({ erro: "Falha ao processar confirmação." });
  }
}
