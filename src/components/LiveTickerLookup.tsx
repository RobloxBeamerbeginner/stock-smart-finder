import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, TrendingDown, TrendingUp, ExternalLink, Sparkles, Newspaper, Wrench } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NewsItem {
  id: number; headline: string; summary: string; source: string;
  url: string; datetime: number; image?: string;
}
interface Result {
  symbol: string;
  profile: { name: string; industry: string | null; logo: string | null; exchange: string | null; currency: string };
  quote: { price: number; change: number; changePercent: number; high: number; low: number; open: number; prevClose: number; timestamp: number };
  news: NewsItem[];
  analysis: string;
}

export const LiveTickerLookup = () => {
  const [symbol, setSymbol] = useState("");
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Result | null>(null);

  const lookup = async (sym?: string, d?: number) => {
    const s = (sym ?? symbol).trim().toUpperCase();
    if (!s) { toast.error("Enter a ticker, e.g. AAPL"); return; }
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("finnhub-analyze", {
        body: { symbol: s, days: d ?? days, mode: "full" },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      setData(res as Result);
      setSymbol(s);
    } catch (e: any) {
      toast.error(e.message ?? "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  const positive = (data?.quote.changePercent ?? 0) >= 0;

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-base font-semibold">Live ticker lookup</h3>
          <span className="text-xs text-muted-foreground">powered by Finnhub + AI</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              placeholder="AAPL, NVDA, TSLA…"
              className="w-44 rounded-md border border-border bg-background py-2 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <select
            value={days}
            onChange={(e) => { const v = +e.target.value; setDays(v); if (data) lookup(data.symbol, v); }}
            className="rounded-md border border-border bg-background px-2 py-2 text-xs"
          >
            <option value={1}>1d</option>
            <option value={3}>3d</option>
            <option value={7}>7d</option>
            <option value={14}>14d</option>
            <option value={30}>30d</option>
          </select>
          <button
            onClick={() => lookup()}
            disabled={loading}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Fetch
          </button>
        </div>
      </div>

      {!data && !loading && (
        <p className="mt-4 text-sm text-muted-foreground">
          Enter a US ticker symbol to fetch the live quote, recent news, and an AI explanation of what's driving the price and what could turn it around.
        </p>
      )}

      {loading && !data && (
        <div className="mt-6 space-y-2">
          <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      )}

      {data && (
        <>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
            <div className="flex items-center gap-3">
              {data.profile.logo && (
                <img src={data.profile.logo} alt="" className="h-12 w-12 rounded-md border border-border bg-white object-contain p-1" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-mono text-2xl font-bold">{data.symbol}</h4>
                  {data.profile.industry && (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {data.profile.industry}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{data.profile.name}{data.profile.exchange ? ` · ${data.profile.exchange}` : ""}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-semibold tabular-nums">${data.quote.price?.toFixed(2)}</div>
              <div className={cn("mt-1 flex items-center justify-end gap-1 text-sm font-medium",
                positive ? "text-[hsl(var(--bullish))]" : "text-[hsl(var(--bearish))]")}>
                {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {positive ? "+" : ""}{data.quote.change?.toFixed(2)} ({data.quote.changePercent?.toFixed(2)}%)
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Open", `$${data.quote.open?.toFixed(2)}`],
              ["Day High", `$${data.quote.high?.toFixed(2)}`],
              ["Day Low", `$${data.quote.low?.toFixed(2)}`],
              ["Prev Close", `$${data.quote.prevClose?.toFixed(2)}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-secondary/40 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
                <div className="mt-1 font-mono text-sm font-semibold">{v}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-secondary/30 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                {positive ? <Sparkles className="h-4 w-4 text-primary" /> : <Wrench className="h-4 w-4 text-primary" />}
                AI explanation & what could fix it
              </div>
              <div className="prose prose-sm prose-invert mt-3 max-w-none">
                {data.analysis ? (
                  <ReactMarkdown>{data.analysis}</ReactMarkdown>
                ) : (
                  <p className="text-sm text-muted-foreground">No AI analysis available.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-secondary/30 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Newspaper className="h-4 w-4 text-primary" />
                Latest news <span className="text-xs font-normal text-muted-foreground">· last {days}d · {data.news.length} items</span>
              </div>
              <ul className="mt-3 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {data.news.length === 0 && (
                  <li className="text-sm text-muted-foreground">No headlines in this window.</li>
                )}
                {data.news.map((n) => (
                  <li key={n.id} className="border-b border-border/60 pb-3 last:border-0">
                    <a href={n.url} target="_blank" rel="noreferrer" className="group block">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="rounded bg-primary/15 px-1.5 py-0.5 font-medium text-primary">{n.source}</span>
                        <span>{new Date(n.datetime * 1000).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium leading-snug group-hover:text-primary">
                        {n.headline} <ExternalLink className="ml-1 inline h-3 w-3 opacity-50" />
                      </p>
                      {n.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.summary}</p>}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  );
};