import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Stock } from "@/data/stocks";
import { Sparkline } from "./Sparkline";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Newspaper, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props { stock: Stock }

export const StockDetail = ({ stock }: Props) => {
  const [analysis, setAnalysis] = useState("");
  const [news, setNews] = useState("");
  const [loadingA, setLoadingA] = useState(false);
  const [loadingN, setLoadingN] = useState(false);
  const positive = stock.changePercent >= 0;

  const fetchAI = async (mode: "analysis" | "news") => {
    const setLoading = mode === "analysis" ? setLoadingA : setLoadingN;
    const setVal = mode === "analysis" ? setAnalysis : setNews;
    setLoading(true);
    setVal("");
    try {
      const { data, error } = await supabase.functions.invoke("analyze-stock", {
        body: { mode, payload: stock },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setVal(data.content);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load AI insight");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setAnalysis(""); setNews("");
    fetchAI("analysis");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock.symbol]);

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-mono text-2xl font-bold">{stock.symbol}</h2>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{stock.sector}</span>
          </div>
          <p className="text-sm text-muted-foreground">{stock.name}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums">${stock.price.toFixed(2)}</div>
          <div className={cn("mt-1 flex items-center justify-end gap-1 text-sm font-medium", positive ? "text-[hsl(var(--bullish))]" : "text-[hsl(var(--bearish))]")}>
            {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {positive ? "+" : ""}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Sparkline data={stock.history} positive={positive} width={600} height={120} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Market Cap", stock.marketCap],
          ["P/E", stock.pe.toFixed(1)],
          ["Volume", stock.volume],
          ["52W High", `$${stock.high52}`],
          ["52W Low", `$${stock.low52}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-secondary/50 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
            <div className="mt-1 font-mono text-sm font-semibold">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Section
          title={positive ? "Why is it up?" : "Why is it down?"}
          icon={<Sparkles className="h-4 w-4 text-primary" />}
          loading={loadingA}
          content={analysis}
          onRefresh={() => fetchAI("analysis")}
        />
        <Section
          title="Latest news"
          icon={<Newspaper className="h-4 w-4 text-primary" />}
          loading={loadingN}
          content={news}
          onRefresh={() => fetchAI("news")}
          emptyLabel="Load AI news summary"
        />
      </div>
    </div>
  );
};

const Section = ({ title, icon, loading, content, onRefresh, emptyLabel }: any) => (
  <div className="rounded-xl border border-border bg-secondary/30 p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</div>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
      </button>
    </div>
    <div className="prose prose-sm prose-invert mt-3 max-w-none text-sm text-foreground/90">
      {loading && !content ? (
        <div className="space-y-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      ) : content ? (
        <ReactMarkdown>{content}</ReactMarkdown>
      ) : (
        <button onClick={onRefresh} className="text-xs text-primary hover:underline">{emptyLabel ?? "Generate"}</button>
      )}
    </div>
  </div>
);