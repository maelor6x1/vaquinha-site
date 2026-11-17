import { randomUUID } from "node:crypto";

function parseAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) / 100 : NaN;
  if (typeof value !== "string") return NaN;
  let cleaned = value.trim().replaceAll(" ", "");
  if (cleaned.slice(0, 2).toLowerCase() === "r$") cleaned = cleaned.slice(2);
  if (!cleaned) return NaN;
  const normalized = cleaned.includes(",") ? cleaned.split(".").join("").replace(",", ".") : cleaned;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : NaN;
}

function supabaseHeaders(extra = {}) {
  const key = process.env.SUPABASE_SECRET_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

async function updateDonation(externalId, fields) {
  return fetch(`${process.env.SUPABASE_URL}/rest/v1/doacoes?pagamento_id=eq.${encodeURIComponent(externalId)}`, {
    method: "PATCH",
    headers: supabaseHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(fields)
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const apiKey = process.env.NEXUSPAG_API_KEY;
  if (!apiKey) return res.status(500).json({ erro: "A integração com a NexusPag ainda não está configurada no servidor." });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return res.status(500).json({ erro: "O banco de dados ainda não está configurado no servidor." });
  }

  let externalId = "";
  try {
    const amount = parseAmount(req.body?.valor);
    const name = typeof req.body?.nome === "string" ? req.body.nome.trim() : "";
    const message = typeof req.body?.mensagem === "string" ? req.body.mensagem.trim() : "";
    if (name.length > 100) return res.status(400).json({ erro: "O nome deve ter no máximo 100 caracteres." });
    if (message.length > 300) return res.status(400).json({ erro: "A mensagem deve ter no máximo 300 caracteres." });
    if (!Number.isFinite(amount) || amount < 1) {
      return res.status(400).json({ erro: "O valor mínimo para doar é R$ 1,00." });
    }
    if (amount > 1000000) return res.status(400).json({ erro: "O valor informado é muito alto." });

    const amountCents = Math.round(amount * 100);
    externalId = `thor_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const insert = await fetch(`${process.env.SUPABASE_URL}/rest/v1/doacoes`, {
      method: "POST",
      headers: supabaseHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        nome: name || "Apoiador anônimo",
        mensagem: message || null,
        valor_centavos: amountCents,
        status: "pendente",
        provedor: "nexuspag",
        pagamento_id: externalId
      })
    });
    if (!insert.ok) {
      console.error("Supabase donation insert failed", insert.status, await insert.text().catch(() => ""));
      return res.status(502).json({ erro: "Não foi possível registrar sua contribuição. Tente novamente." });
    }

    let baseUrl = process.env.APP_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
    if (!baseUrl) {
      await updateDonation(externalId, { status: "cancelado" }).catch(() => {});
      return res.status(500).json({ erro: "Configure APP_BASE_URL nas variáveis do Vercel." });
    }

    const gatewayResponse = await fetch("https://nexuspag.com/api/pix/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        amount,
        description: "Doação para a campanha do Thor",
        external_id: externalId,
        webhook_url: `${baseUrl}/api/webhook`,
        expiration: 1800
      })
    });
    const data = await gatewayResponse.json().catch(() => ({}));
    if (!gatewayResponse.ok) {
      await updateDonation(externalId, { status: "cancelado" }).catch(() => {});
      console.error("NexusPag create PIX failed", gatewayResponse.status);
      return res.status(502).json({ erro: "A NexusPag não conseguiu gerar o PIX. Tente novamente." });
    }

    const transaction = data?.transaction || data?.data?.transaction || data?.data || {};
    const pix = transaction.pix_copia_cola || transaction.copy_paste || transaction.pix || transaction.qr_code;
    let qr = transaction.qr_code_base64 || transaction.qr_code_image || transaction.qr;
    if (typeof qr === "string" && qr.startsWith("data:image/")) qr = qr.split(",")[1];
    if (!pix && !qr) {
      await updateDonation(externalId, { status: "cancelado" }).catch(() => {});
      console.error("NexusPag response did not include expected PIX fields");
      return res.status(502).json({ erro: "A NexusPag não retornou os dados do PIX esperados." });
    }

    return res.status(200).json({
      pix: typeof pix === "string" ? pix : "",
      qr: typeof qr === "string" ? qr : "",
      id: transaction.id || transaction.transaction_id || externalId,
      external_id: externalId,
      status: transaction.status || "pending"
    });
  } catch (error) {
    if (externalId) await updateDonation(externalId, { status: "cancelado" }).catch(() => {});
    console.error("NexusPag PIX creation error", error?.message || error);
    return res.status(500).json({ erro: "Erro interno ao gerar o PIX." });
  }
}
