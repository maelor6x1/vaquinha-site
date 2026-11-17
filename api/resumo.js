const MONTHLY_GOAL_CENTS = 100000;
const CAMPAIGN_START = "2026-11-15T00:00:00-03:00";
const TIME_ZONE = "America/Sao_Paulo";
const PAGE_SIZE = 1000;

function supabaseHeaders(extra = {}) {
  const key = process.env.SUPABASE_SECRET_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

function monthParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month) };
}

function monthWindow(now = new Date()) {
  const { year, month } = monthParts(now);
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01T00:00:00-03:00`;
  const nextMonthDate = new Date(Date.UTC(year, month, 2));
  const nextParts = monthParts(nextMonthDate);
  const nextStart = `${nextParts.year}-${String(nextParts.month).padStart(2, "0")}-01T00:00:00-03:00`;
  const start = new Date(CAMPAIGN_START) > new Date(monthStart) ? CAMPAIGN_START : monthStart;
  const label = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    month: "long",
    year: "numeric"
  }).format(now);

  return {
    start,
    nextStart,
    label: label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1)
  };
}

async function fetchAllMonthlyDonations(window) {
  const filters = [
    "status=eq.pago",
    "provedor=eq.nexuspag",
    `pago_em=gte.${encodeURIComponent(window.start)}`,
    `pago_em=lt.${encodeURIComponent(window.nextStart)}`
  ].join("&");

  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = `${process.env.SUPABASE_URL}/rest/v1/doacoes?${filters}&select=nome,mensagem,valor_centavos,pago_em&order=pago_em.desc&limit=${PAGE_SIZE}`;
    const response = await fetch(url, {
      headers: supabaseHeaders({
        "Range-Unit": "items",
        Range: `${offset}-${offset + PAGE_SIZE - 1}`
      })
    });

    if (!response.ok) {
      throw new Error(`Supabase monthly summary failed: ${response.status}`);
    }

    const page = await response.json();
    if (!Array.isArray(page)) throw new Error("Supabase returned an invalid donations list.");

    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ erro: "Método não permitido." });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return res.status(500).json({ erro: "Banco de dados não configurado." });
  }

  try {
    const window = monthWindow();
    const rows = await fetchAllMonthlyDonations(window);
    const paidCents = rows.reduce((sum, row) => sum + Number(row.valor_centavos || 0), 0);

    return res.status(200).json({
      meta_centavos: MONTHLY_GOAL_CENTS,
      arrecadado_centavos: paidCents,
      apoiadores: rows.length,
      mes_referencia: window.label,
      doacoes: rows.map((row) => ({
        nome: row.nome || "Apoiador anônimo",
        mensagem: row.mensagem || "",
        valor_centavos: Number(row.valor_centavos || 0),
        pago_em: row.pago_em
      }))
    });
  } catch (error) {
    console.error("Monthly campaign summary failed", error?.message || error);
    return res.status(500).json({ erro: "Não foi possível carregar o resumo da campanha." });
  }
}
