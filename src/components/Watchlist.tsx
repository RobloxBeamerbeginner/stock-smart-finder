import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, Plus, Trash2, Mail, Loader2, TrendingUp, TrendingDown, Send, AlertTriangle, CheckCircle2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type Direction = "both" | "up" | "down";
interface Alert {
  id: string; email: string; symbol: string; threshold_pct: number;
  last_price: number | null; last_alerted_at: string | null; enabled: boolean;
  direction: Direction;
}
interface LiveQuote {
  symbol: string; price?: number; change?: number; changePercent?: number;
  high?: number; low?: number; prevClose?: number; error?: boolean;
}

const STORAGE_KEY = "watchlist_email";

export const Watchlist = () => {
  const [email, setEmail] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "");
  const [savedEmail, setSavedEmail] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "");
  const [items, setItems] = useState<Alert[]>([]);
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [symbol, setSymbol] = useState("");
  const [threshold, setThreshold] = useState(3);
  const [direction, setDirection] = useState<Direction>("both");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fromName, setFromName] = useState("Stock Alerts");
  const [fromEmail, setFromEmail] = useState("onboarding@resend.dev");
  const [savingSettings, setSavingSettings] = useState(false);
  const [domainStatus, setDomainStatus] = useState<{ verified: boolean; status: string; testOnly?: boolean } | null>(null);
  const [checkingDomain, setCheckingDomain] = useState(false);

  const checkDomain = useCallback(async (em: string) => {
    const domain = em.split("@")[1]?.toLowerCase();
    if (!domain) { setDomainStatus(null); return; }
    setCheckingDomain(true);
    const { data } = await supabase.functions.invoke("watchlist-manage", {
      body: { action: "check_domain", domain },
    });
    setCheckingDomain(false);
    setDomainStatus(data ?? null);
  }, []);

  const loadSettings = useCallback(async (em: string) => {
    const { data } = await supabase.functions.invoke("watchlist-manage", {
      body: { action: "get_settings", email: em },
    });
    if (data?.settings) {
      setFromName(data.settings.from_name);
      setFromEmail(data.settings.from_email);
      checkDomain(data.settings.from_email);
    } else {
      checkDomain("onboarding@resend.dev");
    }
  }, [checkDomain]);

  useEffect(() => { if (savedEmail) loadSettings(savedEmail); }, [savedEmail, loadSettings]);

  const saveSettings = async () => {
    if (!savedEmail) return;
    if (!fromEmail.includes("@")) { toast.error("Enter a valid from email"); return; }
    setSavingSettings(true);
    const { data, error } = await supabase.functions.invoke("watchlist-manage", {
      body: { action: "save_settings", email: savedEmail, from_name: fromName, from_email: fromEmail },
    });
    setSavingSettings(false);
    if (error || data?.error) { toast.error(data?.error ?? error?.message); return; }
    toast.success("Sender saved");
    checkDomain(fromEmail);
  };

  const refresh = useCallback(async (em: string) => {
    if (!em) return;
    const { data, error } = await supabase.functions.invoke("watchlist-manage", {
      body: { action: "list", email: em },
    });
    if (error || data?.error) { toast.error(data?.error ?? error?.message); return; }
    setItems(data.items ?? []);
  }, []);

  const refreshQuotes = useCallback(async (syms: string[]) => {
    if (syms.length === 0) return;
    const { data, error } = await supabase.functions.invoke("finnhub-quote", { body: { symbols: syms } });
    if (error || data?.error) return;
    const map: Record<string, LiveQuote> = {};
    for (const q of data.quotes ?? []) map[q.symbol] = q;
    setQuotes(map);
  }, []);

  useEffect(() => { if (savedEmail) refresh(savedEmail); }, [savedEmail, refresh]);

  // Live quote polling every 30s
  useEffect(() => {
    const syms = items.map(i => i.symbol);
    if (syms.length === 0) return;
    refreshQuotes(syms);
    const id = setInterval(() => refreshQuotes(syms), 30_000);
    return () => clearInterval(id);
  }, [items, refreshQuotes]);

  const saveEmail = () => {
    const e = email.trim().toLowerCase();
    if (!e.includes("@")) { toast.error("Enter a valid email"); return; }
    localStorage.setItem(STORAGE_KEY, e);
    setSavedEmail(e);
    toast.success("Email saved — alerts will be sent here");
  };

  const addTicker = async () => {
    const s = symbol.trim().toUpperCase();
    if (!savedEmail) { toast.error("Save your email first"); return; }
    if (!s) { toast.error("Enter a ticker"); return; }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("watchlist-manage", {
      body: { action: "add", email: savedEmail, symbol: s, threshold, direction },
    });
    setLoading(false);
    if (error || data?.error) { toast.error(data?.error ?? error?.message); return; }
    toast.success(`${s} added to your watchlist`);
    setSymbol("");
    refresh(savedEmail);
  };

  const remove = async (sym: string) => {
    await supabase.functions.invoke("watchlist-manage", {
      body: { action: "remove", email: savedEmail, symbol: sym },
    });
    refresh(savedEmail);
  };

  const toggleAlert = async (sym: string, enabled: boolean) => {
    setItems(prev => prev.map(i => i.symbol === sym ? { ...i, enabled } : i));
    const { error } = await supabase.functions.invoke("watchlist-manage", {
      body: { action: "toggle", email: savedEmail, symbol: sym, enabled },
    });
    if (error) { toast.error("Failed to update"); refresh(savedEmail); return; }
    toast.success(`${sym} alerts ${enabled ? "enabled" : "paused"}`);
  };

  const setRowDirection = async (sym: string, dir: Direction) => {
    setItems(prev => prev.map(i => i.symbol === sym ? { ...i, direction: dir } : i));
    const { error } = await supabase.functions.invoke("watchlist-manage", {
      body: { action: "toggle", email: savedEmail, symbol: sym, direction: dir },
    });
    if (error) { toast.error("Failed to update"); refresh(savedEmail); return; }
    toast.success(`${sym} alerts on ${dir === "both" ? "any move" : dir + " moves"}`);
  };

  const runScanNow = async () => {
    if (!savedEmail) return;
    setScanning(true);
    const { data, error } = await supabase.functions.invoke("watchlist-scan", {
      body: { testEmail: savedEmail },
    });
    setScanning(false);
    if (error) { toast.error(error.message); return; }
    const sent = (data?.results ?? []).filter((r: any) => r.sent).length;
    if (sent > 0) toast.success(`${sent} alert email(s) sent to ${savedEmail}`);
    else toast.info("No tickers crossed your threshold yet — checks run every 5 min automatically.");
  };

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Bell className="h-3.5 w-3.5" />
        </div>
        <h3 className="text-base font-semibold">Watchlist & email alerts</h3>
        <span className="text-xs text-muted-foreground">live prices · auto-scan every minute</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button onClick={saveEmail}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          {savedEmail === email.trim().toLowerCase() && savedEmail ? "Saved" : "Save email"}
        </button>
      </div>

      {savedEmail && (
        <>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <button
              onClick={() => setShowSettings(s => !s)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Settings className="h-3.5 w-3.5" />
              Sender: <span className="font-mono">{fromName} &lt;{fromEmail}&gt;</span>
            </button>
            {domainStatus && (
              domainStatus.verified ? (
                <span className="flex items-center gap-1 text-[11px] text-[hsl(var(--bullish))]">
                  <CheckCircle2 className="h-3 w-3" />
                  {domainStatus.testOnly ? "Resend test domain (only delivers to your Resend account email)" : "Domain verified"}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-amber-500">
                  <AlertTriangle className="h-3 w-3" />
                  Domain not verified ({domainStatus.status})
                </span>
              )
            )}
          </div>

          {showSettings && (
            <div className="mt-3 rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">From name</label>
                  <input value={fromName} onChange={(e) => setFromName(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div className="flex-[2] min-w-[200px]">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">From email</label>
                  <input value={fromEmail} onChange={(e) => setFromEmail(e.target.value.toLowerCase())}
                    onBlur={() => checkDomain(fromEmail)}
                    placeholder="alerts@yourdomain.com"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono" />
                </div>
                <button onClick={saveSettings} disabled={savingSettings}
                  className="self-end rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save sender"}
                </button>
              </div>
              {checkingDomain && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Checking domain…
                </p>
              )}
              {domainStatus && !domainStatus.verified && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-200">
                  <p className="font-semibold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Domain not verified in Resend</p>
                  <p className="mt-1 opacity-90">
                    Emails from <span className="font-mono">{fromEmail}</span> will be rejected. Verify the domain in your Resend dashboard, or use <span className="font-mono">onboarding@resend.dev</span> (test only — delivers only to your Resend account email).
                  </p>
                </div>
              )}
              {domainStatus?.verified && domainStatus.testOnly && (
                <p className="text-[11px] text-muted-foreground">
                  Heads up: <span className="font-mono">resend.dev</span> only delivers to the email you signed up to Resend with. Verify your own domain to send to anyone.
                </p>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
            <div className="flex-1 min-w-[140px]">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Ticker</label>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && addTicker()}
                placeholder="AAPL"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="w-28">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Alert at ±%</label>
              <input
                type="number" min={0.5} step={0.5} value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Notify on</label>
              <div className="mt-1 inline-flex rounded-md border border-border bg-background p-0.5">
                {(["both","up","down"] as Direction[]).map(d => (
                  <button key={d} type="button" onClick={() => setDirection(d)}
                    className={cn("px-2.5 py-1.5 text-xs font-medium rounded-[4px] capitalize",
                      direction === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {d === "both" ? "Both" : d === "up" ? "Up only" : "Down only"}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={addTicker} disabled={loading}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </button>
            <button onClick={runScanNow} disabled={scanning || items.length === 0}
              className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium hover:bg-secondary/70 disabled:opacity-50">
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Test scan now
            </button>
          </div>

          {items.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No tickers yet. Add some to get email alerts when the price moves.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
              {items.map((it) => {
                const q = quotes[it.symbol];
                const positive = (q?.changePercent ?? 0) >= 0;
                return (
                  <li key={it.id} className="flex items-center gap-3 p-3">
                    <div className="font-mono text-sm font-bold w-20">{it.symbol}</div>
                    <div className="flex-1 min-w-0">
                      {q?.price != null ? (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold tabular-nums">${q.price.toFixed(2)}</span>
                          <span className={cn("flex items-center gap-0.5 text-xs font-medium",
                            positive ? "text-[hsl(var(--bullish))]" : "text-[hsl(var(--bearish))]")}>
                            {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {positive ? "+" : ""}{q.changePercent?.toFixed(2)}%
                          </span>
                        </div>
                      ) : (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      )}
                      <div className="text-[11px] text-muted-foreground">
                        Alert ±{it.threshold_pct}%
                        {" · "}
                        {it.direction === "up" ? "up only" : it.direction === "down" ? "down only" : "both"}
                        {it.last_alerted_at && ` · last alert ${new Date(it.last_alerted_at).toLocaleString()}`}
                      </div>
                    </div>
                    <div className="inline-flex rounded-md border border-border bg-background p-0.5">
                      {(["both","up","down"] as Direction[]).map(d => (
                        <button key={d} type="button" onClick={() => setRowDirection(it.symbol, d)}
                          title={d === "both" ? "Notify on any move" : d === "up" ? "Only when up" : "Only when down"}
                          className={cn("px-2 py-1 text-[11px] font-medium rounded-[4px] capitalize flex items-center gap-1",
                            (it.direction ?? "both") === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                          {d === "up" ? <TrendingUp className="h-3 w-3" /> : d === "down" ? <TrendingDown className="h-3 w-3" /> : "↕"}
                          {d === "both" ? "Both" : d}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Email alerts on/off">
                      <input
                        type="checkbox"
                        checked={it.enabled !== false}
                        onChange={(e) => toggleAlert(it.symbol, e.target.checked)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="text-[11px] text-muted-foreground">Alerts</span>
                    </label>
                    <button onClick={() => remove(it.symbol)}
                      className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
};