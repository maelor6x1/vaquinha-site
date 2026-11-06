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

function signatureIsValid(signature, rawBody) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || typeof signature !== "string") return false;
  const fields = Object.fromEntries(signature.split(",").map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? [part, ""] : [part.slice(0, index), part.slice(index + 1)];
  }));
  const timestamp = Number(fields.t);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${fields.t}.${rawBody}`).digest("hex");
  if (typeof fields.v1 !== "string" || fields.v1.length !== expected.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(fields.v1, "hex"), Buffer.from(expected, "hex")); }
  catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ erro: "Método não permitido." });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY || !process.env.WEBHOOK_SECRET) {
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
  if (!signatureIsValid(req.headers["x-webhook-signature"], rawBody)) {
    return res.status(401).json({ erro: "Assinatura inválida." });
  }

  if (event.event !== "payment.confirmed" || event.status !== "paid") return res.status(200).json({ recebido: true, ignorado: true });
  const externalId = typeof event.external_id === "string" ? event.external_id : "";
  const amount = Number(event.amount);
  if (!externalId || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ erro: "Dados de pagamento inválidos." });

  try {
    const query = `${process.env.SUPABASE_URL}/rest/v1/doacoes?pagamento_id=eq.${encodeURIComponent(externalId)}&select=id,valor_centavos,status`;
    const lookup = await fetch(query, { headers: supabaseHeaders() });
    if (!lookup.ok) throw new Error(`Supabase lookup failed: ${lookup.status}`);
    const rows = await lookup.json();
    if (!rows.length) return res.status(404).json({ erro: "Contribuição não encontrada." });
    const donation = rows[0];
    if (Math.abs(donation.valor_centavos / 100 - amount) > 0.009) {
      console.error("Webhook amount mismatch", externalId);
      return res.status(400).json({ erro: "Valor do pagamento não corresponde à contribuição." });
    }
    if (donation.status === "pago") return res.status(200).json({ recebido: true, duplicado: true });
    if (donation.status !== "pendente") return res.status(200).json({ recebido: true, ignorado: true });

    const patch = await fetch(`${process.env.SUPABASE_URL}/rest/v1/doacoes?id=eq.${donation.id}&status=eq.pendente`, {
      method: "PATCH",
      headers: supabaseHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify({ status: "pago", pago_em: event.paid_at || new Date().toISOString() })
    });
    if (!patch.ok) throw new Error(`Supabase update failed: ${patch.status}`);
    return res.status(200).json({ recebido: true });
  } catch (error) {
    console.error("Webhook processing failed", error?.message || error);
    return res.status(500).json({ erro: "Falha ao processar confirmação." });
  }
}
