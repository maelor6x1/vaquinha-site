import { createHmac } from "node:crypto";

export async function isRateLimited(req, scope, limit, windowSeconds) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  const hashSecret = process.env.WEBHOOK_SECRET;

  if (!supabaseUrl || !supabaseKey || !hashSecret) {
    throw new Error("Rate limiter configuration is incomplete.");
  }

  const forwarded = req.headers?.["x-forwarded-for"];
  const realIp = req.headers?.["x-real-ip"];
  const ip = (typeof forwarded === "string" ? forwarded.split(",")[0] : typeof realIp === "string" ? realIp : "").trim();
  if (!ip) throw new Error("Client IP header is unavailable.");

  const bucketKey = createHmac("sha256", hashSecret).update(`${scope}:${ip}`).digest("hex");
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/thor_consume_rate_limit`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify({
      p_bucket_key: bucketKey,
      p_limit: limit,
      p_window_seconds: windowSeconds
    }),
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) throw new Error(`Rate limiter request failed: ${response.status}`);
  const allowed = await response.json();
  if (typeof allowed !== "boolean") throw new Error("Rate limiter returned an invalid response.");
  return !allowed;
}
