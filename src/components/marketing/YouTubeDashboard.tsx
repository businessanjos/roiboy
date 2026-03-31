import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import {
  Users, Percent, Eye, TrendingUp, TrendingDown, Minus, ExternalLink, BarChart3, Youtube,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';

interface ChannelWithMetrics {
  id: string;
  username: string;
  display_name: string | null;
  profile_picture_url: string | null;
  subscribers_count: number;
  subscribers_previous_count: number;
  videos_count: number;
  total_views: number;
  avg_views: number;
  avg_likes: number;
  avg_comments: number;
  avg_completion_rate: number;
  avg_engagement: number;
  shorts_count: number;
  videos_long_count: number;
}

type SortField = 'subscribers' | 'engagement' | 'views' | 'completion' | 'likes';
type SortDirection = 'asc' | 'desc';

export function YouTubeDashboard() {
  const { currentUser: user } = useCurrentUser();
  const [monthFilter, setMonthFilter] = useState<string>('3');
  const [sortField, setSortField] = useState<SortField>('subscribers');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const dateRange = useMemo(() => {
    const months = parseInt(monthFilter);
    return { startDate: startOfMonth(subMonths(new Date(), months - 1)), endDate: endOfMonth(new Date()) };
  }, [monthFilter]);

  const { data: channelsWithMetrics = [], isLoading } = useQuery({
    queryKey: ['youtube-dashboard', user?.account_id, dateRange],
    queryFn: async () => {
      if (!user?.account_id) return [];
      const { data: channels, error: chErr } = await supabase.from('youtube_channels').select('*').eq('account_id', user.account_id).eq('is_active', true).order('subscribers_count', { ascending: false });
      if (chErr) throw chErr;
      if (!channels?.length) return [];

      const channelIds = channels.map(c => c.id);
      const { data: videos, error: vErr } = await supabase.from('youtube_videos').select('channel_id, video_type, views, likes, comments, shares, saves, completion_rate, engagement_rate').in('channel_id', channelIds).gte('posted_at', dateRange.startDate.toISOString()).lte('posted_at', dateRange.endDate.toISOString());
      if (vErr) throw vErr;

      return channels.map((ch) => {
        const chVideos = videos?.filter(v => v.channel_id === ch.id) || [];
        const count = chVideos.length;
        const totalViews = chVideos.reduce((s, v) => s + (v.views || 0), 0);
        const totalLikes = chVideos.reduce((s, v) => s + (v.likes || 0), 0);
        const totalComments = chVideos.reduce((s, v) => s + (v.comments || 0), 0);
        const totalCompletion = chVideos.reduce((s, v) => s + (v.completion_rate || 0), 0);
        const totalEngagement = chVideos.reduce((s, v) => s + (v.engagement_rate || 0), 0);
        return {
          id: ch.id, username: ch.username, display_name: ch.display_name, profile_picture_url: ch.profile_picture_url,
          subscribers_count: ch.subscribers_count || 0, subscribers_previous_count: ch.subscribers_previous_count || 0,
          videos_count: ch.videos_count || 0, total_views: ch.total_views || 0,
          avg_views: count > 0 ? Math.round(totalViews / count) : 0,
          avg_likes: count > 0 ? Math.round(totalLikes / count) : 0,
          avg_comments: count > 0 ? Math.round(totalComments / count) : 0,
          avg_completion_rate: count > 0 ? Math.round((totalCompletion / count) * 10) / 10 : 0,
          avg_engagement: count > 0 ? Math.round((totalEngagement / count) * 10) / 10 : 0,
          shorts_count: chVideos.filter(v => v.video_type === 'short').length,
          videos_long_count: chVideos.filter(v => v.video_type === 'video').length,
        } as ChannelWithMetrics;
      });
    },
    enabled: !!user?.account_id,
  });

  const sortedChannels = useMemo(() => {
    return [...channelsWithMetrics].sort((a, b) => {
      const vals: Record<SortField, [number, number]> = {
        subscribers: [a.subscribers_count, b.subscribers_count],
        engagement: [a.avg_engagement, b.avg_engagement],
        views: [a.avg_views, b.avg_views],
        completion: [a.avg_completion_rate, b.avg_completion_rate],
        likes: [a.avg_likes, b.avg_likes],
      };
      const [aV, bV] = vals[sortField];
      return sortDirection === 'desc' ? bV - aV : aV - bV;
    });
  }, [channelsWithMetrics, sortField, sortDirection]);

  const totals = useMemo(() => {
    const totalSubs = channelsWithMetrics.reduce((s, c) => s + c.subscribers_count, 0);
    const totalVids = channelsWithMetrics.reduce((s, c) => s + c.videos_count, 0);
    const avgEng = channelsWithMetrics.length > 0 ? channelsWithMetrics.reduce((s, c) => s + c.avg_engagement, 0) / channelsWithMetrics.length : 0;
    const avgComp = channelsWithMetrics.length > 0 ? channelsWithMetrics.reduce((s, c) => s + c.avg_completion_rate, 0) / channelsWithMetrics.length : 0;
    return { totalSubs, totalVids, avgEng: Math.round(avgEng * 10) / 10, avgComp: Math.round(avgComp * 10) / 10, channelCount: channelsWithMetrics.length };
  }, [channelsWithMetrics]);

  const fmt = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toString();

  const handleSort = (f: SortField) => {
    if (sortField === f) setSortDirection(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(f); setSortDirection('desc'); }
  };

  const growth = (cur: number, prev: number) => {
    if (prev === 0) return null;
    const g = ((cur - prev) / prev) * 100;
    if (g > 0) return <span className="flex items-center gap-0.5 text-green-600 text-xs"><TrendingUp className="h-3 w-3" />{Math.round(g)}%</span>;
    if (g < 0) return <span className="flex items-center gap-0.5 text-red-600 text-xs"><TrendingDown className="h-3 w-3" />{Math.abs(Math.round(g))}%</span>;
    return <span className="flex items-center gap-0.5 text-muted-foreground text-xs"><Minus className="h-3 w-3" /></span>;
  };

  const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead className={cn('cursor-pointer hover:bg-muted/50 transition-colors select-none', className)} onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1 justify-end">{children}{sortField === field && <span className="text-primary">{sortDirection === 'desc' ? '↓' : '↑'}</span>}</div>
    </TableHead>
  );

  if (isLoading) return <div className="space-y-6"><div className="grid grid-cols-1 md:grid-cols-5 gap-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-96" /></div>;

  if (!channelsWithMetrics.length) return <Card className="p-12"><div className="text-center space-y-4"><Youtube className="h-12 w-12 mx-auto text-red-600" /><div><h3 className="text-lg font-semibold">Nenhum canal encontrado</h3><p className="text-muted-foreground">Adicione canais do YouTube na aba "Perfis" para visualizar o dashboard.</p></div></div></Card>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Visão Consolidada YouTube</h2>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[180px] bg-card"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent><SelectItem value="1">Último mês</SelectItem><SelectItem value="3">Últimos 3 meses</SelectItem><SelectItem value="6">Últimos 6 meses</SelectItem><SelectItem value="12">Último ano</SelectItem></SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-red-500/10"><Users className="h-5 w-5 text-red-600" /></div><div><p className="text-sm text-muted-foreground">Total Inscritos</p><p className="text-2xl font-bold">{fmt(totals.totalSubs)}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-green-500/10"><Percent className="h-5 w-5 text-green-600" /></div><div><p className="text-sm text-muted-foreground">Engaj. Médio</p><p className="text-2xl font-bold">{totals.avgEng}%</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-cyan-500/10"><Eye className="h-5 w-5 text-cyan-600" /></div><div><p className="text-sm text-muted-foreground">Retenção Média</p><p className="text-2xl font-bold">{totals.avgComp}%</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-blue-500/10"><Eye className="h-5 w-5 text-blue-600" /></div><div><p className="text-sm text-muted-foreground">Total Vídeos</p><p className="text-2xl font-bold">{fmt(totals.totalVids)}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-purple-500/10"><BarChart3 className="h-5 w-5 text-purple-600" /></div><div><p className="text-sm text-muted-foreground">Canais Ativos</p><p className="text-2xl font-bold">{totals.channelCount}</p></div></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">Métricas por Canal</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[250px]">Canal</TableHead>
                  <SortableHeader field="subscribers" className="text-right">Inscritos</SortableHeader>
                  <TableHead className="text-right">Vídeos</TableHead>
                  <SortableHeader field="views" className="text-right">Méd. Views</SortableHeader>
                  <SortableHeader field="engagement" className="text-right">Engaj. %</SortableHeader>
                  <SortableHeader field="completion" className="text-right">Retenção %</SortableHeader>
                  <SortableHeader field="likes" className="text-right">Méd. Curtidas</SortableHeader>
                  <TableHead className="text-right">Méd. Comentários</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedChannels.map((ch) => (
                  <TableRow key={ch.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-red-200"><AvatarImage src={ch.profile_picture_url || undefined} /><AvatarFallback className="bg-gradient-to-br from-red-600 to-red-800 text-white text-sm">{ch.username.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                        <div><p className="font-medium">@{ch.username}</p>{ch.display_name && <p className="text-xs text-muted-foreground">{ch.display_name}</p>}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right"><div className="flex flex-col items-end gap-0.5"><span className="font-medium">{fmt(ch.subscribers_count)}</span>{growth(ch.subscribers_count, ch.subscribers_previous_count)}</div></TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span>{fmt(ch.videos_count)}</span>
                        <div className="flex gap-1">
                          {ch.videos_long_count > 0 && <Badge variant="outline" className="text-[10px] px-1">📹 {ch.videos_long_count}</Badge>}
                          {ch.shorts_count > 0 && <Badge variant="outline" className="text-[10px] px-1">⚡ {ch.shorts_count}</Badge>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{fmt(ch.avg_views)}</TableCell>
                    <TableCell className="text-right"><span className={cn('font-medium', ch.avg_engagement > 5 ? 'text-green-600' : ch.avg_engagement > 2 ? 'text-amber-600' : 'text-red-600')}>{ch.avg_engagement}%</span></TableCell>
                    <TableCell className="text-right">{ch.avg_completion_rate}%</TableCell>
                    <TableCell className="text-right">{fmt(ch.avg_likes)}</TableCell>
                    <TableCell className="text-right">{fmt(ch.avg_comments)}</TableCell>
                    <TableCell><a href={`https://youtube.com/@${ch.username}`} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity"><ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" /></a></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
