import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FINNHUB = "https://finnhub.io/api/v1";

async function sendEmail(to: string, subject: string, html: string, from: string) {
  const lk = Deno.env.get("LOVABLE_API_KEY");
  const rk = Deno.env.get("RESEND_API_KEY");
  if (!lk || !rk) throw new Error("Email keys missing");
  const r = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lk}`,
      "X-Connection-Api-Key": rk,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });
  if (!r.ok) {
    console.error("Resend failed", r.status, await r.text());
    return false;
  }
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const key = Deno.env.get("FINNHUB_API_KEY");
  if (!key) return new Response(JSON.stringify({ error: "no FINNHUB_API_KEY" }), { status: 500, headers: corsHeaders });

  let testEmail: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    testEmail = body?.testEmail ?? null;
  } catch {}

  const { data: alerts, error } = await supabase.from("watchlist_alerts").select("*").eq("enabled", true);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

  const results: any[] = [];
  const symbolCache = new Map<string, any>();
  const fromCache = new Map<string, string>();
  async function getFrom(em: string) {
    if (fromCache.has(em)) return fromCache.get(em)!;
    const { data } = await supabase.from("watchlist_settings").select("from_name, from_email").eq("email", em).maybeSingle();
    const f = data
      ? `${data.from_name} <${data.from_email}>`
      : "Stock Alerts <onboarding@resend.dev>";
    fromCache.set(em, f);
    return f;
  }

  for (const a of alerts ?? []) {
    if (testEmail && a.email !== testEmail) continue;
    try {
      let q = symbolCache.get(a.symbol);
      if (!q) {
        const r = await fetch(`${FINNHUB}/quote?symbol=${a.symbol}&token=${key}`);
        q = await r.json();
        symbolCache.set(a.symbol, q);
      }
      if (!q || !q.c) continue;

      const baseline = a.last_price ?? q.pc ?? q.c;
      const movePct = baseline ? ((q.c - baseline) / baseline) * 100 : 0;
      const threshold = Number(a.threshold_pct || 3);
      const triggered = Math.abs(movePct) >= threshold;

      // throttle: don't re-alert within 30 min
      const recent = a.last_alerted_at && (Date.now() - new Date(a.last_alerted_at).getTime() < 30 * 60_000);

      if (triggered && !recent) {
        const dir = movePct >= 0 ? "up" : "down";
        const arrow = movePct >= 0 ? "📈" : "📉";
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px">
            <h2 style="margin:0 0 12px;color:#fff">${arrow} ${a.symbol} moved ${dir} ${movePct.toFixed(2)}%</h2>
            <p style="margin:0 0 16px;color:#94a3b8">Your alert threshold of ${threshold}% was crossed.</p>
            <table style="width:100%;border-collapse:collapse;margin:12px 0">
              <tr><td style="padding:6px 0;color:#94a3b8">Price</td><td style="text-align:right;font-weight:600">$${q.c.toFixed(2)}</td></tr>
              <tr><td style="padding:6px 0;color:#94a3b8">Day change</td><td style="text-align:right;color:${q.dp >= 0 ? "#22c55e" : "#ef4444"}">${q.dp?.toFixed(2)}%</td></tr>
              <tr><td style="padding:6px 0;color:#94a3b8">Day range</td><td style="text-align:right">$${q.l?.toFixed(2)} – $${q.h?.toFixed(2)}</td></tr>
              <tr><td style="padding:6px 0;color:#94a3b8">Prev close</td><td style="text-align:right">$${q.pc?.toFixed(2)}</td></tr>
            </table>
            <p style="font-size:12px;color:#64748b;margin-top:20px">Educational only — not financial advice.</p>
          </div>`;
        const from = await getFrom(a.email);
        const sent = await sendEmail(a.email, `${arrow} ${a.symbol} ${dir} ${movePct.toFixed(2)}%`, html, from);
        if (sent) {
          await supabase.from("watchlist_alerts").update({
            last_price: q.c, last_alerted_at: new Date().toISOString(),
          }).eq("id", a.id);
          results.push({ symbol: a.symbol, email: a.email, movePct, sent: true });
        }
      } else if (a.last_price == null) {
        await supabase.from("watchlist_alerts").update({ last_price: q.c }).eq("id", a.id);
      }
    } catch (e) {
      console.error("scan err", a.symbol, e);
    }
  }

  return new Response(JSON.stringify({ scanned: alerts?.length ?? 0, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});