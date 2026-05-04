import { useMemo, useState } from "react";
import { Search, TrendingUp } from "lucide-react";
import { STOCKS, Stock } from "@/data/stocks";
import { StockCard } from "@/components/StockCard";
import { StockDetail } from "@/components/StockDetail";
import { CompareDrawer } from "@/components/CompareDrawer";

const Index = () => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Stock>(STOCKS[0]);
  const [compare, setCompare] = useState<Stock[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return STOCKS;
    return STOCKS.filter(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.sector.toLowerCase().includes(q));
  }, [query]);

  const toggleCompare = (s: Stock) => {
    setCompare(prev => prev.find(p => p.symbol === s.symbol) ? prev.filter(p => p.symbol !== s.symbol) : [...prev, s]);
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-bg)" }}>
      <header className="border-b border-border/50 backdrop-blur-md">
        <div className="container flex items-center justify-between py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--gradient-primary)" }}>
              <TrendingUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">StockLens</h1>
          </div>
          <div className="text-xs text-muted-foreground">AI-powered market intelligence</div>
        </div>
      </header>

      <main className="container py-8">
        <section className="mb-8 text-center">
          <h2 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Find, compare & <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">understand</span> stocks
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Browse the market, see why prices are moving, and get AI verdicts comparing your watchlist.
          </p>

          <div className="relative mx-auto mt-6 max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by symbol, name, or sector…"
              className="w-full rounded-full border border-border bg-card py-3 pl-11 pr-4 text-sm outline-none ring-primary/50 transition-all placeholder:text-muted-foreground focus:ring-2"
            />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {filtered.map(s => (
              <StockCard
                key={s.symbol}
                stock={s}
                selected={selected.symbol === s.symbol}
                onSelect={setSelected}
                onCompareToggle={toggleCompare}
                inCompare={!!compare.find(c => c.symbol === s.symbol)}
              />
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No stocks match "{query}"</p>
            )}
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <StockDetail stock={selected} />
          </div>
        </div>
      </main>

      <CompareDrawer
        stocks={compare}
        onRemove={toggleCompare}
        onClear={() => setCompare([])}
      />
    </div>
  );
};

export default Index;
