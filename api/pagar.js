import QRCode from "qrcode";

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

async function updateDonation(reference, fields) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/doacoes?pagamento_id=eq.${encodeURIComponent(reference)}`;
  return fetch(url, {
    method: "PATCH",
    headers: supabaseHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(fields)
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createCharge(apiKey, idempotencyKey, payload) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch("https://pixxblack.com/api/v1/charges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if ((response.status === 429 || response.status === 503) && attempt < 2) {
        await wait(attempt === 0 ? 1000 : 2000);
        continue;
      }
      return { response, data };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await wait(attempt === 0 ? 1000 : 2000);
    }
  }
  throw lastError || new Error("Não foi possível conectar à Pix Black.");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const apiKey = process.env.PIXBLACK_API_KEY;
  if (!apiKey) return res.status(500).json({ erro: "A chave da Pix Black ainda não está configurada no servidor." });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return res.status(500).json({ erro: "O banco de dados ainda não está configurado no servidor." });
  }

  let localReference = "";
  try {
    const amount = parseAmount(req.body?.valor);
    const name = typeof req.body?.nome === "string" ? req.body.nome.trim().slice(0, 100) : "";
    if (!Number.isFinite(amount) || amount < 5) {
      return res.status(400).json({ erro: "O valor mínimo para doar é R$ 5,00." });
    }
    if (amount > 1000000) return res.status(400).json({ erro: "O valor máximo permitido é R$ 1.000.000,00." });

    localReference = `thor_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    const amountCents = Math.round(amount * 100);

    // Registra a intenção antes de chamar o gateway. Se houver falha depois,
    // o registro fica cancelado e não entra no total arrecadado.
    const insertResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/doacoes`, {
      method: "POST",
      headers: supabaseHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        nome: name || null,
        valor_centavos: amountCents,
        status: "pendente",
        provedor: "pixblack",
        pagamento_id: localReference
      })
    });
    if (!insertResponse.ok) {
      console.error("Supabase insert failed", insertResponse.status, await insertResponse.text().catch(() => ""));
      return res.status(502).json({ erro: "Não foi possível registrar a contribuição. Tente novamente." });
    }

    const payload = {
      amount_cents: amountCents,
      description: "Doação para o Thor",
      external_reference: localReference
    };
    if (name) payload.payer = { name };

    const { response: gatewayResponse, data } = await createCharge(apiKey, localReference, payload);
    if (!gatewayResponse.ok) {
      await updateDonation(localReference, { status: "cancelado" }).catch(() => {});
      console.error("Pix Black create charge failed", gatewayResponse.status, data?.message || "");
      if (gatewayResponse.status === 400 && Array.isArray(data?.issues)) {
        const minimumIssue = data.issues.find((issue) => issue.path === "amount_cents");
        if (minimumIssue) return res.status(400).json({ erro: "A Pix Black recusou esse valor. Confira o mínimo permitido para sua conta." });
      }
      return res.status(502).json({ erro: "A Pix Black não conseguiu gerar o PIX agora. Tente novamente." });
    }

    const chargeId = typeof data?.id === "string" ? data.id : "";
    const copyPaste = typeof data?.pix?.copy_paste === "string" ? data.pix.copy_paste : "";
    if (!chargeId || !copyPaste || Number(data.amount_cents) !== amountCents || data.status !== "pending") {
      await updateDonation(localReference, { status: "cancelado" }).catch(() => {});
      console.error("Pix Black returned an unexpected charge response");
      return res.status(502).json({ erro: "A Pix Black retornou dados de cobrança incompletos." });
    }

    // O ID definitivo é o charge_id recebido nos webhooks. Se este PATCH falhar,
    // o webhook ainda poderá localizar a linha pela external_reference local.
    const linkResponse = await updateDonation(localReference, { pagamento_id: chargeId });
    if (!linkResponse.ok) {
      console.error("Could not replace local reference with Pix Black charge id", linkResponse.status);
    }

    const qrDataUrl = await QRCode.toDataURL(copyPaste, { errorCorrectionLevel: "M", margin: 2, width: 320 });
    return res.status(200).json({
      pix: copyPaste,
      qr: qrDataUrl,
      id: chargeId,
      external_reference: localReference,
      status: data.status,
      expires_at: data.pix.expires_at || null
    });
  } catch (error) {
    if (localReference) await updateDonation(localReference, { status: "cancelado" }).catch(() => {});
    console.error("PIX creation error", error?.message || error);
    return res.status(500).json({ erro: "Erro interno ao gerar o PIX." });
  }
}
