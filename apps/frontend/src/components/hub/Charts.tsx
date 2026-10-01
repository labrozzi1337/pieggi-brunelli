export function Sparkline({ values, compact = false }: { values: number[]; compact?: boolean }) {
  const max = Math.max(...values); const min = Math.min(...values); const range = max - min || 1;
  const last = values.at(-1) ?? min;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${46 - ((value - min) / range) * 38}`).join(" ");
  return <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-label="Gráfico de tendência">
    {!compact && <><line x1="0" y1="10" x2="100" y2="10" className="chart-grid" /><line x1="0" y1="28" x2="100" y2="28" className="chart-grid" /><line x1="0" y1="46" x2="100" y2="46" className="chart-grid" /></>}
    <polyline points={points} fill="none" className="chart-line" strokeWidth={compact ? 2 : 1.5} vectorEffect="non-scaling-stroke" />
    <circle cx="100" cy={46 - ((last - min) / range) * 38} r="2" className="chart-point" vectorEffect="non-scaling-stroke" />
  </svg>;
}

export function MiniBars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values);
  return <div className="flex h-full items-end gap-2 sm:gap-3">{values.map((value, index) => <div key={`${labels[index]}-${value}`} className="group flex h-full flex-1 flex-col justify-end gap-2"><div className="relative flex flex-1 items-end"><span className="chart-bar w-full rounded-t-[3px] transition-all group-hover:brightness-125" style={{ height: `${(value / max) * 100}%` }}><span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[9px] text-background group-hover:block">{value}%</span></span></div><span className="text-center text-[8px] text-muted-foreground sm:text-[9px]">{labels[index]}</span></div>)}</div>;
}
