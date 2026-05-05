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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const action = body.action as string;
    const email = String(body.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) throw new Error("Valid email required");

    if (action === "list") {
      const { data, error } = await supabase.from("watchlist_alerts")
        .select("*").eq("email", email).order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ items: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (action === "add") {
      const symbol = String(body.symbol || "").trim().toUpperCase();
      const threshold = Number(body.threshold ?? 3);
      if (!symbol) throw new Error("symbol required");
      const { error } = await supabase.from("watchlist_alerts").upsert(
        { email, symbol, threshold_pct: threshold },
        { onConflict: "email,symbol" },
      );
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (action === "remove") {
      const symbol = String(body.symbol || "").trim().toUpperCase();
      const { error } = await supabase.from("watchlist_alerts")
        .delete().eq("email", email).eq("symbol", symbol);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    throw new Error("Unknown action");
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "err" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});