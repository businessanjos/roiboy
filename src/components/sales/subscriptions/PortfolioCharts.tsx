import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { formatBRL, formatBRLShort, monthLabel, type PortfolioMetrics } from "@/lib/sales/payPortfolio";
import { INK } from "./PortfolioParts";

const axis = (tv?: boolean) => ({ fontSize: tv ? 16 : 11, fill: INK.muted });
const tooltipStyle = { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--popover-foreground))", fontSize: 12 };
const box = (tv?: boolean) => cn("w-full min-w-0", tv ? "h-full min-h-[140px]" : "h-56");

function Empty({ tv }: { tv?: boolean }) {
  return <div className={cn(box(tv), "flex items-center justify-center text-sm text-muted-foreground")}>Sem dados para mostrar ainda.</div>;
}

export function MrrChart({ data, tv }: { data: PortfolioMetrics["mrrSeries"]; tv?: boolean }) {
  if (!data.some(d => d.mrrCents > 0)) return <Empty tv={tv} />;
  const last = data.length - 1;
  return (
    <div className={box(tv)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 24, right: tv ? 110 : 76, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="mrr-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={INK.neutral} stopOpacity={0.18} />
              <stop offset="100%" stopColor={INK.neutral} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={INK.grid} strokeOpacity={0.6} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={axis(tv)} axisLine={false} tickLine={false} interval={0} />
          <YAxis tickFormatter={v => formatBRLShort(v)} tick={axis(tv)} axisLine={false} tickLine={false} width={tv ? 90 : 64} />
          {!tv && <Tooltip contentStyle={tooltipStyle} labelFormatter={monthLabel} formatter={(v: number) => [formatBRL(v), "MRR"]} />}
          <Area type="monotone" dataKey="mrrCents" stroke={INK.neutral} strokeWidth={tv ? 3 : 2} fill="url(#mrr-fill)" isAnimationActive={!tv}>
            <LabelList dataKey="mrrCents" content={({ x, y, index, value }: any) => index === last
              ? <text x={Number(x) + 8} y={Number(y) + 4} fontSize={tv ? 18 : 12} fontWeight={600} fill={INK.neutral}>{formatBRLShort(Number(value))}</text>
              : null} />
          </Area>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CountBars({ data, tone, tv }: { data: { month: string; count: number }[]; tone?: "loss"; tv?: boolean }) {
  if (!data.some(d => d.count > 0)) return <Empty tv={tv} />;
  return (
    <div className={box(tv)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={INK.grid} strokeOpacity={0.6} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={axis(tv)} axisLine={false} tickLine={false} interval={0} />
          <YAxis allowDecimals={false} tick={axis(tv)} axisLine={false} tickLine={false} width={tv ? 40 : 28} />
          {!tv && <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={tooltipStyle} labelFormatter={monthLabel} formatter={(v: number) => [v, "Clínicas"]} />}
          <Bar dataKey="count" fill={tone === "loss" ? INK.loss : INK.neutral} radius={[4, 4, 0, 0]} maxBarSize={tv ? 56 : 32} isAnimationActive={!tv}>
            <LabelList dataKey="count" position="top" fontSize={tv ? 16 : 11} fill={INK.muted} formatter={(v: number) => (v > 0 ? v : "")} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CashflowLegend({ tv }: { tv?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground", tv ? "text-base" : "text-xs")}>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success" /> Recebido</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-info" /> A receber</span>
    </div>
  );
}

export function CashflowChart({ data, tv }: { data: PortfolioMetrics["cashflow"]; tv?: boolean }) {
  if (!data.some(d => d.receivedCents > 0 || d.receivableCents > 0)) return <Empty tv={tv} />;
  return (
    <div className={cn("overflow-x-auto", tv && "h-full")}>
      <div className={cn(box(tv), !tv && "min-w-[640px]")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke={INK.grid} strokeOpacity={0.6} />
            <XAxis dataKey="month" tickFormatter={monthLabel} tick={axis(tv)} axisLine={false} tickLine={false} interval={0} />
            <YAxis tickFormatter={v => formatBRLShort(v)} tick={axis(tv)} axisLine={false} tickLine={false} width={tv ? 90 : 64} />
            {!tv && <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={tooltipStyle} labelFormatter={monthLabel}
              formatter={(v: number, name: string) => [formatBRL(v), name === "receivedCents" ? "Recebido" : "A receber"]} />}
            <Bar dataKey="receivedCents" fill={INK.received} radius={[4, 4, 0, 0]} maxBarSize={tv ? 44 : 26} isAnimationActive={!tv} />
            <Bar dataKey="receivableCents" fill={INK.receivable} radius={[4, 4, 0, 0]} maxBarSize={tv ? 44 : 26} isAnimationActive={!tv}>
              {data.map(d => <Cell key={d.month} fillOpacity={d.projected ? 0.65 : 1} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function RankingBars({ data }: { data: PortfolioMetrics["ranking"] }) {
  const max = Math.max(...data.map(d => d.receivedCents), 0);
  if (!data.length) return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Sem vendas pagas no RykaPay ainda.</div>;
  return (
    <ul className="space-y-2.5">
      {data.map(row => (
        <li key={row.seller} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
          <span className="truncate" title={row.seller}>{row.seller}</span>
          <span className="h-2.5 rounded-full bg-muted">
            <span className="block h-full rounded-full bg-foreground/80" style={{ width: max ? `${Math.max(2, (row.receivedCents / max) * 100)}%` : "0%" }} />
          </span>
          <span className="tabular-nums font-medium">{formatBRL(row.receivedCents)}</span>
        </li>
      ))}
    </ul>
  );
}

export function HealthDonut({ rate }: { rate: number | null }) {
  const value = rate ?? 0;
  return (
    <div className="relative h-40 w-40 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={[{ v: value }, { v: 100 - value }]} dataKey="v" innerRadius="72%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
            <Cell fill={rate === null ? "hsl(var(--muted))" : INK.neutral} />
            <Cell fill="hsl(var(--muted))" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{rate === null ? "—" : `${rate.toFixed(1)}%`}</span>
        <span className="text-xs text-muted-foreground">adimplência</span>
      </div>
    </div>
  );
}
