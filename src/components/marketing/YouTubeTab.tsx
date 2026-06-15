import { useState, useEffect } from 'react';
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarIcon, Youtube, Plus, Users, Percent, Sparkles, Eye, Heart, MessageCircle, Share2,
  ExternalLink, Pencil, Trash2, MoreHorizontal, Clock, ChevronDown, ThumbsDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useYouTubeData, YouTubeVideo } from '@/hooks/useYouTubeData';
import { SocialMediaKPICard } from './SocialMediaKPICard';
import { YouTubeChannelHeader } from './YouTubeChannelHeader';
import { YouTubeConnectDialog } from './YouTubeConnectDialog';
import { AddYouTubeVideoDialog } from './AddYouTubeVideoDialog';
import { EditYouTubeVideoDialog } from './EditYouTubeVideoDialog';
import { DeleteYouTubeVideoDialog } from './DeleteYouTubeVideoDialog';
import { DeleteSocialProfileDialog } from './DeleteSocialProfileDialog';
import { cn } from '@/lib/utils';
import { IntegrationAccessAlert } from '@/components/integrations/IntegrationAccessAlert';

interface YouTubeTabProps {
  initialPostId?: string | null;
  onPostOpened?: () => void;
}

export function YouTubeTab({ initialPostId, onPostOpened }: YouTubeTabProps) {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [addVideoDialogOpen, setAddVideoDialogOpen] = useState(false);
  const [editVideoDialogOpen, setEditVideoDialogOpen] = useState(false);
  const [deleteVideoDialogOpen, setDeleteVideoDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [channelToDelete, setChannelToDelete] = useState<{ id: string; username: string } | null>(null);
  const [objectiveFilter, setObjectiveFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string | null>(null);

  const {
    channels, currentChannel, videos, kpis, isLoading, useMockData,
    selectedChannelId, setSelectedChannelId,
    createChannel, deleteChannel, createVideo, updateVideo, deleteVideo,
  } = useYouTubeData();

  useEffect(() => {
    if (initialPostId && videos.length > 0 && !isLoading) {
      const target = videos.find(v => v.id === initialPostId);
      if (target) {
        if (target.channel_id !== currentChannel?.id) setSelectedChannelId(target.channel_id);
        setSelectedVideo(target);
        setEditVideoDialogOpen(true);
        onPostOpened?.();
      }
    }
  }, [initialPostId, videos, isLoading]);

  const filteredVideos = videos.filter((v) => {
    const matchesObjective = objectiveFilter === 'all' || v.ai_objective === objectiveFilter;
    const matchesType = typeFilter === 'all' || v.video_type === typeFilter;
    const postDate = v.posted_at ? new Date(v.posted_at) : null;
    const matchesDateFrom = !dateFrom || !postDate || !isBefore(postDate, startOfDay(dateFrom));
    const matchesDateTo = !dateTo || !postDate || !isAfter(postDate, endOfDay(dateTo));
    return matchesObjective && matchesType && matchesDateFrom && matchesDateTo;
  });

  const sortedVideos = [...filteredVideos].sort((a, b) => {
    if (!sortBy) return 0;
    const aVal = (a[sortBy as keyof YouTubeVideo] as number) || 0;
    const bVal = (b[sortBy as keyof YouTubeVideo] as number) || 0;
    return bVal - aVal;
  });

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'short': return <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">Short</Badge>;
      case 'live': return <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">Live</Badge>;
      default: return <Badge variant="outline" className="text-xs">Vídeo</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-1">
        <div className="flex items-center justify-between"><Skeleton className="h-10 w-48" /><Skeleton className="h-10 w-40" /></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      <YouTubeChannelHeader channel={currentChannel} isLoading={isLoading} />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Select value={selectedChannelId || currentChannel?.id || ''} onValueChange={setSelectedChannelId}>
            <SelectTrigger className="w-[240px] bg-card">
              <div className="flex items-center gap-2"><Youtube className="h-4 w-4 text-red-600" /><SelectValue placeholder="Selecione um canal" /></div>
            </SelectTrigger>
            <SelectContent>
              {channels.map((ch) => (
                <SelectItem key={ch.id} value={ch.id} className="pr-10">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5"><AvatarImage src={ch.profile_picture_url || undefined} /><AvatarFallback className="text-[10px]">{ch.username.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                    @{ch.username}
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setChannelToDelete({ id: ch.id, username: ch.username });
                      }}
                      className="ml-2 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label={`Excluir canal @${ch.username}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentChannel && (
            <a href={`https://youtube.com/@${currentChannel.username}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {currentChannel && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => setChannelToDelete({ id: currentChannel.id, username: currentChannel.username })}
              aria-label="Excluir canal atual"
              title="Excluir canal atual"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {useMockData && <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Dados de exemplo</Badge>}
        </div>
        <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary/90" onClick={() => setConnectDialogOpen(true)}>
          <Plus className="h-4 w-4" />Conectar Novo Canal
        </Button>
      </div>

      <DeleteSocialProfileDialog
        open={!!channelToDelete}
        onOpenChange={(open) => !open && setChannelToDelete(null)}
        username={channelToDelete?.username}
        entityLabel="canal"
        isDeleting={deleteChannel.isPending}
        onConfirm={() => {
          if (channelToDelete) {
            deleteChannel.mutate(channelToDelete.id, {
              onSuccess: () => setChannelToDelete(null),
            });
          }
        }}
      />


      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SocialMediaKPICard title="Inscritos Totais" value={formatNumber(kpis.totalSubscribers)} icon={Users} trend={kpis.subscribersGrowth} trendLabel="vs. mês anterior" variant="default" />
        <SocialMediaKPICard title="Engajamento Médio" value={`${kpis.avgEngagement}%`} icon={Percent} variant="success" />
        <SocialMediaKPICard title="Total de Views" value={formatNumber(kpis.totalViews)} icon={Eye} variant="default" />
        <SocialMediaKPICard title="Insight de IA" value="" icon={Sparkles} description={kpis.aiInsight} variant="insight" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              Análise de Vídeos<Badge variant="secondary" className="font-normal">{filteredVideos.length} vídeos</Badge>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-[130px] h-9 justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dateFrom ? format(dateFrom, "dd/MM/yy") : "De"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="pointer-events-auto" locale={ptBR} /></PopoverContent></Popover>
              <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-[130px] h-9 justify-start text-left font-normal", !dateTo && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dateTo ? format(dateTo, "dd/MM/yy") : "Até"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="pointer-events-auto" locale={ptBR} /></PopoverContent></Popover>
              {(dateFrom || dateTo) && <Button variant="ghost" size="sm" className="h-9 px-2" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>Limpar datas</Button>}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[130px] h-9 bg-card"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todos tipos</SelectItem><SelectItem value="video">Vídeo</SelectItem><SelectItem value="short">Short</SelectItem><SelectItem value="live">Live</SelectItem></SelectContent>
              </Select>
              <Select value={objectiveFilter} onValueChange={setObjectiveFilter}>
                <SelectTrigger className="w-[150px] h-9 bg-card"><SelectValue placeholder="Objetivo" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todos objetivos</SelectItem><SelectItem value="growth">Crescimento</SelectItem><SelectItem value="connection">Conexão</SelectItem><SelectItem value="authority">Autoridade</SelectItem><SelectItem value="sales">Vendas</SelectItem></SelectContent>
              </Select>
              <Button size="sm" className="gap-1.5 h-9" onClick={() => setAddVideoDialogOpen(true)}><Plus className="h-4 w-4" />Adicionar Vídeo</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead className="w-[60px]">Tipo</TableHead>
                  <TableHead className="min-w-[200px]">Título</TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted/50 select-none" onClick={() => setSortBy(sortBy === 'views' ? null : 'views')}>
                    <div className="flex items-center justify-end gap-1">Views{sortBy === 'views' && <ChevronDown className="h-3 w-3" />}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted/50 select-none" onClick={() => setSortBy(sortBy === 'likes' ? null : 'likes')}>
                    <div className="flex items-center justify-end gap-1"><Heart className="h-3.5 w-3.5" />{sortBy === 'likes' && <ChevronDown className="h-3 w-3" />}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted/50 select-none" onClick={() => setSortBy(sortBy === 'comments' ? null : 'comments')}>
                    <div className="flex items-center justify-end gap-1"><MessageCircle className="h-3.5 w-3.5" />{sortBy === 'comments' && <ChevronDown className="h-3 w-3" />}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted/50 select-none" onClick={() => setSortBy(sortBy === 'shares' ? null : 'shares')}>
                    <div className="flex items-center justify-end gap-1"><Share2 className="h-3.5 w-3.5" />{sortBy === 'shares' && <ChevronDown className="h-3 w-3" />}</div>
                  </TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedVideos.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Nenhum vídeo encontrado</TableCell></TableRow>
                ) : sortedVideos.map((video) => (
                  <TableRow key={video.id} className="group">
                    <TableCell className="text-sm text-muted-foreground">{video.posted_at ? format(new Date(video.posted_at), 'dd/MM/yy') : '-'}</TableCell>
                    <TableCell>{getTypeBadge(video.video_type)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {video.thumbnail_url && <img src={video.thumbnail_url} alt="" className="h-10 w-16 rounded object-cover" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate max-w-[200px]">{video.title || video.caption || 'Sem título'}</p>
                          {video.duration_seconds && <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{Math.floor(video.duration_seconds / 60)}:{(video.duration_seconds % 60).toString().padStart(2, '0')}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatNumber(video.views)}</TableCell>
                    <TableCell className="text-right">{formatNumber(video.likes)}</TableCell>
                    <TableCell className="text-right">{formatNumber(video.comments)}</TableCell>
                    <TableCell className="text-right">{formatNumber(video.shares)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedVideo(video); setEditVideoDialogOpen(true); }}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                          {video.video_url && <DropdownMenuItem onClick={() => window.open(video.video_url!, '_blank')}><ExternalLink className="h-4 w-4 mr-2" />Abrir no YouTube</DropdownMenuItem>}
                          <DropdownMenuItem className="text-destructive" onClick={() => { setSelectedVideo(video); setDeleteVideoDialogOpen(true); }}><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <YouTubeConnectDialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen} onConnect={(data) => createChannel.mutate(data, { onSuccess: () => setConnectDialogOpen(false) })} isLoading={createChannel.isPending} />
      <AddYouTubeVideoDialog open={addVideoDialogOpen} onOpenChange={setAddVideoDialogOpen} onSubmit={(data) => createVideo.mutate(data, { onSuccess: () => setAddVideoDialogOpen(false) })} isLoading={createVideo.isPending} />
      <EditYouTubeVideoDialog open={editVideoDialogOpen} onOpenChange={setEditVideoDialogOpen} onSubmit={(id, data) => updateVideo.mutate({ videoId: id, data }, { onSuccess: () => { setEditVideoDialogOpen(false); setSelectedVideo(null); } })} isLoading={updateVideo.isPending} video={selectedVideo} />
      <DeleteYouTubeVideoDialog open={deleteVideoDialogOpen} onOpenChange={setDeleteVideoDialogOpen} onConfirm={(id) => deleteVideo.mutate(id, { onSuccess: () => { setDeleteVideoDialogOpen(false); setSelectedVideo(null); } })} isLoading={deleteVideo.isPending} video={selectedVideo} />
    </div>
  );
}
