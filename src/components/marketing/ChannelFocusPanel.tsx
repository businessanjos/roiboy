import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Leaf, Scale, PieChart } from 'lucide-react';
import { commercialGroups, commercialSummary, commercialEvolution, type CommercialRow } from './commercialIntelligenceData';

const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const num = (v: number) => v.toLocaleString('pt-BR');
const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** Foco num canal (padrão Orgânico): comparativo vs demais canais, participação mensal e taxas. */
export function ChannelFocusPanel({ allRows, focus }: { allRows: CommercialRow[]; focus: string }) {
  const data = useMemo(() => {
    const focusRows = allRows.filter(r => r.channel === focus);
    const otherRows = allRows.filter(r => r.channel !== focus);
    const f = commercialSummary(focusRows), o = commercialSummary(otherRows);
    const mqlRate = (s: typeof f) => (s.leads ? s.mql / s.leads * 100 : 0);
    const compare = [
      { label: 'Leads', focus: f.leads, other: o.leads, fmt: num },
      { label: 'MQL', focus: f.mql, other: o.mql, fmt: num },
      { label: 'Taxa MQL', focus: mqlRate(f), other: mqlRate(o), fmt: pct },
      { label: 'Vendas', focus: f.sales, other: o.sales, fmt: num },
      { label: 'Conversão', focus: f.conversion, other: o.conversion, fmt: pct },
      { label: 'Valor vendido', focus: f.revenue, other: o.revenue, fmt: money },
      { label: 'Ticket médio', focus: f.ticket, other: o.ticket, fmt: money },
    ];
    const allEvo = commercialEvolution(allRows);
    const focusEvo = new Map(commercialEvolution(focusRows).map(e => [e.month, e]));
    const share = allEvo.map(e => {
      const fe = focusEvo.get(e.month);
      return {
        label: new Date(`${e.month}-02T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        focusLeads: fe?.leads ?? 0, otherLeads: e.leads - (fe?.leads ?? 0),
        share: e.leads ? ((fe?.leads ?? 0) / e.leads) * 100 : 0,
      };
    });
    const rates = commercialGroups(allRows, 'channel').filter(g => g.leads >= 5).map(g => ({
      label: g.label, mqlRate: g.leads ? g.mql / g.leads * 100 : 0, conv: g.leads ? g.sales / g.leads * 100 : 0, isFocus: g.label === focus,
    })).sort((a, b) => b.conv - a.conv);
    const origins = commercialGroups(focusRows, 'origin').sort((a, b) => b.leads - a.leads).slice(0, 8);
    return { f, compare, share, rates, origins, total: allRows.length };
  }, [allRows, focus]);

  if (!data.f.leads) return null;
  const sharePct = data.total ? data.f.leads / data.total * 100 : 0;

  return <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" aria-label={`Análise do canal ${focus}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 font-semibold"><Leaf className="h-4 w-4 text-success" />Análise: {focus}</h3>
      <span className="text-xs text-muted-foreground">{pct(sharePct)} de todos os negócios do período</span>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <div className="min-w-0 rounded-lg border p-3">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Scale className="h-4 w-4 text-primary" />{focus} x demais canais</p>
        <table className="w-full table-fixed text-sm">
          <thead><tr className="text-xs text-muted-foreground"><th className="w-[34%] py-1.5 text-left font-medium">Métrica</th><th className="py-1.5 text-right font-medium text-primary">{focus}</th><th className="py-1.5 text-right font-medium">Demais</th></tr></thead>
          <tbody className="divide-y">{data.compare.map(c => {
            const better = c.focus > c.other;
            return <tr key={c.label}><td className="py-2 text-muted-foreground">{c.label}</td><td className={`py-2 text-right font-semibold tabular-nums ${better ? 'text-success' : ''}`}>{c.fmt(c.focus)}</td><td className="py-2 text-right tabular-nums text-muted-foreground">{c.fmt(c.other)}</td></tr>;
          })}</tbody>
        </table>
      </div>

      <div className="min-w-0 rounded-lg border p-3">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium"><PieChart className="h-4 w-4 text-primary" />Participação mensal em leads</p>
        <div className="h-60"><ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.share} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="r" orientation="right" unit="%" tick={{ fontSize: 11 }} domain={[0, 100]} />
            <Tooltip formatter={(v: number, n: string) => n === 'Participação' ? pct(v) : num(v)} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="l" dataKey="focusLeads" name={focus} stackId="a" fill="hsl(var(--success))" radius={[0, 0, 0, 0]} />
            <Bar yAxisId="l" dataKey="otherLeads" name="Demais" stackId="a" fill="hsl(var(--muted-foreground) / 0.3)" radius={[4, 4, 0, 0]} />
            <Line yAxisId="r" dataKey="share" name="Participação" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer></div>
      </div>

      <div className="min-w-0 rounded-lg border p-3">
        <p className="mb-2 text-sm font-medium">Taxa MQL e conversão por canal</p>
        <div className="h-60"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.rates} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
            <YAxis unit="%" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => pct(v)} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="mqlRate" name="Taxa MQL" radius={[4, 4, 0, 0]}>{data.rates.map(r => <Cell key={r.label} fill={r.isFocus ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.35)'} />)}</Bar>
            <Bar dataKey="conv" name="Conversão" radius={[4, 4, 0, 0]}>{data.rates.map(r => <Cell key={r.label} fill={r.isFocus ? 'hsl(var(--success))' : 'hsl(var(--success) / 0.35)'} />)}</Bar>
          </BarChart>
        </ResponsiveContainer></div>
      </div>

      <div className="min-w-0 rounded-lg border p-3">
        <p className="mb-2 text-sm font-medium">Origens / @ dentro de {focus}</p>
        <div className="space-y-2.5">{data.origins.map(o => {
          const w = data.origins[0]?.leads ? o.leads / data.origins[0].leads * 100 : 0;
          return <div key={o.label} className="min-w-0">
            <div className="flex items-baseline justify-between gap-2 text-xs"><span className="truncate font-medium">{o.label}</span><span className="shrink-0 tabular-nums text-muted-foreground">{num(o.leads)} leads · {num(o.mql)} MQL · {num(o.sales)} vendas</span></div>
            <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-success transition-all duration-700" style={{ width: `${w}%` }} /></div>
          </div>;
        })}</div>
      </div>
    </div>
  </section>;
}
