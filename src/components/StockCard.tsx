import { Stock } from "@/data/stocks";
import { Sparkline } from "./Sparkline";
import { ArrowDownRight, ArrowUpRight, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  stock: Stock;
  selected?: boolean;
  onSelect: (s: Stock) => void;
  onCompareToggle: (s: Stock) => void;
  inCompare: boolean;
}

export const StockCard = ({ stock, selected, onSelect, onCompareToggle, inCompare }: Props) => {
  const positive = stock.changePercent >= 0;
  return (
    <div
      onClick={() => onSelect(stock)}
      className={cn(
        "group relative cursor-pointer rounded-xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-[var(--shadow-card)]",
        selected && "border-primary shadow-[var(--shadow-glow)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold tracking-tight">{stock.symbol}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{stock.sector}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{stock.name}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onCompareToggle(stock); }}
          className={cn(
            "rounded-md border p-1 transition-colors",
            inCompare ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50"
          )}
          aria-label="Add to compare"
        >
          {inCompare ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        </button>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-xl font-semibold tabular-nums">${stock.price.toFixed(2)}</div>
          <div className={cn("mt-0.5 flex items-center gap-1 text-xs font-medium", positive ? "text-[hsl(var(--bullish))]" : "text-[hsl(var(--bearish))]")}>
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {positive ? "+" : ""}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
          </div>
        </div>
        <Sparkline data={stock.history} positive={positive} />
      </div>
    </div>
  );
};