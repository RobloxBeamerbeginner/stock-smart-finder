interface SparklineProps {
  data: number[];
  positive: boolean;
  width?: number;
  height?: number;
}

export const Sparkline = ({ data, positive, width = 120, height = 36 }: SparklineProps) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(" ");
  const color = positive ? "hsl(var(--bullish))" : "hsl(var(--bearish))";
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${positive}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="1.75" points={points} />
      <polygon fill={`url(#grad-${positive})`} points={`0,${height} ${points} ${width},${height}`} />
    </svg>
  );
};