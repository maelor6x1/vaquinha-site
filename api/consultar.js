function supabaseHeaders(extra = {}) {
  const key = process.env.SUPABASE_SECRET_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

function normalizePaidAt(value) {
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) {
    return new Date(Date.parse(value)).toISOString();
  }
  return new Date().toISOString();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const apiKey = process.env.NEXUSPAG_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  if (!apiKey || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ erro: "Consulta de pagamento não configurada." });
  }

  const externalId = typeof req.body?.external_id === "string" ? req.body.external_id : "";
  if (!/^thor_[a-zA-Z0-9_-]{10,100}$/.test(externalId)) {
    return res.status(400).json({ erro: "Identificador de pagamento inválido." });
  }

  try {
    const lookupUrl = `${supabaseUrl}/rest/v1/doacoes?pagamento_id=eq.${encodeURIComponent(externalId)}&provedor=eq.nexuspag&select=id,valor_centavos,status&limit=1`;
    const lookup = await fetch(lookupUrl, { headers: supabaseHeaders() });
    if (!lookup.ok) throw new Error(`Supabase lookup failed: ${lookup.status}`);
    const rows = await lookup.json();
    const donation = rows[0];
    if (!donation) return res.status(200).json({ status: "not_found", confirmado: false });

    if (donation.status === "pago") {
      return res.status(200).json({ status: "paid", confirmado: true });
    }
    if (donation.status !== "pendente") {
      return res.status(200).json({ status: donation.status, confirmado: false });
    }

    const gateway = await fetch(`https://nexuspag.com/api/pix/${encodeURIComponent(externalId)}`, {
      method: "GET",
      headers: { "x-api-key": apiKey }
    });
    if (gateway.status === 404) {
      return res.status(200).json({ status: "not_found", confirmado: false });
    }
    if (!gateway.ok) {
      console.error("NexusPag PIX lookup failed", gateway.status);
      return res.status(502).json({ erro: "Não foi possível consultar o pagamento agora." });
    }

    const payload = await gateway.json();
    const transaction = payload?.transaction || payload?.data?.transaction || payload?.data || payload;
    const status = String(transaction?.status || "").toLowerCase();
    const amount = Number(transaction?.amount);
    if (!Number.isFinite(amount) || Math.abs(Number(donation.valor_centavos) / 100 - amount) > 0.009) {
      console.error("NexusPag lookup amount mismatch", externalId);
      return res.status(409).json({ erro: "O valor consultado não corresponde à contribuição." });
    }

    if (status === "paid") {
      const paidAt = normalizePaidAt(transaction.paid_at);
      const updateUrl = `${supabaseUrl}/rest/v1/doacoes?id=eq.${encodeURIComponent(donation.id)}&status=eq.pendente&select=id,status`;
      const update = await fetch(updateUrl, {
        method: "PATCH",
        headers: supabaseHeaders({ Prefer: "return=representation" }),
        body: JSON.stringify({ status: "pago", pago_em: paidAt })
      });
      if (!update.ok) throw new Error(`Supabase paid update failed: ${update.status}`);
      const changed = await update.json();
      if (!Array.isArray(changed) || !changed.some((row) => row.id === donation.id && row.status === "pago")) {
        const verify = await fetch(`${supabaseUrl}/rest/v1/doacoes?id=eq.${encodeURIComponent(donation.id)}&select=status&limit=1`, { headers: supabaseHeaders() });
        if (!verify.ok) throw new Error(`Supabase verification failed: ${verify.status}`);
        const current = (await verify.json())[0];
        if (current?.status !== "pago") throw new Error("Donation was not marked as paid.");
      }
      return res.status(200).json({ status: "paid", confirmado: true });
    }

    if (status === "expired" || status === "cancelled") {
      const cancelUrl = `${supabaseUrl}/rest/v1/doacoes?id=eq.${encodeURIComponent(donation.id)}&status=eq.pendente&select=id,status`;
      const cancel = await fetch(cancelUrl, {
        method: "PATCH",
        headers: supabaseHeaders({ Prefer: "return=representation" }),
        body: JSON.stringify({ status: "cancelado" })
      });
      if (!cancel.ok) throw new Error(`Supabase cancellation update failed: ${cancel.status}`);
      const cancelledRows = await cancel.json();
      if (!Array.isArray(cancelledRows) || cancelledRows.length === 0) {
        const verify = await fetch(`${supabaseUrl}/rest/v1/doacoes?id=eq.${encodeURIComponent(donation.id)}&select=status&limit=1`, { headers: supabaseHeaders() });
        if (!verify.ok) throw new Error(`Supabase cancellation verification failed: ${verify.status}`);
        const current = (await verify.json())[0];
        if (current?.status === "pago") return res.status(200).json({ status: "paid", confirmado: true });
      }
      return res.status(200).json({ status: "cancelado", confirmado: false });
    }

    return res.status(200).json({
      status: ["pending", "expired", "cancelled"].includes(status) ? status : "unknown",
      confirmado: false,
      amount: Number(donation.valor_centavos) / 100,
      pix: typeof transaction.pix_copia_cola === "string" ? transaction.pix_copia_cola : "",
      qr: typeof transaction.qr_code_base64 === "string" ? transaction.qr_code_base64 : ""
    });
  } catch (error) {
    console.error("NexusPag payment lookup failed", error?.message || error);
    return res.status(500).json({ erro: "Não foi possível verificar o pagamento." });
  }
}
