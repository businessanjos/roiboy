import { useMemo, useState } from 'react';
import { BarChart3, History, Instagram, Search, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { LeadTimeline } from '@/components/leads/LeadTimeline';
import { useCommercialIntelligence } from '@/hooks/useCommercialIntelligence';
import { DashboardPeriodFilter, resolvePeriod, type PeriodValue } from './DashboardPeriodFilter';
import { type CommercialRow } from './commercialIntelligenceData';
import { CommercialAnalytics } from './CommercialAnalytics';
import { ChannelFocusPanel } from './ChannelFocusPanel';
import { getDealStatusBadge } from '@/lib/sales/dealStatusBadge';

export default function CommercialIntelligence() {
  const [period, setPeriod] = useState<PeriodValue>({ preset: '6m' });
  const range = useMemo(() => resolvePeriod(period), [period]);
  const { data: rows = [], isLoading, error } = useCommercialIntelligence(range.startDate, range.endDate);
  const [channel, setChannelRaw] = useState<string | null>(null);
  const [origin, setOrigin] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CommercialRow | null>(null);
  const [page, setPage] = useState(0);
  const matchesSearch = (r: CommercialRow) => `${r.name} ${r.instagram ?? ''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'));
  const defaultChannel = rows.some(r => r.channel === 'Orgânico') ? 'Orgânico' : 'all';
  const channelValue = channel ?? defaultChannel;
  const setChannel = (v: string | ((c: string) => string)) => setChannelRaw(typeof v === 'function' ? v(channelValue) : v);
  const matchesOrigin = (r: CommercialRow) => origin === 'all' || (origin === '__none__' ? r.origins.length === 0 : r.origins.includes(origin));
  const rankingRows = { channel: rows.filter(r => matchesSearch(r) && matchesOrigin(r)), origin: rows.filter(r => matchesSearch(r) && (channelValue === 'all' || r.channelValue === channelValue)) };
  const filtered = rows.filter(r => (channelValue === 'all' || r.channelValue === channelValue) && (origin === 'all' || (origin === '__none__' ? r.origins.length === 0 : r.origins.includes(origin))) && `${r.name} ${r.instagram ?? ''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const channels = [...new Set(rows.map(r => r.channel))].sort();
  const origins = [...new Set(rows.flatMap(r => r.origins))].sort();
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 20) - 1));
  return <div className="container mx-auto min-w-0 space-y-6 py-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="flex items-center gap-2 text-xl font-semibold"><BarChart3 className="h-5 w-5 text-primary" />Inteligência comercial</h2><p className="mt-1 text-sm text-muted-foreground">Negócios criados no período · dados do Comercial</p></div>
      <DashboardPeriodFilter value={period} onChange={v => { setPeriod(v); setPage(0); }} />
    </div>
    <div className="flex flex-wrap gap-3">
      <Select value={channelValue} onValueChange={v => { setChannel(v); setPage(0); }}><SelectTrigger aria-label="Filtrar canal" className="w-full sm:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os canais</SelectItem>{channels.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
      <Select value={origin} onValueChange={v => { setOrigin(v); setPage(0); }}><SelectTrigger aria-label="Filtrar origem de aquisição" className="w-full sm:w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as origens / perfis</SelectItem><SelectItem value="__none__">Sem origem</SelectItem>{origins.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
      <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar lead ou Instagram" placeholder="Nome ou @ do lead" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" /></div>
    </div>
    {channels.length > 1 && <div className="flex flex-wrap gap-2" role="group" aria-label="Comparar canais">{['all', ...channels].map(c => { const count = c === 'all' ? rankingRows.channel.length : rankingRows.channel.filter(r => r.channelValue === c).length; return <Button key={c} size="sm" variant={channelValue === c ? 'default' : 'outline'} className="h-8 rounded-full" aria-pressed={channelValue === c} onClick={() => { setChannel(c); setPage(0); }}>{c === 'all' ? 'Todos' : c}<span className="ml-1.5 tabular-nums opacity-70">{count}</span></Button>; })}</div>}
    {(channelValue !== defaultChannel || origin !== 'all' || search) && <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{channelValue !== 'all' ? channelValue : 'Todos os canais'} · {origin === '__none__' ? 'Sem origem' : origin !== 'all' ? origin : 'Todas as origens'}</span><Button variant="ghost" size="sm" onClick={() => { setChannelRaw(null); setOrigin('all'); setSearch(''); setPage(0); }}>Limpar filtros</Button></div>}
    {error ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar os dados comerciais.</p> : isLoading ? <Skeleton className="h-80 w-full" /> : <>
      {channelValue !== 'all' && <ChannelFocusPanel allRows={rankingRows.channel} focus={channelValue} />}
      <CommercialAnalytics rows={filtered} rankingRows={rankingRows} selected={{ channel: channelValue, origin: origin === '__none__' ? 'Sem origem' : origin }} onSelectGroup={(dimension, label) => { if (dimension === 'channel') setChannel(c => c === label ? 'all' : label); else { const v = label === 'Sem origem' ? '__none__' : label; setOrigin(o => o === v ? 'all' : v); } setPage(0); }} />
      <section><div className="mb-3 flex justify-between gap-3"><h3 className="font-semibold">Leads e histórico comercial</h3><span className="text-xs text-muted-foreground">{filtered.length.toLocaleString('pt-BR')} negócios</span></div>
        <div className="divide-y border-y">{filtered.slice(safePage * 20, safePage * 20 + 20).map(row => {
          const status = getDealStatusBadge(row.status);
          return <div key={row.id} className="flex min-w-0 items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{row.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{row.channel} · {row.origins.join(', ') || 'Sem origem'}</p>{row.instagram && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Instagram className="h-3 w-3" /><span className="truncate">{row.instagram}</span></p>}</div><div className="flex shrink-0 flex-col items-end gap-1.5">{status && <Badge variant="outline" className={status.className}>{status.label}</Badge>}{row.mql && <span className="text-xs font-medium text-primary">MQL</span>}</div><Button variant="ghost" size="icon" aria-label={`Ver histórico de ${row.name}`} title="Ver histórico" disabled={!row.leadId} onClick={() => setSelected(row)}><History className="h-4 w-4" /></Button></div>;
        })}</div>
        <div className="mt-3 flex items-center justify-end gap-3"><Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Anterior</Button><span className="text-xs tabular-nums text-muted-foreground">{safePage + 1} / {Math.max(1, Math.ceil(filtered.length / 20))}</span><Button variant="outline" size="sm" disabled={(safePage + 1) * 20 >= filtered.length} onClick={() => setPage(safePage + 1)}>Próxima</Button></div>
      </section>
    </>}
    <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}><DialogContent className="flex max-h-[86vh] max-w-2xl flex-col overflow-hidden"><DialogHeader><DialogTitle>Histórico de {selected?.name}</DialogTitle></DialogHeader><div className="min-h-0 flex-1 overflow-y-auto">{selected?.leadId && <LeadTimeline leadId={selected.leadId} readOnly />}</div><div className="flex flex-wrap justify-end gap-2 border-t pt-3">{selected?.leadId && <Button variant="outline" asChild><a href={`/leads?lead=${selected.leadId}`}>Abrir ficha do lead <ExternalLink className="ml-2 h-4 w-4" /></a></Button>}{selected && <Button variant="outline" asChild><a href={`/pipeline?deal=${selected.id}`}>Abrir negócio <ExternalLink className="ml-2 h-4 w-4" /></a></Button>}</div></DialogContent></Dialog>
  </div>;
}