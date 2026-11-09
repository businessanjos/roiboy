import { DashboardPeriodFilter, resolvePeriod, type PeriodValue } from './DashboardPeriodFilter';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths, startOfMonth, endOfMonth, startOfWeek, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Users, Eye, PlaySquare, Heart, MessageCircle, Percent, Youtube, ExternalLink, Zap, Film, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';

const compact = (n: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
const full = (n: number) => Math.round(n || 0).toLocaleString('pt-BR');
const pct = (n: number) => `${(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

interface VideoRow {
  id: string; channel_id: string; title: string | null; video_url: string | null; thumbnail_url: string | null;
  posted_at: string | null; video_type: string; views: number; likes: number; comments: number;
}

function Kpi({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <div className="rounded-lg bg-primary/10 p-1.5"><Icon className="h-4 w-4 text-primary" /></div>
        </div>
        <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-semibold tabular-nums">{full(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

export function YouTubeDashboard() {
  const { currentUser: user } = useCurrentUser();
  const [period, setPeriod] = useState<PeriodValue>({ preset: '3m' });

  const range = useMemo(() => resolvePeriod(period), [period]);

  const { data, isLoading } = useQuery({
    queryKey: ['youtube-dashboard', user?.account_id, range],
    queryFn: async () => {
      if (!user?.account_id) return null;
      const { data: channels, error } = await supabase.from('youtube_channels').select('*')
        .eq('account_id', user.account_id).eq('is_active', true).order('subscribers_count', { ascending: false });
      if (error) throw error;
      if (!channels?.length) return { channels: [], videos: [] as VideoRow[] };
      const { data: videos, error: vErr } = await supabase.from('youtube_videos')
        .select('id, channel_id, title, video_url, thumbnail_url, posted_at, video_type, views, likes, comments')
        .in('channel_id', channels.map(c => c.id))
        .gte('posted_at', range.startDate.toISOString()).lte('posted_at', range.endDate.toISOString())
        .order('posted_at', { ascending: true });
      if (vErr) throw vErr;
      return { channels, videos: (videos || []) as VideoRow[] };
    },
    enabled: !!user?.account_id,
  });

  const channels = data?.channels || [];
  const videos = data?.videos || [];

  const stats = useMemo(() => {
    const views = videos.reduce((s, v) => s + (v.views || 0), 0);
    const likes = videos.reduce((s, v) => s + (v.likes || 0), 0);
    const comments = videos.reduce((s, v) => s + (v.comments || 0), 0);
    const n = videos.length;
    const shorts = videos.filter(v => v.video_type === 'short');
    const longs = videos.filter(v => v.video_type !== 'short');
    const sum = (arr: VideoRow[]) => arr.reduce((s, v) => s + (v.views || 0), 0);
    return {
      subs: channels.reduce((s, c: any) => s + (c.subscribers_count || 0), 0),
      totalViews: channels.reduce((s, c: any) => s + (c.total_views || 0), 0),
      totalVideos: channels.reduce((s, c: any) => s + (c.videos_count || 0), 0),
      views, likes, comments, n,
      avgViews: n ? views / n : 0,
      engagement: views ? ((likes + comments) / views) * 100 : 0,
      shorts: { count: shorts.length, views: sum(shorts), avg: shorts.length ? sum(shorts) / shorts.length : 0 },
      longs: { count: longs.length, views: sum(longs), avg: longs.length ? sum(longs) / longs.length : 0 },
    };
  }, [channels, videos]);

  const timeline = useMemo(() => {
    const weekly = differenceInCalendarDays(range.endDate, range.startDate) <= 120;
    const map = new Map<string, { label: string; views: number; likes: number; videos: number; sort: number }>();
    videos.forEach(v => {
      if (!v.posted_at) return;
      const d = new Date(v.posted_at);
      const key = weekly ? startOfWeek(d, { weekStartsOn: 1 }) : startOfMonth(d);
      const id = key.toISOString();
      const cur = map.get(id) || { label: format(key, weekly ? 'dd/MM' : 'MMM/yy', { locale: ptBR }), views: 0, likes: 0, videos: 0, sort: key.getTime() };
      cur.views += v.views || 0; cur.likes += v.likes || 0; cur.videos += 1;
      map.set(id, cur);
    });
    return { weekly, rows: [...map.values()].sort((a, b) => a.sort - b.sort) };
  }, [videos, range]);

  const top = useMemo(() => [...videos].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 6), [videos]);

  if (isLoading) return <div className="space-y-6"><div className="grid grid-cols-2 gap-4 lg:grid-cols-6">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-80" /></div>;

  if (!channels.length) return <Card className="p-12"><div className="space-y-4 text-center"><Youtube className="mx-auto h-12 w-12 text-primary" /><div><h3 className="text-lg font-semibold">Nenhum canal encontrado</h3><p className="text-muted-foreground">Adicione um canal na aba "Canais" para ver o painel.</p></div></div></Card>;

  const split = [
    { name: 'Vídeos longos', value: stats.longs.views, color: 'hsl(var(--primary))' },
    { name: 'Shorts', value: stats.shorts.views, color: 'hsl(var(--primary) / 0.4)' },
  ];
  const lastSync = channels.map((c: any) => c.last_synced_at).filter(Boolean).sort().pop();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Visão Consolidada YouTube</h2>
          <p className="text-xs text-muted-foreground">
            {lastSync ? `Atualizado em ${format(new Date(lastSync), "dd/MM 'às' HH:mm")}` : 'Ainda não sincronizado — use Sincronizar na aba Canais'}
          </p>
        </div>
        <DashboardPeriodFilter value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Users} label="Inscritos" value={compact(stats.subs)} hint={`${full(stats.subs)} no total`} />
        <Kpi icon={Eye} label="Views do canal" value={compact(stats.totalViews)} hint={`${full(stats.totalVideos)} vídeos publicados`} />
        <Kpi icon={PlaySquare} label="Views no período" value={compact(stats.views)} hint={`${stats.n} vídeos no período`} />
        <Kpi icon={Eye} label="Média por vídeo" value={compact(stats.avgViews)} hint="views no período" />
        <Kpi icon={Heart} label="Curtidas" value={compact(stats.likes)} hint={`${compact(stats.comments)} comentários`} />
        <Kpi icon={Percent} label="Engajamento" value={pct(stats.engagement)} hint="curtidas + comentários / views" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Visualizações por {timeline.weekly ? 'semana' : 'mês'} de publicação</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {timeline.rows.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline.rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ytViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tickFormatter={compact} tickLine={false} axisLine={false} fontSize={11} width={44} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="views" name="Views" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#ytViews)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Nenhum vídeo publicado no período.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Vídeos longos x Shorts</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={split} dataKey="value" nameKey="name" innerRadius={45} outerRadius={68} paddingAngle={2} stroke="none">
                    {split.map(s => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 space-y-2">
              {[{ icon: Film, name: 'Vídeos longos', d: stats.longs, color: split[0].color }, { icon: Zap, name: 'Shorts', d: stats.shorts, color: split[1].color }].map(r => (
                <div key={r.name} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} /><r.icon className="h-3.5 w-3.5 text-muted-foreground" />{r.name}</span>
                  <span className="text-right text-xs text-muted-foreground"><span className="font-semibold text-foreground tabular-nums">{r.d.count}</span> vídeos · média {compact(r.d.avg)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Publicações por {timeline.weekly ? 'semana' : 'mês'}</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeline.rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={28} stroke="hsl(var(--muted-foreground))" />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} />
                <Bar dataKey="videos" name="Vídeos" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4 text-primary" />Mais vistos no período</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {top.length ? top.map((v, i) => (
              <a key={v.id} href={v.video_url || '#'} target="_blank" rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-lg border p-2 transition-colors hover:bg-muted/50">
                <span className="w-5 text-center text-sm font-bold text-muted-foreground tabular-nums">{i + 1}</span>
                <div className="h-11 w-[76px] shrink-0 overflow-hidden rounded-md bg-muted">
                  {v.thumbnail_url && <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={v.title || ''}>{v.title || 'Sem título'}</p>
                  <p className="text-xs text-muted-foreground">{v.posted_at ? format(new Date(v.posted_at), 'dd/MM/yyyy') : '—'}
                    {v.video_type === 'short' && <Badge variant="outline" className="ml-2 px-1 py-0 text-[10px]">Short</Badge>}
                  </p>
                </div>
                <div className="grid shrink-0 grid-cols-3 gap-3 text-right text-xs tabular-nums">
                  <span className="flex items-center justify-end gap-1 font-semibold"><Eye className="h-3 w-3 text-muted-foreground" />{compact(v.views)}</span>
                  <span className="flex items-center justify-end gap-1"><Heart className="h-3 w-3 text-muted-foreground" />{compact(v.likes)}</span>
                  <span className="flex items-center justify-end gap-1"><MessageCircle className="h-3 w-3 text-muted-foreground" />{compact(v.comments)}</span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </a>
            )) : <p className="py-8 text-center text-sm text-muted-foreground">Nenhum vídeo no período.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Canais</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {channels.map((ch: any) => {
            const cv = videos.filter(v => v.channel_id === ch.id);
            const vViews = cv.reduce((s, v) => s + (v.views || 0), 0);
            return (
              <div key={ch.id} className="grid grid-cols-2 items-center gap-3 rounded-lg border p-3 md:grid-cols-[minmax(200px,1.5fr)_repeat(4,1fr)]">
                <div className="col-span-2 flex items-center gap-3 md:col-span-1">
                  <Avatar className="h-10 w-10 ring-2 ring-primary/40"><AvatarImage src={ch.profile_picture_url || undefined} draggable={false} /><AvatarFallback>{ch.username.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                  <div className="min-w-0"><p className="truncate font-medium">@{ch.username}</p><p className="truncate text-xs text-muted-foreground">{ch.display_name}</p></div>
                </div>
                {[['Inscritos', compact(ch.subscribers_count)], ['Views totais', compact(ch.total_views)], ['Vídeos no período', String(cv.length)], ['Média por vídeo', compact(cv.length ? vViews / cv.length : 0)]].map(([l, v]) => (
                  <div key={l} className="text-right md:text-center">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</p>
                    <p className={cn('text-base font-semibold tabular-nums')}>{v}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
