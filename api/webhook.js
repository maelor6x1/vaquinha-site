import crypto from "node:crypto";

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function supabaseHeaders(extra = {}) {
  const key = process.env.SUPABASE_SECRET_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

function signatureIsValid(signature, rawBody) {
  const secret = process.env.PIXBLACK_WEBHOOK_SECRET;
  if (!secret || typeof signature !== "string") return false;
  const fields = Object.fromEntries(signature.split(",").map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? [part.trim(), ""] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }));
  const timestamp = Number(fields.t);
  const signatureHex = fields.v1 || "";
  if (!Number.isInteger(timestamp) || !/^[0-9a-f]{64}$/i.test(signatureHex)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;

  const expected = crypto.createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest();
  const received = Buffer.from(signatureHex, "hex");
  return received.length === expected.length && crypto.timingSafeEqual(expected, received);
}

async function findDonation(chargeId, externalReference) {
  const base = `${process.env.SUPABASE_URL}/rest/v1/doacoes?provedor=eq.pixblack&select=id,valor_centavos,status,pagamento_id`;
  const byCharge = await fetch(`${base}&pagamento_id=eq.${encodeURIComponent(chargeId)}`, { headers: supabaseHeaders() });
  if (!byCharge.ok) throw new Error(`Supabase lookup by charge id failed: ${byCharge.status}`);
  const chargeRows = await byCharge.json();
  if (chargeRows.length) return chargeRows[0];

  // Recuperação caso o PIX tenha sido criado, mas o PATCH do charge_id tenha falhado.
  if (externalReference) {
    const byReference = await fetch(`${base}&pagamento_id=eq.${encodeURIComponent(externalReference)}`, { headers: supabaseHeaders() });
    if (!byReference.ok) throw new Error(`Supabase lookup by external reference failed: ${byReference.status}`);
    const referenceRows = await byReference.json();
    if (referenceRows.length) return referenceRows[0];
  }
  return null;
}

async function getCharge(chargeId) {
  const response = await fetch(`https://pixxblack.com/api/v1/charges/${encodeURIComponent(chargeId)}`, {
    headers: { Authorization: `Bearer ${process.env.PIXBLACK_API_KEY}` }
  });
  if (!response.ok) throw new Error(`Pix Black charge verification failed: ${response.status}`);
  return response.json();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ erro: "Método não permitido." });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY || !process.env.PIXBLACK_API_KEY || !process.env.PIXBLACK_WEBHOOK_SECRET) {
    return res.status(500).json({ erro: "Webhook não configurado." });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch {
    return res.status(400).json({ erro: "Não foi possível ler o corpo da notificação." });
  }
  if (!signatureIsValid(req.headers["x-pixblack-signature"], rawBody)) {
    return res.status(401).json({ erro: "Assinatura inválida." });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ erro: "Corpo JSON inválido." });
  }

  if (event?.type === "ping") return res.status(200).json({ recebido: true });
  if (!["charge.paid", "charge.expired"].includes(event?.type)) {
    return res.status(200).json({ recebido: true, ignorado: true });
  }

  const chargeId = typeof event?.data?.charge_id === "string" ? event.data.charge_id : "";
  const externalReference = typeof event?.data?.external_reference === "string" ? event.data.external_reference : "";
  const eventAmount = Number(event?.data?.amount_cents);
  if (!chargeId || !Number.isInteger(eventAmount) || eventAmount <= 0) {
    return res.status(400).json({ erro: "Dados da cobrança inválidos." });
  }

  try {
    const donation = await findDonation(chargeId, externalReference);
    if (!donation) return res.status(404).json({ erro: "Contribuição não encontrada." });
    if (Number(donation.valor_centavos) !== eventAmount) {
      console.error("Pix Black webhook amount mismatch", chargeId);
      return res.status(400).json({ erro: "Valor do pagamento não corresponde à contribuição." });
    }
    if (donation.status === "pago") return res.status(200).json({ recebido: true, duplicado: true });
    if (donation.status !== "pendente") return res.status(200).json({ recebido: true, ignorado: true });

    if (event.type === "charge.paid") {
      // Não confiamos apenas no webhook: consultamos a cobrança na API antes de creditar.
      const charge = await getCharge(chargeId);
      if (charge?.id !== chargeId || charge?.status !== "paid" || Number(charge?.amount_cents) !== Number(donation.valor_centavos)) {
        return res.status(400).json({ erro: "A cobrança não foi confirmada pela API da Pix Black." });
      }
      if (externalReference && charge.external_reference !== externalReference) {
        return res.status(400).json({ erro: "Referência externa não corresponde à cobrança." });
      }
      const patch = await fetch(`${process.env.SUPABASE_URL}/rest/v1/doacoes?id=eq.${donation.id}&status=eq.pendente&provedor=eq.pixblack`, {
        method: "PATCH",
        headers: supabaseHeaders({ Prefer: "return=minimal" }),
        body: JSON.stringify({ status: "pago", pago_em: charge.paid_at || event.data.paid_at || new Date().toISOString(), pagamento_id: chargeId })
      });
      if (!patch.ok) throw new Error(`Supabase paid update failed: ${patch.status}`);
      return res.status(200).json({ recebido: true });
    }

    const patch = await fetch(`${process.env.SUPABASE_URL}/rest/v1/doacoes?id=eq.${donation.id}&status=eq.pendente&provedor=eq.pixblack`, {
      method: "PATCH",
      headers: supabaseHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({ status: "cancelado" })
    });
    if (!patch.ok) throw new Error(`Supabase expired update failed: ${patch.status}`);
    return res.status(200).json({ recebido: true });
  } catch (error) {
    console.error("Pix Black webhook processing failed", error?.message || error);
    return res.status(500).json({ erro: "Falha ao processar confirmação." });
  }
}
