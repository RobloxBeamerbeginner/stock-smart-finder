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

    if (action === "check_domain") {
      const domain = String(body.domain || "").trim().toLowerCase();
      if (!domain) throw new Error("domain required");
      if (domain === "resend.dev") {
        return new Response(JSON.stringify({ verified: true, status: "verified", testOnly: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const lk = Deno.env.get("LOVABLE_API_KEY");
      const rk = Deno.env.get("RESEND_API_KEY");
      if (!lk || !rk) throw new Error("Resend not connected");
      const r = await fetch("https://connector-gateway.lovable.dev/resend/domains", {
        headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": rk },
      });
      const j = await r.json().catch(() => ({}));
      const list = j?.data ?? [];
      const match = list.find((d: any) => String(d.name).toLowerCase() === domain);
      return new Response(JSON.stringify({
        verified: match?.status === "verified",
        status: match?.status ?? "not_found",
        domains: list.map((d: any) => ({ name: d.name, status: d.status })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const email = String(body.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) throw new Error("Valid email required");

    if (action === "get_settings") {
      const { data } = await supabase.from("watchlist_settings").select("*").eq("email", email).maybeSingle();
      return new Response(JSON.stringify({ settings: data ?? null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (action === "save_settings") {
      const from_name = String(body.from_name || "Stock Alerts").slice(0, 100);
      const from_email = String(body.from_email || "").trim().toLowerCase();
      if (!from_email.includes("@")) throw new Error("Valid from_email required");
      const { error } = await supabase.from("watchlist_settings").upsert({
        email, from_name, from_email, updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_test") {
      const lk = Deno.env.get("LOVABLE_API_KEY");
      const rk = Deno.env.get("RESEND_API_KEY");
      if (!lk || !rk) throw new Error("Resend not connected");
      const { data: settings } = await supabase.from("watchlist_settings")
        .select("from_name, from_email").eq("email", email).maybeSingle();
      const from_name = settings?.from_name || "Stock Alerts";
      const from_email = settings?.from_email || "onboarding@resend.dev";
      const from = `${from_name} <${from_email}>`;
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px">
          <h2 style="margin:0 0 12px;color:#fff">✅ Test email delivered</h2>
          <p style="margin:0 0 12px;color:#94a3b8">Your sender configuration is working.</p>
          <p style="margin:0;color:#cbd5e1"><b>From:</b> <span style="font-family:monospace">${from}</span></p>
          <p style="margin:6px 0 0;color:#cbd5e1"><b>To:</b> <span style="font-family:monospace">${email}</span></p>
          <p style="margin-top:20px;font-size:12px;color:#64748b">If you received this, real stock alerts will arrive at this address too.</p>
        </div>`;
      const r = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lk}`,
          "X-Connection-Api-Key": rk,
        },
        body: JSON.stringify({ from, to: [email], subject: "✅ Stock Alerts test email", html }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        return new Response(JSON.stringify({
          delivered: false,
          status: r.status,
          error: j?.message || j?.error?.message || j?.name || `HTTP ${r.status}`,
          from, to: email,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        delivered: true, id: j?.id, from, to: email,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
      const direction = ["both","up","down"].includes(body.direction) ? body.direction : "both";
      if (!symbol) throw new Error("symbol required");
      const { error } = await supabase.from("watchlist_alerts").upsert(
        { email, symbol, threshold_pct: threshold, direction },
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
    if (action === "toggle") {
      const symbol = String(body.symbol || "").trim().toUpperCase();
      const update: Record<string, unknown> = {};
      if (typeof body.enabled === "boolean") update.enabled = body.enabled;
      if (["both","up","down"].includes(body.direction)) update.direction = body.direction;
      if (Object.keys(update).length === 0) throw new Error("nothing to update");
      const { error } = await supabase.from("watchlist_alerts")
        .update(update).eq("email", email).eq("symbol", symbol);
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