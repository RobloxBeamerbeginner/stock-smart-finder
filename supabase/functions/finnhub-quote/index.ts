import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { symbols } = await req.json();
    const list = (Array.isArray(symbols) ? symbols : [])
      .map((s: string) => String(s).trim().toUpperCase()).filter(Boolean);
    const key = Deno.env.get("FINNHUB_API_KEY");
    if (!key) throw new Error("FINNHUB_API_KEY missing");

    const out = await Promise.all(list.map(async (sym) => {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${key}`);
        const q = await r.json();
        return { symbol: sym, price: q.c, change: q.d, changePercent: q.dp, high: q.h, low: q.l, prevClose: q.pc };
      } catch { return { symbol: sym, error: true }; }
    }));

    return new Response(JSON.stringify({ quotes: out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "err" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});