function parseAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) / 100 : NaN;
  if (typeof value !== "string") return NaN;
  const cleaned = value.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!cleaned) return NaN;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : NaN;
}

function supabaseHeaders(extra = {}) {
  const key = process.env.SUPABASE_SECRET_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

async function updateDonation(externalId, fields) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/doacoes?pagamento_id=eq.${encodeURIComponent(externalId)}`;
  return fetch(url, { method: "PATCH", headers: supabaseHeaders({ Prefer: "return=minimal" }), body: JSON.stringify(fields) });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const apiKey = process.env.NEXUSPAG_API_KEY;
  if (!apiKey) return res.status(500).json({ erro: "O gateway ainda não está configurado no servidor." });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return res.status(500).json({ erro: "O banco de dados ainda não está configurado no servidor." });
  }

  let externalId = "";
  try {
    const valor = parseAmount(req.body?.valor);
    const nome = typeof req.body?.nome === "string" ? req.body.nome.trim().slice(0, 100) : "";
    if (!Number.isFinite(valor) || valor < 1) return res.status(400).json({ erro: "O valor mínimo para doar é R$ 1,00." });
    if (valor > 1000000) return res.status(400).json({ erro: "O valor informado é muito alto." });

    externalId = `thor_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const insertResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/doacoes`, {
      method: "POST",
      headers: supabaseHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({ nome: nome || null, valor_centavos: Math.round(valor * 100), status: "pendente", provedor: "nexuspag", pagamento_id: externalId })
    });
    if (!insertResponse.ok) {
      console.error("Supabase insert failed", insertResponse.status, await insertResponse.text().catch(() => ""));
      return res.status(502).json({ erro: "Não foi possível registrar a contribuição. Tente novamente." });
    }

    const baseUrl = (process.env.APP_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")).replace(/\/$/, "");
    if (!baseUrl) {
      await updateDonation(externalId, { status: "cancelado" }).catch(() => {});
      return res.status(500).json({ erro: "Configure APP_BASE_URL nas variáveis do Vercel." });
    }

    const gatewayResponse = await fetch("https://nexuspag.com/api/pix/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        amount: valor,
        description: nome ? `Doação para o Thor - ${nome}` : "Doação para o Thor",
        external_id: externalId,
        webhook_url: `${baseUrl}/api/webhook`,
        expiration: 1800
      })
    });
    const data = await gatewayResponse.json().catch(() => ({}));
    if (!gatewayResponse.ok) {
      await updateDonation(externalId, { status: "cancelado" }).catch(() => {});
      console.error("NexusPag create PIX failed", gatewayResponse.status);
      return res.status(502).json({ erro: "O provedor não conseguiu gerar o PIX. Tente novamente." });
    }

    const transaction = data?.transaction || data?.data?.transaction || data?.data || {};
    const pix = transaction.pix_copia_cola || transaction.copy_paste || transaction.pix || transaction.qr_code;
    let qr = transaction.qr_code_base64 || transaction.qr_code_image || transaction.qr;
    if (typeof qr === "string" && qr.startsWith("data:image/")) qr = qr.split(",")[1];
    if (!pix && !qr) {
      await updateDonation(externalId, { status: "cancelado" }).catch(() => {});
      console.error("NexusPag response did not include expected PIX fields");
      return res.status(502).json({ erro: "O provedor não retornou os dados do PIX esperados." });
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
    console.error("PIX creation error", error?.message || error);
    return res.status(500).json({ erro: "Erro interno ao gerar o PIX." });
  }
}
