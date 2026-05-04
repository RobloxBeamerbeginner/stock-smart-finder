import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Stock } from "@/data/stocks";
import { supabase } from "@/integrations/supabase/client";
import { GitCompareArrows, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  stocks: Stock[];
  onRemove: (s: Stock) => void;
  onClear: () => void;
}

export const CompareDrawer = ({ stocks, onRemove, onClear }: Props) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const compare = async () => {
    if (stocks.length < 2) {
      toast.error("Pick at least 2 stocks to compare");
      return;
    }
    setLoading(true); setResult("");
    try {
      const { data, error } = await supabase.functions.invoke("analyze-stock", {
        body: { mode: "compare", payload: { stocks } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data.content);
    } catch (e: any) {
      toast.error(e.message ?? "Comparison failed");
    } finally {
      setLoading(false);
    }
  };

  if (stocks.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-105"
        >
          <GitCompareArrows className="h-4 w-4" />
          Compare {stocks.length} stock{stocks.length > 1 ? "s" : ""}
        </button>
      </div>

      <div className={cn("fixed inset-0 z-50 transition-opacity", open ? "opacity-100" : "pointer-events-none opacity-0")}>
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
        <div className={cn(
          "absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-6 shadow-[var(--shadow-card)] transition-transform",
          open ? "translate-y-0" : "translate-y-full"
        )}>
          <div className="mx-auto max-w-5xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Compare stocks</h3>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {stocks.map(s => (
                <span key={s.symbol} className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs">
                  <span className="font-mono font-bold">{s.symbol}</span>
                  <span className="text-muted-foreground">${s.price.toFixed(2)}</span>
                  <button onClick={() => onRemove(s)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    {["Symbol","Price","Change","Mkt Cap","P/E","52W Range"].map(h => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {stocks.map(s => (
                    <tr key={s.symbol} className="border-t border-border">
                      <td className="px-3 py-2 font-mono font-bold">{s.symbol}</td>
                      <td className="px-3 py-2 tabular-nums">${s.price.toFixed(2)}</td>
                      <td className={cn("px-3 py-2 tabular-nums font-medium", s.changePercent >= 0 ? "text-[hsl(var(--bullish))]" : "text-[hsl(var(--bearish))]")}>{s.changePercent.toFixed(2)}%</td>
                      <td className="px-3 py-2">{s.marketCap}</td>
                      <td className="px-3 py-2 tabular-nums">{s.pe.toFixed(1)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">${s.low52} – ${s.high52}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={compare} disabled={loading} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompareArrows className="h-4 w-4" />}
                AI verdict
              </button>
              <button onClick={onClear} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary">Clear all</button>
            </div>

            {(loading || result) && (
              <div className="prose prose-sm prose-invert mt-4 max-w-none rounded-xl border border-border bg-secondary/30 p-4">
                {loading && !result ? (
                  <div className="space-y-2">
                    <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-full animate-pulse rounded bg-muted" />
                    <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                  </div>
                ) : <ReactMarkdown>{result}</ReactMarkdown>}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};