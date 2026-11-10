import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ComposedChart, Area, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type Point = { label: string; leads: number; mql: number; sales: number };
const num = (v: number) => v.toLocaleString('pt-BR');
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

const SERIES = [
  { key: 'leads', name: 'Leads', token: 'info' },
  { key: 'mql', name: 'MQL', token: 'primary' },
  { key: 'sales', name: 'Vendas', token: 'success' },
] as const;
const RATES = [
  { key: 'mqlRate', name: 'Leads → MQL', token: 'primary' },
  { key: 'saleRate', name: 'Leads → Venda', token: 'success' },
] as const;

export function AcquisitionTrendChart({ data }: { data: Point[] }) {
  const reducedMotion = useReducedMotion();
  const [mode, setMode] = useState<'volume' | 'rate'>('volume');
  const [hidden, setHidden] = useState<string[]>([]);
  const rows = useMemo(() => data.map(d => ({ ...d, mqlRate: d.leads ? d.mql / d.leads * 100 : 0, saleRate: d.leads ? d.sales / d.leads * 100 : 0 })), [data]);

  const stats = SERIES.map(s => {
    const values = rows.map(r => r[s.key]);
    const total = values.reduce((a, b) => a + b, 0);
    const peakIdx = values.indexOf(Math.max(...values));
    const last = values.at(-1) ?? 0, prev = values.at(-2) ?? 0;
    return { ...s, total, avg: values.length ? total / values.length : 0, peak: rows[peakIdx], delta: prev ? (last - prev) / prev * 100 : null };
  });
  const avgLeads = stats[0].avg;
  const series = mode === 'volume' ? SERIES : RATES;
  const toggle = (key: string) => setHidden(h => h.includes(key) ? h.filter(k => k !== key) : [...h, key]);

  if (!rows.length) return <p className="py-16 text-center text-sm text-muted-foreground">Nenhum negócio neste período.</p>;

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">{stats.map(s => {
      const Icon = s.delta == null || Math.abs(s.delta) < 0.5 ? Minus : s.delta > 0 ? TrendingUp : TrendingDown;
      return <div key={s.key} className="min-w-0 rounded-lg border bg-card p-3" style={{ borderTop: `3px solid hsl(var(--${s.token}))` }}>
        <p className="text-xs text-muted-foreground">{s.name} no período</p>
        <div className="mt-1 flex items-baseline justify-between gap-2"><span className="text-xl font-semibold tabular-nums">{num(s.total)}</span>{s.delta != null && <span className={`flex items-center gap-1 text-xs tabular-nums ${s.delta >= 0 ? 'text-success' : 'text-destructive'}`}><Icon className="h-3 w-3" />{pct(s.delta)}</span>}</div>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">Média {num(Math.round(s.avg))}/mês · Pico {s.peak?.label} ({num(s.peak?.[s.key] ?? 0)})</p>
      </div>;
    })}</div>

    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-2">{series.map(s => <button key={s.key} type="button" onClick={() => toggle(s.key)} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-opacity ${hidden.includes(s.key) ? 'opacity-40' : ''}`}><span className="h-2 w-2 rounded-full" style={{ background: `hsl(var(--${s.token}))` }} />{s.name}</button>)}</div>
      <ToggleGroup type="single" size="sm" value={mode} onValueChange={v => (v === 'volume' || v === 'rate') && setMode(v)} aria-label="Visão do gráfico"><ToggleGroupItem value="volume">Volume</ToggleGroupItem><ToggleGroupItem value="rate">Conversão %</ToggleGroupItem></ToggleGroup>
    </div>

    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
          <defs>{SERIES.map(s => <linearGradient key={s.key} id={`acq-${s.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={`hsl(var(--${s.token}))`} stopOpacity={0.35} /><stop offset="100%" stopColor={`hsl(var(--${s.token}))`} stopOpacity={0} /></linearGradient>)}</defs>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 6" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={v => mode === 'rate' ? `${v}%` : num(v)} />
          {mode === 'volume' && !hidden.includes('leads') && <ReferenceLine y={avgLeads} stroke="hsl(var(--info))" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: `média ${num(Math.round(avgLeads))}`, position: 'insideTopRight', fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />}
          <Tooltip cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '3 3' }} content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const r = payload[0].payload as typeof rows[number];
            return <div className="min-w-48 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
              <p className="mb-2 font-semibold capitalize">{label}</p>
              {SERIES.map(s => <p key={s.key} className="flex items-center justify-between gap-6 py-0.5"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: `hsl(var(--${s.token}))` }} />{s.name}</span><strong className="tabular-nums">{num(r[s.key])}</strong></p>)}
              <div className="mt-2 space-y-0.5 border-t pt-2 text-muted-foreground"><p className="flex justify-between gap-6">Leads → MQL<span className="tabular-nums text-foreground">{pct(r.mqlRate)}</span></p><p className="flex justify-between gap-6">Leads → Venda<span className="tabular-nums text-foreground">{pct(r.saleRate)}</span></p><p className="flex justify-between gap-6">MQL → Venda<span className="tabular-nums text-foreground">{pct(r.mql ? r.sales / r.mql * 100 : 0)}</span></p></div>
            </div>;
          }} />
          {mode === 'volume'
            ? SERIES.filter(s => !hidden.includes(s.key)).map((s, i) => <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={`hsl(var(--${s.token}))`} strokeWidth={2.5} fill={`url(#acq-${s.key})`} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--background))' }} isAnimationActive={!reducedMotion} animationBegin={i * 150} animationDuration={900} />)
            : RATES.filter(s => !hidden.includes(s.key)).map((s, i) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={`hsl(var(--${s.token}))`} strokeWidth={2.5} dot={{ r: 3, fill: 'hsl(var(--background))', strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={!reducedMotion} animationBegin={i * 150} />)}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  </div>;
}
