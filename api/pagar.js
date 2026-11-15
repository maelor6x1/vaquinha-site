import { randomUUID } from "node:crypto";
import QRCode from "qrcode";

function parseAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) / 100 : NaN;
  if (typeof value !== "string") return NaN;
  const cleaned = value.trim().replace(/\\s/g, "").replace(/^R\\$/i, "");
  if (!cleaned) return NaN;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\\./g, "").replace(",", ".") : cleaned;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : NaN;
}

function supabaseHeaders(extra = {}) {
  const key = process.env.SUPABASE_SECRET_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

async function updateDonation(reference, fields) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/doacoes?pagamento_id=eq.${encodeURIComponent(reference)}`;
  return fetch(url, {
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

  const apiKey = process.env.PIXBLACK_API_KEY;
  const defaultDocument = String(process.env.PIXBLACK_DEFAULT_PAYER_DOCUMENT || "").replace(/\\D/g, "");
  if (!apiKey) return res.status(500).json({ erro: "A chave da Pix Black ainda não está configurada no servidor." });
  if (![11, 14].includes(defaultDocument.length)) {
    return res.status(500).json({ erro: "Configure o CPF/CNPJ padrão autorizado pela Pix Black nas variáveis do servidor." });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return res.status(500).json({ erro: "O banco de dados ainda não está configurado no servidor." });
  }

  let externalReference = "";
  try {
    const amount = parseAmount(req.body?.valor);
    const name = typeof req.body?.nome === "string" ? req.body.nome.trim().slice(0, 100) : "";
    if (!Number.isFinite(amount) || amount < 5) {
      return res.status(400).json({ erro: "O valor mínimo para doar é R$ 5,00." });
    }
    if (amount > 1000000) return res.status(400).json({ erro: "O valor máximo permitido é R$ 1.000.000,00." });

    const amountCents = Math.round(amount * 100);
    externalReference = `thor_${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

    const insertResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/doacoes`, {
      method: "POST",
      headers: supabaseHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        nome: name || null,
        valor_centavos: amountCents,
        status: "pendente",
        provedor: "pixblack",
        pagamento_id: externalReference
      })
    });

    if (!insertResponse.ok) {
      console.error("Supabase insert failed", insertResponse.status, await insertResponse.text().catch(() => ""));
      return res.status(502).json({ erro: "Não foi possível registrar a contribuição. Tente novamente." });
    }

    const payload = {
      amount_cents: amountCents,
      description: name ? `Doação para o Thor - ${name}` : "Doação para o Thor",
      external_reference: externalReference,
      payer: { document: defaultDocument }
    };
    if (name) payload.payer.name = name;

    const gatewayResponse = await fetch("https://pixxblack.com/api/v1/charges", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": externalReference
      },
      body: JSON.stringify(payload)
    });
    const data = await gatewayResponse.json().catch(() => ({}));

    if (!gatewayResponse.ok) {
      await updateDonation(externalReference, { status: "cancelado" }).catch(() => {});
      console.error("Pix Black create charge failed", gatewayResponse.status, data?.message || "");
      return res.status(502).json({ erro: "A Pix Black não conseguiu gerar o PIX. Tente novamente." });
    }

    const chargeId = typeof data?.id === "string" ? data.id : "";
    const copyPaste = typeof data?.pix?.copy_paste === "string" ? data.pix.copy_paste : "";
    if (!chargeId || !copyPaste || Number(data.amount_cents) !== amountCents || data.status !== "pending") {
      await updateDonation(externalReference, { status: "cancelado" }).catch(() => {});
      console.error("Pix Black returned an unexpected charge response");
      return res.status(502).json({ erro: "A Pix Black retornou dados de cobrança incompletos." });
    }

    const qr = await QRCode.toDataURL(copyPaste, { errorCorrectionLevel: "M", margin: 2, width: 320 });
    return res.status(200).json({
      pix: copyPaste,
      qr,
      id: chargeId,
      external_reference: externalReference,
      status: data.status,
      expires_at: data.pix.expires_at || null
    });
  } catch (error) {
    if (externalReference) await updateDonation(externalReference, { status: "cancelado" }).catch(() => {});
    console.error("PIX creation error", error?.message || error);
    return res.status(500).json({ erro: "Erro interno ao gerar o PIX." });
  }
}
