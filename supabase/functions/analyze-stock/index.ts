import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode, payload } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "analysis") {
      const { symbol, name, price, changePercent, sector } = payload;
      systemPrompt = "You are a sharp equity analyst. Be concise (3-4 short bullet points). Explain plausible reasons WHY a stock might be up or down today using sector context, macro trends, and typical drivers. Always include a disclaimer that this is educational, not financial advice.";
      userPrompt = `Stock: ${name} (${symbol}) — Sector: ${sector}\nCurrent price: $${price}\nDay change: ${changePercent}%\n\nGive a brief plausible explanation for today's move and key things to watch.`;
    } else if (mode === "compare") {
      systemPrompt = "You are a portfolio analyst. Compare the stocks objectively in markdown. Use a short table for key metrics, then 3-4 bullet 'verdict' points covering valuation, momentum, and risk. End with a one-line educational disclaimer.";
      userPrompt = `Compare these stocks:\n${JSON.stringify(payload.stocks, null, 2)}`;
    } else if (mode === "news") {
      const { symbol, name } = payload;
      systemPrompt = "You are a financial news summarizer. Generate 4 plausible recent news headlines for the given stock with a 1-sentence summary each. Format as markdown list. Mark them clearly as 'AI-generated illustrative headlines for demo purposes — not real news.'";
      userPrompt = `Generate illustrative recent headlines for ${name} (${symbol}).`;
    } else {
      throw new Error("Invalid mode");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-stock error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});