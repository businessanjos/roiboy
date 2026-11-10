import { useMemo, useState } from 'react';
import { Instagram, Layers, Users, Target, Trophy, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCommercialIntelligence } from '@/hooks/useCommercialIntelligence';
import { getDealStatusBadge } from '@/lib/sales/dealStatusBadge';
import { cn } from '@/lib/utils';
import { DashboardPeriodFilter, resolvePeriod, type PeriodValue } from './DashboardPeriodFilter';
import { AcquisitionTrendChart } from './AcquisitionTrendChart';
import { commercialEvolution, commercialGroups, commercialSummary } from './commercialIntelligenceData';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const isInstagramOrigin = (o: string) => /instagram/i.test(o);

type View = { kind: 'all' } | { kind: 'channel'; value: string } | { kind: 'instagram'; value: string | null };

export function InsightsChannelOverview() {
  const [period, setPeriod] = useState<PeriodValue>({ preset: '6m' });
  const range = useMemo(() => resolvePeriod(period), [period]);
  const { data: rows = [], isLoading } = useCommercialIntelligence(range.startDate, range.endDate);
  const [view, setView] = useState<View>({ kind: 'instagram', value: null });
  const [page, setPage] = useState(0);

  const channels = useMemo(() => [...new Set(rows.map(r => r.channel))].sort(), [rows]);
  const igRows = useMemo(() => rows.filter(r => r.origins.some(isInstagramOrigin)), [rows]);
  const igProfiles = useMemo(() => commercialGroups(igRows, 'origin').filter(g => isInstagramOrigin(g.label)), [igRows]);

  const filtered = useMemo(() => {
    if (view.kind === 'all') return rows;
    if (view.kind === 'channel') return rows.filter(r => r.channel === view.value);
    return view.value ? rows.filter(r => r.origins.includes(view.value!)) : igRows;
  }, [rows, igRows, view]);

  const s = commercialSummary(filtered);
  const evolution = useMemo(() => commercialEvolution(filtered).map(row => ({ ...row, label: new Date(`${row.month}-02T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) })), [filtered]);
  const pageRows = filtered.slice(page * 15, page * 15 + 15);
  const pages = Math.max(1, Math.ceil(filtered.length / 15));
  const pick = (v: View) => { setView(v); setPage(0); };
  const title = view.kind === 'all' ? 'Todos os canais' : view.kind === 'channel' ? view.value : view.value ?? 'Instagram (todos os perfis)';

  const kpis = [
    { label: 'Leads', value: s.leads.toLocaleString('pt-BR'), icon: Users },
    { label: 'MQL', value: s.mql.toLocaleString('pt-BR'), hint: s.leads ? pct(s.mql / s.leads * 100) : '—', icon: Target },
    { label: 'Vendas', value: s.sales.toLocaleString('pt-BR'), hint: pct(s.conversion), icon: Trophy },
    { label: 'Valor vendido', value: brl(s.revenue), hint: s.sales ? `ticket ${brl(s.ticket)}` : undefined, icon: Wallet },
  ];

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">Negócios criados no período, com dados do Comercial</p>
        </div>
        <DashboardPeriodFilter value={period} onChange={v => { setPeriod(v); setPage(0); }} />
      </div>

      <div className="space-y-2 rounded-xl border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Canais">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <Pill active={view.kind === 'all'} onClick={() => pick({ kind: 'all' })} label="Todos" count={rows.length} />
          {channels.map(c => <Pill key={c} active={view.kind === 'channel' && view.value === c} onClick={() => pick({ kind: 'channel', value: c })} label={c} count={rows.filter(r => r.channel === c).length} />)}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-2" role="group" aria-label="Perfis do Instagram">
          <Instagram className="h-4 w-4 text-primary" />
          <Pill active={view.kind === 'instagram' && !view.value} onClick={() => pick({ kind: 'instagram', value: null })} label="Instagram (todos)" count={igRows.length} />
          {igProfiles.map(p => <Pill key={p.label} active={view.kind === 'instagram' && view.value === p.label} onClick={() => pick({ kind: 'instagram', value: p.label })} label={p.label.replace(/^Instagram\s*/i, '') || p.label} count={p.leads} />)}
        </div>
      </div>

      {isLoading ? <Skeleton className="h-80 w-full" /> : <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map(k => (
            <div key={k.label} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{k.label}</span><k.icon className="h-4 w-4" /></div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{k.value}</p>
              {k.hint && <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{k.hint}</p>}
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 rounded-xl border bg-card p-4"><AcquisitionTrendChart data={evolution} /></div>
          <div className="rounded-xl border bg-card p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Instagram className="h-4 w-4 text-primary" />Perfis do Instagram</h4>
            {igProfiles.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum lead com origem Instagram no período.</p> : (
              <div className="space-y-3">
                {igProfiles.map(p => {
                  const max = igProfiles[0].leads || 1;
                  const active = view.kind === 'instagram' && view.value === p.label;
                  return (
                    <button key={p.label} type="button" onClick={() => pick(active ? { kind: 'instagram', value: null } : { kind: 'instagram', value: p.label })} className={cn('w-full rounded-lg p-2 text-left transition-colors hover:bg-muted', active && 'bg-primary/10')}>
                      <div className="flex items-center justify-between gap-2 text-sm"><span className="truncate font-medium">{p.label}</span><span className="tabular-nums text-muted-foreground">{p.leads}</span></div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${p.leads / max * 100}%` }} /></div>
                      <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground tabular-nums"><span>{p.mql} MQL</span><span>{p.sales} vendas</span><span>{brl(p.revenue)}</span></div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3"><h4 className="text-sm font-semibold">Leads</h4><span className="text-xs text-muted-foreground tabular-nums">{filtered.length.toLocaleString('pt-BR')} negócios</span></div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <colgroup><col className="w-[32%]" /><col className="w-[24%]" /><col className="hidden md:table-column w-[16%]" /><col className="w-[16%]" /><col className="hidden sm:table-column w-[12%]" /></colgroup>
              <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>
                <th className="h-10 px-4 text-left font-medium">Nome</th><th className="px-3 text-left font-medium">Perfil de origem</th><th className="hidden px-3 text-left font-medium md:table-cell">Canal</th><th className="px-3 text-left font-medium">Status</th><th className="hidden px-3 text-left font-medium sm:table-cell">Criado em</th>
              </tr></thead>
              <tbody className="divide-y">
                {pageRows.map(r => {
                  const st = getDealStatusBadge(r.status);
                  return (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2.5"><div className="flex min-w-0 items-center gap-2"><span className="truncate font-medium">{r.name}</span>{r.mql && <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px] text-primary">MQL</Badge>}</div>{r.instagram && <p className="truncate text-[11px] text-muted-foreground/70">{r.instagram}</p>}</td>
                      <td className="truncate px-3 py-2.5 text-muted-foreground">{r.origins.join(', ') || '—'}</td>
                      <td className="hidden truncate px-3 py-2.5 text-muted-foreground md:table-cell">{r.channel}</td>
                      <td className="px-3 py-2.5">{st && <Badge variant="outline" className={st.className}>{st.label}</Badge>}</td>
                      <td className="hidden px-3 py-2.5 tabular-nums text-muted-foreground sm:table-cell">{new Date(r.createdAt).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  );
                })}
                {pageRows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Nenhum lead neste recorte.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-3 border-t px-4 py-2.5"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button><span className="text-xs tabular-nums text-muted-foreground">{page + 1} / {pages}</span><Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Próxima</Button></div>
        </div>
      </>}

    </section>
  );
}

function Pill({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return <Button size="sm" variant={active ? 'default' : 'outline'} className="h-8 rounded-full" aria-pressed={active} onClick={onClick}>{label}<span className="ml-1.5 tabular-nums opacity-70">{count}</span></Button>;
}
