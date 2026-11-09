import { useMemo, useState } from 'react';
import { BarChart3, History, Instagram, Search, Users, Target, CheckCircle2, ExternalLink } from 'lucide-react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { LeadTimeline } from '@/components/leads/LeadTimeline';
import { useCommercialIntelligence } from '@/hooks/useCommercialIntelligence';
import { DashboardPeriodFilter, resolvePeriod, type PeriodValue } from './DashboardPeriodFilter';
import { commercialGroups, type CommercialRow } from './commercialIntelligenceData';
import { getDealStatusBadge } from '@/lib/sales/dealStatusBadge';

export default function CommercialIntelligence() {
  const [period, setPeriod] = useState<PeriodValue>({ preset: 'month' });
  const range = useMemo(() => resolvePeriod(period), [period]);
  const { data: rows = [], isLoading, error } = useCommercialIntelligence(range.startDate, range.endDate);
  const [dimension, setDimension] = useState<'channel' | 'origin'>('channel');
  const [channel, setChannel] = useState('all');
  const [origin, setOrigin] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CommercialRow | null>(null);
  const [page, setPage] = useState(0);
  const filtered = rows.filter(r => (channel === 'all' || r.channel === channel) && (origin === 'all' || r.origins.includes(origin)) && `${r.name} ${r.instagram ?? ''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const groups = commercialGroups(filtered, dimension);
  const channels = [...new Set(rows.map(r => r.channel))].sort();
  const origins = [...new Set(rows.flatMap(r => r.origins))].sort();
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 20) - 1));
  const metrics = [
    { label: 'Negócios / leads', value: filtered.length, Icon: Users },
    { label: 'MQL', value: filtered.filter(r => r.mql).length, Icon: Target },
    { label: 'Vendas', value: filtered.filter(r => r.status === 'won').length, Icon: CheckCircle2 },
  ];
  return <div className="container mx-auto min-w-0 space-y-6 py-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="flex items-center gap-2 text-xl font-semibold"><BarChart3 className="h-5 w-5 text-primary" />Aquisição e vendas</h2><p className="mt-1 text-sm text-muted-foreground">Negócios criados no período · dados do Comercial</p></div>
      <DashboardPeriodFilter value={period} onChange={v => { setPeriod(v); setPage(0); }} />
    </div>
    <div className="flex flex-wrap gap-3">
      <Select value={channel} onValueChange={v => { setChannel(v); setPage(0); }}><SelectTrigger aria-label="Filtrar canal" className="w-full sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os canais</SelectItem>{channels.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
      <Select value={origin} onValueChange={v => { setOrigin(v); setPage(0); }}><SelectTrigger aria-label="Filtrar origem de aquisição" className="w-full sm:w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as origens / perfis</SelectItem>{origins.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
      <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar lead ou Instagram" placeholder="Nome ou @ do lead" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" /></div>
    </div>
    {error ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar os dados comerciais.</p> : isLoading ? <Skeleton className="h-80 w-full" /> : <>
      <div className="grid grid-cols-3 gap-3 border-y py-5">{metrics.map(({ label, value, Icon }) => <div key={label} className="min-w-0 space-y-2"><span className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4 shrink-0 text-primary" />{label}</span><p className="text-2xl font-semibold tabular-nums">{value.toLocaleString('pt-BR')}</p></div>)}</div>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Resultado por {dimension === 'channel' ? 'canal' : 'origem / perfil'}</h3><Select value={dimension} onValueChange={v => setDimension(v === 'origin' ? 'origin' : 'channel')}><SelectTrigger aria-label="Agrupar resultados" className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="channel">Canal</SelectItem><SelectItem value="origin">Origem / perfil</SelectItem></SelectContent></Select></div>
        {groups.length ? <div className="w-full" style={{ height: Math.max(240, groups.length * 64) }}><ResponsiveContainer width="100%" height="100%"><BarChart data={groups} layout="vertical" margin={{ left: 0, right: 15, top: 8, bottom: 8 }}><CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 6" /><XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} /><YAxis type="category" dataKey="label" width={125} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} /><Tooltip content={({ active, payload, label }) => active && payload?.length ? <div className="rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-lg"><p className="mb-2 font-semibold">{label}</p>{payload.map(v => <p key={String(v.dataKey)} className="flex justify-between gap-6 py-1">{v.name}<strong>{Number(v.value).toLocaleString('pt-BR')}</strong></p>)}</div> : null} /><Bar dataKey="leads" name="Leads" fill="hsl(var(--info))" radius={[0, 3, 3, 0]} maxBarSize={12} /><Bar dataKey="mql" name="MQL" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} maxBarSize={12} /><Bar dataKey="sales" name="Vendas" fill="hsl(var(--success))" radius={[0, 3, 3, 0]} maxBarSize={12} /></BarChart></ResponsiveContainer></div> : <p className="py-12 text-center text-sm text-muted-foreground">Nenhum negócio neste período e filtros.</p>}
        <div className="flex justify-center gap-5 text-xs"><span className="text-info">● Leads</span><span className="text-primary">● MQL</span><span className="text-success">● Vendas</span></div>
        {dimension === 'origin' && <p className="text-xs text-muted-foreground">Um negócio com várias origens aparece em cada origem cadastrada; não há atribuição automática por perfil.</p>}
      </section>
      <section><div className="mb-3 flex justify-between gap-3"><h3 className="font-semibold">Leads e histórico comercial</h3><span className="text-xs text-muted-foreground">{filtered.length.toLocaleString('pt-BR')} negócios</span></div>
        <div className="divide-y border-y">{filtered.slice(safePage * 20, safePage * 20 + 20).map(row => {
          const status = getDealStatusBadge(row.status);
          return <div key={row.id} className="flex min-w-0 items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{row.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{row.channel} · {row.origins.join(', ') || 'Sem origem'}</p>{row.instagram && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Instagram className="h-3 w-3" /><span className="truncate">{row.instagram}</span></p>}</div><div className="flex shrink-0 flex-col items-end gap-1.5">{status && <Badge variant="outline" className={status.className}>{status.label}</Badge>}{row.mql && <span className="text-xs font-medium text-primary">MQL</span>}</div><Button variant="ghost" size="icon" aria-label={`Ver histórico de ${row.name}`} title="Ver histórico" disabled={!row.leadId} onClick={() => setSelected(row)}><History className="h-4 w-4" /></Button></div>;
        })}</div>
        <div className="mt-3 flex items-center justify-end gap-3"><Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Anterior</Button><span className="text-xs tabular-nums text-muted-foreground">{safePage + 1} / {Math.max(1, Math.ceil(filtered.length / 20))}</span><Button variant="outline" size="sm" disabled={(safePage + 1) * 20 >= filtered.length} onClick={() => setPage(safePage + 1)}>Próxima</Button></div>
      </section>
    </>}
    <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}><DialogContent className="flex max-h-[86vh] max-w-2xl flex-col overflow-hidden"><DialogHeader><DialogTitle>Histórico de {selected?.name}</DialogTitle></DialogHeader><div className="min-h-0 flex-1 overflow-y-auto">{selected?.leadId && <LeadTimeline leadId={selected.leadId} />}</div><div className="flex flex-wrap justify-end gap-2 border-t pt-3">{selected?.leadId && <Button variant="outline" asChild><a href={`/leads?lead=${selected.leadId}`}>Abrir ficha do lead <ExternalLink className="ml-2 h-4 w-4" /></a></Button>}{selected && <Button variant="outline" asChild><a href={`/pipeline?deal=${selected.id}`}>Abrir negócio <ExternalLink className="ml-2 h-4 w-4" /></a></Button>}</div></DialogContent></Dialog>
  </div>;
}