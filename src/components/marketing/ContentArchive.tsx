import { useMemo, useState } from 'react';
import { Search, ExternalLink, Library, RefreshCw } from 'lucide-react';
import { useContentArchive } from '@/hooks/useContentArchive';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePagedList } from '@/hooks/usePagedList';
import { PagerFor } from '@/components/ui/list-pagination';
import { DashboardPeriodFilter, resolvePeriod, type PeriodValue } from './DashboardPeriodFilter';
import type { ArchivePost } from '../../../supabase/functions/_shared/contentArchive';

const fieldLabels: Record<string, string> = { reach: 'Alcance', views: 'Visualizações', likes: 'Curtidas', comments: 'Comentários', shares: 'Compartilhamentos', saves: 'Salvamentos', link_clicks: 'Cliques no link', engagement_rate: 'Engajamento (%)', virality_rate: 'Viralidade (%)', followers_gained: 'Seguidores conquistados', profile_visits: 'Visitas ao perfil', reposts: 'Republicações', post_type: 'Formato', video_type: 'Formato', theme: 'Categoria', category: 'Categoria', ai_objective: 'Objetivo', hashtags: 'Hashtags', hook: 'Hook', script: 'Roteiro', cta: 'CTA', status: 'Status', composition: 'Composição', sound_name: 'Áudio', collaborator: 'Colaboração', specialist_version: 'Versão especialista' };

export function ContentArchive() {
  const { data: posts = [], isLoading, error, refetch, isFetching } = useContentArchive();
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('all');
  const [profile, setProfile] = useState('all');
  const [period, setPeriod] = useState<PeriodValue>({ preset: 'all' });
  const [selected, setSelected] = useState<ArchivePost | null>(null);
  const range = resolvePeriod(period);
  const filtered = useMemo(() => posts.filter(p => {
    const text = `${p.title} ${p.caption} ${p.profile} ${JSON.stringify(p.details)}`.toLowerCase();
    const date = p.date ? new Date(p.date).getTime() : null;
    return (platform === 'all' || platform === p.platform) && (profile === 'all' || profile === p.profile) && text.includes(search.toLowerCase()) && (period.preset === 'all' || (date !== null && date >= range.startDate.getTime() && date <= range.endDate.getTime()));
  }), [posts, platform, profile, search, period]);
  const pg = usePagedList(filtered, { resetKey: [platform, profile, search, period], isLoading });
  if (isLoading) return <Skeleton className="h-80 w-full" />;
  return <section className="min-w-0 space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><Library className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Todos os conteúdos</h2><Badge variant="secondary">{posts.length.toLocaleString('pt-BR')}</Badge></div>
      <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label="Atualizar conteúdos" title="Atualizar conteúdos"><RefreshCw className="h-4 w-4" /></Button>
    </header>
    <div className="flex flex-wrap gap-2">
      <div className="relative min-w-[180px] flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="Buscar conteúdos" placeholder="Buscar título, legenda ou tema" value={search} onChange={e => setSearch(e.target.value)} /></div>
      <Select value={platform} onValueChange={setPlatform}><SelectTrigger className="w-36" aria-label="Rede dos conteúdos"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as redes</SelectItem>{[...new Set(posts.map(p => p.platform))].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
      <Select value={profile} onValueChange={setProfile}><SelectTrigger className="w-44" aria-label="Perfil dos conteúdos"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os perfis</SelectItem>{[...new Set(posts.map(p => p.profile))].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
      <DashboardPeriodFilter value={period} onChange={setPeriod} />
    </div>
    {error && <p role="alert" className="text-sm text-destructive">Não foi possível carregar os conteúdos. Tente atualizar.</p>}
    <div className="divide-y rounded-lg border">
      {pg.items.map(post => <Button key={post.id} variant="ghost" onClick={() => setSelected(post)} className="h-auto w-full justify-start gap-3 rounded-none px-3 py-3 text-left font-normal">
        <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">{post.thumbnail ? <img src={post.thumbnail} alt="" className="h-full w-full object-cover" draggable={false} onError={e => { e.currentTarget.style.display = 'none'; }} /> : <Library className="h-5 w-5 text-muted-foreground" />}</div>
        <div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="capitalize">{post.platform}</span><span>{post.profile}</span>{post.date && <span>{new Date(post.date).toLocaleDateString('pt-BR')}</span>}</div><p className="line-clamp-2 whitespace-normal break-words text-sm font-medium">{post.title || post.caption || 'Sem legenda'}</p></div>
      </Button>)}
      {!filtered.length && !error && <p className="p-6 text-center text-sm text-muted-foreground">Nenhum conteúdo encontrado.</p>}
    </div>
    <PagerFor state={pg} itemLabel="conteúdos" />
    <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}><DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden"><DialogHeader><DialogTitle>{selected?.title || 'Detalhes do conteúdo'}</DialogTitle></DialogHeader>{selected && <div className="min-h-0 space-y-4 overflow-y-auto pr-1"><div className="flex flex-wrap gap-2"><Badge variant="secondary">{selected.platform}</Badge><Badge variant="outline">{selected.profile}</Badge>{selected.url && <Button variant="outline" size="sm" asChild><a href={selected.url} target="_blank" rel="noopener noreferrer">Abrir publicação <ExternalLink className="ml-2 h-3.5 w-3.5" /></a></Button>}</div><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{selected.caption || 'Sem legenda cadastrada'}</p><dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">{Object.entries(fieldLabels).filter(([key]) => selected.details[key] !== null && selected.details[key] !== undefined && selected.details[key] !== '').map(([key, label]) => <div key={key} className="min-w-0 border-t pt-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">{typeof selected.details[key] === 'number' ? Number(selected.details[key]).toLocaleString('pt-BR') : Array.isArray(selected.details[key]) ? (selected.details[key] as unknown[]).join(', ') : String(selected.details[key])}</dd></div>)}</dl></div>}</DialogContent></Dialog>
  </section>;
}