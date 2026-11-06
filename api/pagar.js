function parseAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) / 100 : NaN;
  if (typeof value !== "string") return NaN;
  const cleaned = value.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!cleaned) return NaN;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : NaN;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const apiKey = process.env.NEXUSPAG_API_KEY;
  if (!apiKey) return res.status(500).json({ erro: "O gateway ainda não está configurado no servidor." });

  try {
    const valor = parseAmount(req.body?.valor);
    const nome = typeof req.body?.nome === "string" ? req.body.nome.trim().slice(0, 100) : "";
    if (!Number.isFinite(valor) || valor < 1) {
      return res.status(400).json({ erro: "O valor mínimo para doar é R$ 1,00." });
    }
    if (valor > 1000000) return res.status(400).json({ erro: "O valor informado é muito alto." });

    const externalId = `thor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      amount: valor,
      description: nome ? `Doação para o Thor - ${nome}` : "Doação para o Thor",
      external_id: externalId,
      expiration: 1800
    };

    const gatewayResponse = await fetch("https://nexuspag.com/api/pix/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(payload)
    });
    const data = await gatewayResponse.json().catch(() => ({}));
    if (!gatewayResponse.ok) {
      console.error("NexusPag create PIX failed", gatewayResponse.status);
      return res.status(502).json({ erro: "O provedor não conseguiu gerar o PIX. Tente novamente." });
    }

    const transaction = data?.transaction || data?.data?.transaction || data?.data || {};
    const pix = transaction.pix_copia_cola || transaction.copy_paste || transaction.pix;
    let qr = transaction.qr_code_base64 || transaction.qr_code || transaction.qr;
    if (typeof qr === "string" && qr.startsWith("data:image/")) qr = qr.split(",")[1];
    if (!pix && !qr) {
      console.error("NexusPag response did not include expected PIX fields");
      return res.status(502).json({ erro: "O provedor não retornou os dados do PIX esperados." });
    }

    // O total arrecadado não é alterado aqui: só deve mudar após confirmação autenticada do pagamento.
    // O banco de dados/webhook é uma etapa de configuração separada, documentada no README.
    return res.status(200).json({
      pix: typeof pix === "string" ? pix : "",
      qr: typeof qr === "string" ? qr : "",
      id: transaction.id || transaction.transaction_id || externalId,
      external_id: externalId,
      status: transaction.status || "pending"
    });
  } catch (error) {
    console.error("PIX creation error", error?.message || error);
    return res.status(500).json({ erro: "Erro interno ao gerar o PIX." });
  }
}
