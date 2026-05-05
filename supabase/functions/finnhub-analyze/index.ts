import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FINNHUB = "https://finnhub.io/api/v1";

async function fh(path: string, key: string) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${FINNHUB}${path}${sep}token=${key}`);
  if (!r.ok) throw new Error(`Finnhub ${path} failed: ${r.status}`);
  return r.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { symbol: rawSym, mode = "full", days = 7 } = await req.json();
    const symbol = String(rawSym || "").trim().toUpperCase();
    if (!symbol) throw new Error("symbol required");

    const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!FINNHUB_API_KEY) throw new Error("FINNHUB_API_KEY not configured");

    // Quote + profile in parallel
    const [quote, profile] = await Promise.all([
      fh(`/quote?symbol=${symbol}`, FINNHUB_API_KEY),
      fh(`/stock/profile2?symbol=${symbol}`, FINNHUB_API_KEY).catch(() => ({})),
    ]);

    if (!quote || quote.c === 0 || quote.c == null) {
      return new Response(JSON.stringify({ error: `No data for "${symbol}"` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // News (last `days` days)
    const to = new Date();
    const from = new Date(Date.now() - days * 86400000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const newsRaw = await fh(
      `/company-news?symbol=${symbol}&from=${fmt(from)}&to=${fmt(to)}`,
      FINNHUB_API_KEY,
    ).catch(() => []);
    const news = (Array.isArray(newsRaw) ? newsRaw : [])
      .slice(0, 15)
      .map((n: any) => ({
        id: n.id,
        headline: n.headline,
        summary: n.summary,
        source: n.source,
        url: n.url,
        datetime: n.datetime,
        image: n.image,
      }));

    let analysis = "";
    if (mode === "full" && LOVABLE_API_KEY) {
      const direction = quote.dp >= 0 ? "up" : "down";
      const newsBrief = news.slice(0, 8).map((n: any) =>
        `- ${n.headline} (${n.source})`
      ).join("\n");

      const sys =
        "You are a sharp equity analyst. Be concise and structured in markdown. " +
        "Use these exact sections with H3 headings: " +
        "'### Why it's " + direction + "', '### What could fix it', '### News-based outlook', '### Disclaimer'. " +
        "Use 3-4 short bullets per section. Reference the provided news where relevant. " +
        "End with a one-line disclaimer that this is educational, not financial advice.";
      const user =
        `Stock: ${profile?.name ?? symbol} (${symbol})\n` +
        `Industry: ${profile?.finnhubIndustry ?? "n/a"}\n` +
        `Price: $${quote.c}  Change: ${quote.d} (${quote.dp}%)\n` +
        `Day range: $${quote.l} – $${quote.h}  Prev close: $${quote.pc}\n\n` +
        `Recent headlines (last ${days}d):\n${newsBrief || "(no recent news)"}\n\n` +
        `Explain plausibly why the stock is ${direction} today, what catalysts could turn it around, ` +
        `and a brief outlook based on the news above.`;

      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        }),
      });
      if (r.status === 429) {
        analysis = "_AI rate limit hit — try again shortly._";
      } else if (r.status === 402) {
        analysis = "_AI credits exhausted. Add credits in workspace settings._";
      } else if (r.ok) {
        const j = await r.json();
        analysis = j.choices?.[0]?.message?.content ?? "";
      } else {
        console.error("AI error", r.status, await r.text());
      }
    }

    return new Response(JSON.stringify({
      symbol,
      profile: {
        name: profile?.name ?? symbol,
        industry: profile?.finnhubIndustry ?? null,
        logo: profile?.logo ?? null,
        marketCap: profile?.marketCapitalization ?? null,
        exchange: profile?.exchange ?? null,
        currency: profile?.currency ?? "USD",
      },
      quote: {
        price: quote.c,
        change: quote.d,
        changePercent: quote.dp,
        high: quote.h,
        low: quote.l,
        open: quote.o,
        prevClose: quote.pc,
        timestamp: quote.t,
      },
      news,
      analysis,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("finnhub-analyze error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});