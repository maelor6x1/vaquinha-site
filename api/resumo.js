const INITIAL_RAISED_CENTS = 46751;
const INITIAL_SUPPORTERS = 137;

function supabaseHeaders() {
  const key = process.env.SUPABASE_SECRET_KEY;
  return { apikey: key, Authorization: `Bearer ${key}` };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ erro: "Método não permitido." });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return res.status(500).json({ erro: "Banco de dados não configurado." });
  }
  try {
    const url = `${process.env.SUPABASE_URL}/rest/v1/doacoes?status=eq.pago&select=nome,valor_centavos,pago_em&order=pago_em.desc&limit=20`;
    const response = await fetch(url, { headers: supabaseHeaders() });
    if (!response.ok) throw new Error(`Supabase read failed: ${response.status}`);
    const rows = await response.json();
    const allResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/doacoes?status=eq.pago&select=valor_centavos`, { headers: supabaseHeaders() });
    if (!allResponse.ok) throw new Error(`Supabase totals failed: ${allResponse.status}`);
    const allRows = await allResponse.json();
    const paidCents = allRows.reduce((sum, row) => sum + Number(row.valor_centavos || 0), 0);
    return res.status(200).json({
      arrecadado_centavos: INITIAL_RAISED_CENTS + paidCents,
      apoiadores: INITIAL_SUPPORTERS + allRows.length,
      doacoes: rows.map((row) => ({ nome: row.nome || "Apoiador anônimo", valor_centavos: row.valor_centavos, pago_em: row.pago_em }))
    });
  } catch (error) {
    console.error("Campaign summary failed", error?.message || error);
    return res.status(500).json({ erro: "Não foi possível carregar o resumo da campanha." });
  }
}
