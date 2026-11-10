import { useState } from 'react';
import { TrendingUp, Target, Users, CheckCircle2, Wallet, Percent, ArrowUpRight } from 'lucide-react';


import { Button } from '@/components/ui/button';
import { AcquisitionTrendChart } from './AcquisitionTrendChart';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { commercialGroups, commercialSummary, commercialEvolution, type CommercialRow } from './commercialIntelligenceData';

const number = (value: number) => value.toLocaleString('pt-BR');
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const percentage = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export function CommercialAnalytics({ rows, onSelectGroup }: { rows: CommercialRow[]; onSelectGroup: (dimension: 'channel' | 'origin', label: string) => void }) {
  const summary = commercialSummary(rows);
  const evolution = commercialEvolution(rows).map(row => ({ ...row, label: new Date(`${row.month}-02T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) }));

  const [metric, setMetric] = useState<'leads' | 'mql' | 'sales'>('sales');
  const [expanded, setExpanded] = useState(false);
  const metrics = [
    { label: 'Negócios / leads', value: number(summary.leads), Icon: Users, color: 'text-info' },
    { label: 'MQL', value: number(summary.mql), Icon: Target, color: 'text-primary' },
    { label: 'Vendas', value: number(summary.sales), Icon: CheckCircle2, color: 'text-success' },
    { label: 'Conversão', value: percentage(summary.conversion), Icon: Percent, color: 'text-info' },
    { label: 'Valor vendido', value: money(summary.revenue), Icon: Wallet, color: 'text-success' },
    { label: 'Ticket médio', value: money(summary.ticket), Icon: TrendingUp, color: 'text-primary' },
  ];
  return <div className="space-y-6">
    <div className="grid grid-cols-2 gap-x-5 gap-y-5 border-y py-5 sm:grid-cols-3 xl:grid-cols-6">{metrics.map(({ label, value, Icon, color }) => <div key={label} className="min-w-0"><p className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className={`h-4 w-4 shrink-0 ${color}`} />{label}</p><p className="mt-2 break-words text-xl font-semibold tabular-nums">{value}</p></div>)}</div>
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-primary" />Evolução da aquisição</h3></div>
      <AcquisitionTrendChart data={evolution} />
    </section>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4"><h3 className="font-semibold">Desempenho por canal e origem / @</h3><ToggleGroup type="single" value={metric} onValueChange={v => { if (v === 'leads' || v === 'mql' || v === 'sales') setMetric(v); }} aria-label="Métrica dos rankings" size="sm"><ToggleGroupItem value="leads">Leads</ToggleGroupItem><ToggleGroupItem value="mql">MQL</ToggleGroupItem><ToggleGroupItem value="sales">Vendas</ToggleGroupItem></ToggleGroup></div>
    <div className="grid items-start gap-6 md:grid-cols-2">{(['channel', 'origin'] as const).map(dimension => {
      const groups = commercialGroups(rows, dimension).sort((a, b) => b[metric] - a[metric] || b.leads - a.leads);
      const max = Math.max(1, ...groups.map(g => g[metric]));
      return <section key={dimension} className="min-w-0 space-y-2"><div className="flex justify-between text-sm"><h4 className="font-semibold">{dimension === 'channel' ? 'Canais de aquisição' : 'Origens / perfis de aquisição'}</h4><span className="text-xs text-muted-foreground">{groups.length}</span></div><div className="divide-y border-y">{groups.slice(0, expanded ? groups.length : 6).map((group, index) => <Button key={group.label} variant="ghost" className="h-auto w-full justify-start gap-2 rounded-none px-1 py-3 text-left font-normal" onClick={() => onSelectGroup(dimension, group.label)} title={group.label}><span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">{index + 1}</span><span className="min-w-0 flex-1"><span className="block whitespace-normal break-words text-xs font-medium">{group.label}</span></span><svg viewBox="0 0 100 8" className="h-2 w-14 shrink-0 sm:w-20" aria-hidden="true"><rect width="100" height="8" rx="4" className="fill-muted" /><rect width={group[metric] / max * 100} height="8" rx="4" className={metric === 'sales' ? 'fill-success' : metric === 'mql' ? 'fill-primary' : 'fill-info'} /></svg><span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums">{number(group[metric])}</span><span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums" title="Conversão em vendas">{percentage(group.leads ? group.sales / group.leads * 100 : 0)}</span><ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground" /></Button>)}</div>{!groups.length && <p className="py-4 text-xs text-muted-foreground">Sem resultados.</p>}</section>;
    })}</div>
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Conversão: vendas ÷ negócios. Origens múltiplas contam em cada origem cadastrada.</p><Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>{expanded ? 'Ver menos' : 'Ver todos'}</Button></div>
  </div>;
}