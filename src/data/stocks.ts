export type Stock = {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: string;
  pe: number;
  volume: string;
  high52: number;
  low52: number;
  history: number[];
};

const gen = (base: number, vol: number) =>
  Array.from({ length: 30 }, (_, i) => {
    const t = i / 29;
    const drift = Math.sin(t * Math.PI * 2) * vol * 0.5;
    const noise = (Math.sin(i * 7.13) + Math.cos(i * 3.7)) * vol * 0.3;
    return +(base + drift + noise).toFixed(2);
  });

export const STOCKS: Stock[] = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "Technology", price: 184.32, change: -3.21, changePercent: -1.71, marketCap: "$2.85T", pe: 28.4, volume: "52.3M", high52: 199.62, low52: 164.08, history: gen(184, 8) },
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Semiconductors", price: 487.21, change: 12.40, changePercent: 2.61, marketCap: "$1.20T", pe: 65.2, volume: "41.8M", high52: 502.66, low52: 211.0, history: gen(487, 25) },
  { symbol: "TSLA", name: "Tesla Inc.", sector: "Automotive", price: 218.89, change: -8.74, changePercent: -3.84, marketCap: "$695B", pe: 71.3, volume: "98.2M", high52: 299.29, low52: 152.37, history: gen(220, 18) },
  { symbol: "MSFT", name: "Microsoft Corp.", sector: "Technology", price: 412.55, change: 1.83, changePercent: 0.45, marketCap: "$3.06T", pe: 36.1, volume: "22.1M", high52: 430.82, low52: 309.45, history: gen(412, 10) },
  { symbol: "GOOGL", name: "Alphabet Inc.", sector: "Technology", price: 142.18, change: -2.10, changePercent: -1.46, marketCap: "$1.78T", pe: 25.8, volume: "28.7M", high52: 153.78, low52: 115.83, history: gen(142, 6) },
  { symbol: "AMZN", name: "Amazon.com Inc.", sector: "E-Commerce", price: 178.92, change: 0.84, changePercent: 0.47, marketCap: "$1.86T", pe: 51.2, volume: "35.4M", high52: 189.77, low52: 118.35, history: gen(178, 9) },
  { symbol: "META", name: "Meta Platforms", sector: "Technology", price: 482.61, change: -6.12, changePercent: -1.25, marketCap: "$1.23T", pe: 27.9, volume: "18.6M", high52: 531.49, low52: 274.38, history: gen(482, 20) },
  { symbol: "AMD", name: "Adv. Micro Devices", sector: "Semiconductors", price: 158.34, change: -4.85, changePercent: -2.97, marketCap: "$256B", pe: 240.1, volume: "60.2M", high52: 227.30, low52: 93.12, history: gen(158, 12) },
  { symbol: "NFLX", name: "Netflix Inc.", sector: "Media", price: 612.45, change: 5.12, changePercent: 0.84, marketCap: "$264B", pe: 47.8, volume: "4.1M", high52: 639.00, low52: 344.73, history: gen(612, 22) },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "Financials", price: 198.76, change: -1.42, changePercent: -0.71, marketCap: "$571B", pe: 12.3, volume: "9.8M", high52: 205.88, low52: 135.19, history: gen(198, 7) },
  { symbol: "DIS", name: "Walt Disney Co.", sector: "Media", price: 98.21, change: -2.87, changePercent: -2.84, marketCap: "$179B", pe: 71.5, volume: "12.4M", high52: 123.74, low52: 78.73, history: gen(98, 5) },
  { symbol: "BA", name: "Boeing Co.", sector: "Industrials", price: 167.94, change: -5.32, changePercent: -3.07, marketCap: "$103B", pe: -30.2, volume: "11.7M", high52: 267.54, low52: 159.70, history: gen(170, 10) },
];