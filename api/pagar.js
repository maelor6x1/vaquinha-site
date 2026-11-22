import { randomUUID } from "node:crypto";
import { isRateLimited } from "../rate-limit.js";

export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };

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
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/doacoes?pagamento_id=eq.${encodeURIComponent(externalId)}&status=eq.pendente`, {
    method: "PATCH",
    headers: supabaseHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(fields)
  });
  if (!response.ok) {
    throw new Error(`Supabase donation update failed: ${response.status}`);
  }
}

function getTransaction(data) {
  return data?.transaction || data?.data?.transaction || data?.data || {};
}

function getPixDetails(transaction) {
  const pix = transaction.pix_copia_cola || transaction.copy_paste || transaction.pix || "";
  let qr = transaction.qr_code_base64 || transaction.qr_code_image || transaction.qr || "";

  if (typeof qr === "string" && qr.startsWith("data:image/")) {
    qr = qr.split(",")[1] || "";
  }

  return {
    pix: typeof pix === "string" ? pix : "",
    qr: typeof qr === "string" ? qr : ""
  };
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
  let gatewayAttempted = false;

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
    externalId = typeof req.body?.external_id === "string" ? req.body.external_id : `thor_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    if (!/^thor_[a-zA-Z0-9_-]{10,100}$/.test(externalId)) {
      return res.status(400).json({ erro: "Identificador de solicitação inválido." });
    }

    try {
      if (await isRateLimited(req, "pagar", 8, 600)) {
        res.setHeader("Retry-After", "600");
        return res.status(429).json({ erro: "Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de gerar outro PIX." });
      }
    } catch (rateLimitError) {
      console.error("Payment rate limiter unavailable", rateLimitError?.message || rateLimitError);
      return res.status(503).json({ erro: "O serviço está temporariamente indisponível. Tente novamente em instantes." });
    }

    const insert = await fetch(`${process.env.SUPABASE_URL}/rest/v1/doacoes`, {
      method: "POST",
      headers: supabaseHeaders({ Prefer: "resolution=ignore-duplicates,return=minimal" }),
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

    const existingResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/doacoes?pagamento_id=eq.${encodeURIComponent(externalId)}&provedor=eq.nexuspag&select=valor_centavos,status&limit=1`, {
      headers: supabaseHeaders()
    });
    if (!existingResponse.ok) throw new Error(`Supabase idempotency lookup failed: ${existingResponse.status}`);
    const existingRows = await existingResponse.json();
    const existing = existingRows[0];
    if (!existing || Number(existing.valor_centavos) !== amountCents) {
      return res.status(409).json({ erro: "Não foi possível validar a solicitação anterior." });
    }
    if (existing.status === "pago") {
      return res.status(409).json({ erro: "Esta contribuição já foi paga.", external_id: externalId });
    }
    if (existing.status !== "pendente") {
      return res.status(409).json({ erro: "Esta solicitação não está mais disponível. Entre em contato antes de gerar outra.", external_id: externalId });
    }

    let baseUrl = process.env.APP_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
    if (!baseUrl) {
      await updateDonation(externalId, { status: "cancelado" }).catch((error) => {
        console.error("Could not cancel donation without app URL", error?.message || error);
      });
      return res.status(500).json({ erro: "Configure APP_BASE_URL nas variáveis do Vercel." });
    }

    gatewayAttempted = true;
    const gatewayResponse = await fetch("https://nexuspag.com/api/pix/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        amount,
        description: "Doação para a campanha do Thor",
        external_id: externalId,
        webhook_url: `${baseUrl}/api/webhook`,
        expiration: 1800
      }),
      signal: AbortSignal.timeout(15000)
    });

    const data = await gatewayResponse.json().catch(() => ({}));
    if (!gatewayResponse.ok) {
      console.error("NexusPag create PIX returned an error", gatewayResponse.status);
      return res.status(502).json({
        erro: "Não foi possível confirmar a criação do PIX. Evite tentar novamente imediatamente; a confirmação pode chegar pelo sistema de pagamento.",
        resultado_indefinido: true,
        external_id: externalId
      });
    }

    const transaction = getTransaction(data);
    const { pix, qr } = getPixDetails(transaction);

    if (!pix && !qr) {
      console.error("NexusPag response did not include expected PIX fields");
      return res.status(502).json({
        erro: "A NexusPag não retornou os dados do PIX esperados. A solicitação ficará em análise para evitar duplicidade.",
        resultado_indefinido: true,
        external_id: externalId
      });
    }

    return res.status(200).json({
      pix,
      qr,
      id: transaction.id || transaction.transaction_id || externalId,
      external_id: externalId,
      status: transaction.status || "pending",
      expires_at: typeof transaction.expires_at === "string" ? transaction.expires_at : null
    });
  } catch (error) {
    // Depois que a requisição foi enviada ao gateway, o resultado pode ser ambíguo:
    // não cancelar automaticamente, pois a cobrança pode ter sido criada.
    if (externalId && !gatewayAttempted) {
      await updateDonation(externalId, { status: "cancelado" }).catch((updateError) => {
        console.error("Could not cancel donation before gateway request", updateError?.message || updateError);
      });
    }

    console.error("NexusPag PIX creation error", error?.message || error);
    return res.status(502).json({
      erro: gatewayAttempted
        ? "Não foi possível confirmar a resposta do pagamento. Evite tentar novamente imediatamente para não gerar uma cobrança duplicada."
        : "Erro interno ao preparar o PIX.",
      resultado_indefinido: gatewayAttempted,
      ...(gatewayAttempted && externalId ? { external_id: externalId } : {})
    });
  }
}
