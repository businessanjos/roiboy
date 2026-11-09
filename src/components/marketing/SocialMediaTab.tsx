import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Play,
  Instagram,
  Plus,
  Users,
  Percent,
  Sparkles,
  Flame,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Link2,
  ExternalLink,
  RefreshCw,
  Pencil,
  Trash2,
  MoreHorizontal,
  List,
  PieChart,
  BarChart3,
  CalendarRange,
  GitCompare,
  CheckSquare,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { useSocialMediaData, InstagramPost } from '@/hooks/useSocialMediaData';
import { SocialMediaKPICard } from './SocialMediaKPICard';
import { PostFormatBadge } from './PostFormatBadge';
import { PostObjectiveBadge } from './PostObjectiveBadge';
import { InstagramConnectDialog } from './InstagramConnectDialog';
import { InstagramProfileHeader } from './InstagramProfileHeader';
import { AddPostDialog, PostFormData } from './AddPostDialog';
import { EditPostDialog, EditPostFormData } from './EditPostDialog';
import { DeletePostDialog } from './DeletePostDialog';
import { DeleteSocialProfileDialog } from './DeleteSocialProfileDialog';
import { ContentDistributionCharts } from './ContentDistributionCharts';
import { ProfileInsightsDashboard } from './ProfileInsightsDashboard';
import { PostComparisonDialog } from './PostComparisonDialog';
import { WeeklyAnalysisDashboard } from './WeeklyAnalysisDashboard';
import { cn } from '@/lib/utils';
import { IntegrationAccessAlert } from '@/components/integrations/IntegrationAccessAlert';
import { usePagedList } from '@/hooks/usePagedList';
import { PagerFor } from '@/components/ui/list-pagination';
import { SocialPostsDateFilter } from './SocialPostsDateFilter';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isManagementUser } from '@/lib/access/managementRoles';

interface SocialMediaTabProps {
  initialPostId?: string | null;
  onPostOpened?: () => void;
}

export function SocialMediaTab({ initialPostId, onPostOpened }: SocialMediaTabProps) {
  const { currentUser } = useCurrentUser();
  const canDeleteProfile = isManagementUser(currentUser);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [addPostDialogOpen, setAddPostDialogOpen] = useState(false);
  const [editPostDialogOpen, setEditPostDialogOpen] = useState(false);
  const [deletePostDialogOpen, setDeletePostDialogOpen] = useState(false);
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null);
  const [selectedPostsForComparison, setSelectedPostsForComparison] = useState<string[]>([]);
  const [profileToDelete, setProfileToDelete] = useState<{ id: string; username: string } | null>(null);
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [objectiveFilter, setObjectiveFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [insightsPeriod, setInsightsPeriod] = useState<string>('28');
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [visibleMetric, setVisibleMetric] = useState('reach');
  const metricColumns: Record<string, string> = {
    reach: '[&_tr>*:nth-child(7)]:!table-cell', likes: '[&_tr>*:nth-child(8)]:!table-cell',
    comments: '[&_tr>*:nth-child(9)]:!table-cell', shares: '[&_tr>*:nth-child(10)]:!table-cell',
    saves: '[&_tr>*:nth-child(11)]:!table-cell', link_clicks: '[&_tr>*:nth-child(12)]:!table-cell',
    views: '[&_tr>*:nth-child(13)]:!table-cell', engagement_rate: '[&_tr>*:nth-child(14)]:!table-cell',
    virality_rate: '[&_tr>*:nth-child(15)]:!table-cell',
  };
  
  const {
    profiles,
    currentProfile,
    posts,
    kpis,
    isLoading,
    useMockData,
    selectedProfileId,
    setSelectedProfileId,
    createProfile,
    deleteProfile,
    createPost,
    updatePost,
    deletePost,
    refetchData,
    syncProfiles,
    updateProfilePicture,
  } = useSocialMediaData();

  // Auto-select post from URL parameter
  useEffect(() => {
    if (initialPostId && posts.length > 0 && !isLoading) {
      const targetPost = posts.find(p => p.id === initialPostId);
      if (targetPost) {
        // Select the correct profile if different
        if (targetPost.profile_id !== currentProfile?.id) {
          setSelectedProfileId(targetPost.profile_id);
        }
        // Open edit dialog for the post
        setSelectedPost(targetPost);
        setEditPostDialogOpen(true);
        // Clear the URL parameter
        onPostOpened?.();
      }
    }
  }, [initialPostId, posts, isLoading]);

  const togglePostSelection = (postId: string) => {
    setSelectedPostsForComparison(prev => {
      if (prev.includes(postId)) {
        return prev.filter(id => id !== postId);
      }
      if (prev.length >= 2) {
        return [prev[1], postId]; // Replace oldest selection
      }
      return [...prev, postId];
    });
  };

  // Get posts for comparison
  const postsForComparison = selectedPostsForComparison
    .map(id => posts.find(p => p.id === id))
    .filter(Boolean) as InstagramPost[];

  // Handle profile picture change
  const handleProfilePictureChange = (url: string | null) => {
    if (currentProfile) {
      updateProfilePicture.mutate({ profileId: currentProfile.id, avatarUrl: url });
    }
  };

  // Filter posts based on selected filters
  const filteredPosts = posts.filter((post) => {
    const matchesFormat = formatFilter === 'all' || post.post_type === formatFilter;
    const matchesObjective = objectiveFilter === 'all' || post.ai_objective === objectiveFilter;
    
    const postDate = new Date(post.posted_at);
    const matchesDateFrom = !dateFrom || !isBefore(postDate, startOfDay(dateFrom));
    const matchesDateTo = !dateTo || !isAfter(postDate, endOfDay(dateTo));
    
    return matchesFormat && matchesObjective && matchesDateFrom && matchesDateTo;
  });

  // Sort posts based on selected column (descending)
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (!sortBy) return 0;
    const aValue = (a[sortBy as keyof InstagramPost] as number) || 0;
    const bValue = (b[sortBy as keyof InstagramPost] as number) || 0;
    return bValue - aValue; // Descending order
  });

  const pg = usePagedList(sortedPosts, { resetKey: [selectedProfileId, currentProfile?.id, formatFilter, objectiveFilter, dateFrom, dateTo, sortBy], isLoading });

  // Toggle sort by column
  const handleSortToggle = (field: string) => {
    setSortBy(prev => prev === field ? null : field);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const getThemeLabel = (theme: string): string => {
    const themeLabels: Record<string, string> = {
      dump: '📷 Dump',
      frase: '💭 Frase',
      reels_curto: '⚡ Reels Curto',
      carrossel_lifestyle: '🌴 Lifestyle',
      carrossel_reflexivo: '🧘 Reflexivo',
      trends: '📈 Trends',
      reacts: '🎭 Reacts',
      fato_novo: '📰 Fato Novo',
      prova_social: '⭐ Prova Social',
      assunto_alta: '🔥 Assunto em Alta',
      vlog: '🎥 Vlog',
      corte_podcast_convidado: '🎙️ Podcast Convidado',
      corte_vida_ryka_podcast: '🎧 Vida Ryka Podcast',
    };
    return themeLabels[theme] || theme;
  };

  const handleConnect = (data: { username: string; accessToken: string }) => {
    createProfile.mutate(data, {
      onSuccess: () => setConnectDialogOpen(false),
    });
  };

  const handleAddPost = (data: PostFormData) => {
    createPost.mutate(data, {
      onSuccess: () => setAddPostDialogOpen(false),
    });
  };

  // Get queryClient for manual refetch fallback
  const queryClient = useQueryClient();

  const handleEditPost = (postId: string, data: EditPostFormData) => {
    updatePost.mutate(
      { postId, data },
      {
        onSuccess: () => {
          setEditPostDialogOpen(false);
          setSelectedPost(null);
          // Force explicit refetch after 100ms as fallback for edge cases
          setTimeout(() => {
            queryClient.refetchQueries({ queryKey: ['instagram-posts'] });
          }, 100);
        },
      }
    );
  };

  const handleDeletePost = (postId: string) => {
    deletePost.mutate(postId, {
      onSuccess: () => {
        setDeletePostDialogOpen(false);
        setSelectedPost(null);
      },
    });
  };

  const openEditDialog = (post: InstagramPost) => {
    setSelectedPost(post);
    setEditPostDialogOpen(true);
  };

  const openDeleteDialog = (post: InstagramPost) => {
    setSelectedPost(post);
    setDeletePostDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-1">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      <IntegrationAccessAlert platform="instagram" visibleCount={profiles.length} onReload={refetchData} />

      {/* Instagram Profile Header */}
      <InstagramProfileHeader 
        profile={currentProfile} 
        isLoading={isLoading}
        onProfilePictureChange={handleProfilePictureChange}
      />

      {/* Header with Profile Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="group/profile flex w-full min-w-0 items-center gap-3 sm:w-auto">
          <Select
            value={selectedProfileId || currentProfile?.id || ''}
            onValueChange={setSelectedProfileId}
          >
            <SelectTrigger className="min-w-0 flex-1 bg-card sm:w-[240px] sm:flex-none">
              <div className="flex items-center gap-2">
                <Instagram className="h-4 w-4 text-pink-500" />
                <SelectValue placeholder="Selecione um perfil" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {profiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id} className="pr-10">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={profile.profile_picture_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {profile.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    @{profile.username}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {currentProfile && (
            <a
              href={`https://instagram.com/${currentProfile.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-pink-500 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}

          {currentProfile && canDeleteProfile && (
            <Tooltip>
              <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-md p-0 text-muted-foreground opacity-0 pointer-events-none transition-opacity group-hover/profile:opacity-100 group-hover/profile:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto hover:bg-transparent hover:text-destructive [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto"
              onClick={() =>
                setProfileToDelete({ id: currentProfile.id, username: currentProfile.username })
              }
              aria-label="Excluir perfil atual"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
              </TooltipTrigger>
              <TooltipContent>Excluir perfil atual</TooltipContent>
            </Tooltip>
          )}

          {useMockData && (
            <Badge variant="outline" className="text-xs bg-warning-soft text-warning-strong border-warning">
              Dados de exemplo
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => syncProfiles.mutate()}
            disabled={syncProfiles.isPending || profiles.length === 0}
          >
            <RefreshCw className={`h-4 w-4 ${syncProfiles.isPending ? 'animate-spin' : ''}`} />
            {syncProfiles.isPending ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-primary hover:bg-primary/90"
            onClick={() => setConnectDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Conectar Novo Perfil
          </Button>
        </div>

      </div>

      <DeleteSocialProfileDialog
        open={canDeleteProfile && !!profileToDelete}
        onOpenChange={(open) => !open && setProfileToDelete(null)}
        username={profileToDelete?.username}
        entityLabel="perfil"
        isDeleting={deleteProfile.isPending}
        onConfirm={() => {
          if (canDeleteProfile && profileToDelete) {
            deleteProfile.mutate(profileToDelete.id, {
              onSuccess: () => setProfileToDelete(null),
            });
          }
        }}
      />


      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SocialMediaKPICard
          title="Seguidores Totais"
          value={formatNumber(kpis.totalFollowers)}
          icon={Users}
          trend={kpis.followersGrowth}
          trendLabel="vs. mês anterior"
          variant="default"
        />
        <SocialMediaKPICard
          title="Engajamento Médio"
          value={`${kpis.avgEngagement}%`}
          icon={Percent}
          variant="success"
        />
        <SocialMediaKPICard
          title="Insight de IA"
          value=""
          icon={Sparkles}
          description={kpis.aiInsight}
          variant="insight"
        />
      </div>

      {/* Posts Section with Tabs */}
      <Card>
        <Tabs defaultValue="list" className="w-full">
          <CardHeader className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-col gap-4">
              <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  Análise de Conteúdos
                  <Badge variant="secondary" className="font-normal">
                    {filteredPosts.length} posts
                  </Badge>
                </CardTitle>
                <TabsList className="h-auto max-w-full flex-wrap justify-start gap-y-1">
                  <TabsTrigger value="list" className="gap-1.5 text-xs px-3">
                    <List className="h-3.5 w-3.5" />
                    Lista
                  </TabsTrigger>
                  <TabsTrigger value="charts" className="gap-1.5 text-xs px-3">
                    <PieChart className="h-3.5 w-3.5" />
                    Divisão
                  </TabsTrigger>
                  <TabsTrigger value="weekly" className="gap-1.5 text-xs px-3">
                    <CalendarRange className="h-3.5 w-3.5" />
                    Semanal
                  </TabsTrigger>
                  <TabsTrigger value="insights" className="gap-1.5 text-xs px-3">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Insights
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-2">
                <Select value={visibleMetric} onValueChange={setVisibleMetric}>
                  <SelectTrigger className="h-9 w-[155px] bg-card" aria-label="Métrica da lista"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries({ reach: 'Alcance', likes: 'Curtidas', comments: 'Comentários', shares: 'Compartilhamentos', saves: 'Salvamentos', link_clicks: 'Cliques no link', views: 'Visualizações', engagement_rate: 'Engajamento', virality_rate: 'Viralidade' }).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <SocialPostsDateFilter
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  onFromChange={setDateFrom}
                  onToChange={setDateTo}
                />

                {/* Format Filter */}
                <Select value={formatFilter} onValueChange={setFormatFilter}>
                  <SelectTrigger className="w-[140px] h-9 bg-card">
                    <SelectValue placeholder="Formato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos formatos</SelectItem>
                    <SelectItem value="reels">Reels</SelectItem>
                    <SelectItem value="carousel">Carrossel</SelectItem>
                    <SelectItem value="static">Estático</SelectItem>
                  </SelectContent>
                </Select>

                {/* Objective Filter */}
                <Select value={objectiveFilter} onValueChange={setObjectiveFilter}>
                  <SelectTrigger className="w-[150px] h-9 bg-card">
                    <SelectValue placeholder="Objetivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos objetivos</SelectItem>
                    <SelectItem value="growth">Crescimento</SelectItem>
                    <SelectItem value="connection">Conexão</SelectItem>
                    <SelectItem value="authority">Autoridade</SelectItem>
                    <SelectItem value="sales">Vendas</SelectItem>
                  </SelectContent>
                </Select>

                {/* Compare Button */}
                {selectedPostsForComparison.length === 2 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-1.5 h-9"
                    onClick={() => setComparisonDialogOpen(true)}
                  >
                    <GitCompare className="h-4 w-4" />
                    Comparar ({selectedPostsForComparison.length})
                  </Button>
                )}

                {/* Add Post Button */}
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-9 gap-1.5"
                  onClick={() => setAddPostDialogOpen(true)}
                  disabled={!currentProfile}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <TabsContent value="list" className="mt-0">
            <CardContent className="p-0">
              <div className={cn("w-full min-w-0 [&_th]:px-2 [&_td]:px-2 [&_tr>*:nth-child(1)]:w-8 [&_tr>*:nth-child(2)]:w-16 [&_tr>*:nth-child(3)]:hidden sm:[&_tr>*:nth-child(3)]:table-cell sm:[&_tr>*:nth-child(3)]:w-24 [&_tr>*:nth-child(4)]:hidden xl:[&_tr>*:nth-child(4)]:table-cell [&_tr>*:nth-child(5)]:hidden xl:[&_tr>*:nth-child(5)]:table-cell [&_tr>*:nth-child(6)]:min-w-0 [&_tr>*:nth-child(n+7):nth-child(-n+15)]:hidden [&_tr>*:nth-child(n+7):nth-child(-n+15)]:w-24 [&_tr>*:nth-child(16)]:w-10", metricColumns[visibleMetric])}>
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-[40px]">
                        <Tooltip>
                          <TooltipTrigger>
                            <CheckSquare className="h-3.5 w-3.5" />
                          </TooltipTrigger>
                          <TooltipContent>Selecionar para comparar</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="w-[100px]">Data</TableHead>
                      <TableHead className="w-[100px]">Formato</TableHead>
                      <TableHead className="w-[120px]">Categoria</TableHead>
                      <TableHead className="w-[120px]">Objetivo (IA)</TableHead>
                      <TableHead className="min-w-[200px]">Conteúdo</TableHead>
                      <TableHead className="text-right w-[80px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleSortToggle('reach')}
                              className={cn(
                                "inline-flex h-6 min-w-[28px] items-center justify-end gap-1 ml-auto hover:text-primary transition-colors",
                                sortBy === 'reach' && "text-primary"
                              )}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <ChevronDown className={cn("h-3 w-3 shrink-0", sortBy === 'reach' ? "opacity-100" : "opacity-0")} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Alcance (clique para ordenar)</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-right w-[70px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleSortToggle('likes')}
                              className={cn(
                                "inline-flex h-6 min-w-[28px] items-center justify-end gap-1 ml-auto hover:text-primary transition-colors",
                                sortBy === 'likes' && "text-primary"
                              )}
                            >
                              <Heart className="h-3.5 w-3.5" />
                              <ChevronDown className={cn("h-3 w-3 shrink-0", sortBy === 'likes' ? "opacity-100" : "opacity-0")} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Curtidas (clique para ordenar)</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-right w-[70px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleSortToggle('comments')}
                              className={cn(
                                "inline-flex h-6 min-w-[28px] items-center justify-end gap-1 ml-auto hover:text-primary transition-colors",
                                sortBy === 'comments' && "text-primary"
                              )}
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              <ChevronDown className={cn("h-3 w-3 shrink-0", sortBy === 'comments' ? "opacity-100" : "opacity-0")} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Comentários (clique para ordenar)</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-right w-[70px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleSortToggle('shares')}
                              className={cn(
                                "inline-flex h-6 min-w-[28px] items-center justify-end gap-1 ml-auto hover:text-primary transition-colors",
                                sortBy === 'shares' && "text-primary"
                              )}
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              <ChevronDown className={cn("h-3 w-3 shrink-0", sortBy === 'shares' ? "opacity-100" : "opacity-0")} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Compartilhamentos (clique para ordenar)</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-right w-[70px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleSortToggle('saves')}
                              className={cn(
                                "inline-flex h-6 min-w-[28px] items-center justify-end gap-1 ml-auto hover:text-primary transition-colors",
                                sortBy === 'saves' && "text-primary"
                              )}
                            >
                              <Bookmark className="h-3.5 w-3.5" />
                              <ChevronDown className={cn("h-3 w-3 shrink-0", sortBy === 'saves' ? "opacity-100" : "opacity-0")} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Salvamentos (clique para ordenar)</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-right w-[70px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleSortToggle('link_clicks')}
                              className={cn(
                                "inline-flex h-6 min-w-[28px] items-center justify-end gap-1 ml-auto hover:text-primary transition-colors",
                                sortBy === 'link_clicks' && "text-primary"
                              )}
                            >
                              <Link2 className="h-3.5 w-3.5" />
                              <ChevronDown className={cn("h-3 w-3 shrink-0", sortBy === 'link_clicks' ? "opacity-100" : "opacity-0")} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Cliques no Link (clique para ordenar)</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-right w-[70px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleSortToggle('views')}
                              className={cn(
                                "inline-flex h-6 min-w-[28px] items-center justify-end gap-1 ml-auto hover:text-primary transition-colors",
                                sortBy === 'views' && "text-primary"
                              )}
                            >
                              <Play className="h-3.5 w-3.5" />
                              <ChevronDown className={cn("h-3 w-3 shrink-0", sortBy === 'views' ? "opacity-100" : "opacity-0")} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Views (clique para ordenar)</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-right w-[90px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleSortToggle('engagement_rate')}
                              className={cn(
                                "inline-flex h-6 min-w-[70px] items-center justify-end gap-1 ml-auto font-semibold hover:text-primary transition-colors",
                                sortBy === 'engagement_rate' ? "text-primary" : "text-primary"
                              )}
                            >
                              Engaj. %
                              <ChevronDown className={cn("h-3 w-3 shrink-0", sortBy === 'engagement_rate' ? "opacity-100" : "opacity-0")} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Engajamento (clique para ordenar)</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-right w-[90px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleSortToggle('virality_rate')}
                              className={cn(
                                "inline-flex h-6 min-w-[70px] items-center justify-end gap-1 ml-auto font-semibold hover:text-primary transition-colors",
                                sortBy === 'virality_rate' ? "text-primary" : "text-primary"
                              )}
                            >
                              Viral %
                              <ChevronDown className={cn("h-3 w-3 shrink-0", sortBy === 'virality_rate' ? "opacity-100" : "opacity-0")} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Viralidade (clique para ordenar)</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPosts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={16} className="text-center py-12 text-muted-foreground">
                          {posts.length === 0 
                            ? 'Nenhum post encontrado para este perfil.'
                            : 'Nenhum post encontrado com os filtros selecionados.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      pg.items.map((post) => {
                        const isSelected = selectedPostsForComparison.includes(post.id);
                        return (
                          <TableRow 
                            key={post.id}
                            className={cn(
                              'group transition-colors',
                              post.is_trending && 'bg-warning/50 dark:bg-warning/10',
                              isSelected && 'bg-primary/5'
                            )}
                          >
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => togglePostSelection(post.id)}
                              />
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-medium text-sm">
                              {format(new Date(post.posted_at), 'dd/MM', { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <PostFormatBadge format={post.post_type} />
                            </TableCell>
                            <TableCell>
                              {post.theme ? (
                                <Badge variant="outline" className="h-7 max-w-[170px] gap-1 whitespace-nowrap px-2.5 text-xs font-normal">
                                  <span className="truncate">{getThemeLabel(post.theme)}</span>
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <PostObjectiveBadge 
                                  objective={post.ai_objective} 
                                  confidence={post.ai_objective_confidence}
                                />
                                {post.is_trending && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Flame className="h-4 w-4 text-warning animate-pulse" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Em tendência!
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-start gap-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span tabIndex={0} className="min-w-0 flex-1 cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label="Ler legenda completa">
                                      <p className="line-clamp-2 text-sm text-muted-foreground">
                                        {post.caption || 'Sem legenda'}
                                      </p>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" align="start" className="max-h-80 max-w-md overflow-y-auto whitespace-pre-wrap break-words border border-border bg-popover text-xs leading-relaxed text-popover-foreground shadow-lg">
                                    {post.caption || 'Sem legenda'}
                                  </TooltipContent>
                                </Tooltip>
                                {post.permalink && (
                                  <a
                                    href={post.permalink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                  </a>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatNumber(post.reach)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(post.likes)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(post.comments)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(post.shares)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(post.saves)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(post.link_clicks || 0)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(post.views || 0)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant="outline" 
                                className={cn(
                                  'font-medium',
                                  post.engagement_rate >= 5 && 'bg-success-soft text-success-strong border-success',
                                  post.engagement_rate >= 3 && post.engagement_rate < 5 && 'bg-info-soft text-info-strong border-info',
                                  post.engagement_rate < 3 && 'bg-muted text-muted-foreground border-border'
                                )}
                              >
                                {post.engagement_rate?.toFixed(1)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant="outline"
                                className={cn(
                                  'font-medium',
                                  post.virality_rate >= 10 && 'bg-purple-50 text-purple-700 border-purple-200',
                                  post.virality_rate >= 5 && post.virality_rate < 10 && 'bg-indigo-50 text-indigo-700 border-indigo-200',
                                  post.virality_rate < 5 && 'bg-muted text-muted-foreground border-border'
                                )}
                              >
                                {post.virality_rate?.toFixed(1)}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 transition-opacity"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditDialog(post)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => openDeleteDialog(post)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              <PagerFor state={pg} itemLabel="posts" />
            </CardContent>
          </TabsContent>
          
          <TabsContent value="charts" className="mt-0">
            <CardContent className="pt-2">
              <ContentDistributionCharts posts={filteredPosts} />
            </CardContent>
          </TabsContent>

          <TabsContent value="weekly" className="mt-0">
            <CardContent className="pt-2">
              <WeeklyAnalysisDashboard posts={filteredPosts} isLoading={isLoading} />
            </CardContent>
          </TabsContent>

          <TabsContent value="insights" className="mt-0">
            <CardContent className="pt-2">
              {currentProfile && (
                <ProfileInsightsDashboard
                  profileId={currentProfile.id}
                  profiles={profiles.map(p => ({ id: p.id, username: p.username }))}
                  period={insightsPeriod}
                  onPeriodChange={setInsightsPeriod}
                />
              )}
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Connect Dialog */}
      <InstagramConnectDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        onConnect={handleConnect}
        isLoading={createProfile.isPending}
      />

      {/* Add Post Dialog */}
      <AddPostDialog
        open={addPostDialogOpen}
        onOpenChange={setAddPostDialogOpen}
        onSubmit={handleAddPost}
        isLoading={createPost.isPending}
        profiles={profiles.map((p) => ({ id: p.id, username: p.username }))}
        currentProfileId={currentProfile?.id}
      />

      {/* Edit Post Dialog */}
      <EditPostDialog
        open={editPostDialogOpen}
        onOpenChange={setEditPostDialogOpen}
        onSubmit={handleEditPost}
        isLoading={updatePost.isPending}
        post={selectedPost}
      />

      {/* Delete Post Dialog */}
      <DeletePostDialog
        open={deletePostDialogOpen}
        onOpenChange={setDeletePostDialogOpen}
        onConfirm={handleDeletePost}
        isLoading={deletePost.isPending}
        post={selectedPost}
      />

      {/* Post Comparison Dialog */}
      <PostComparisonDialog
        open={comparisonDialogOpen}
        onOpenChange={setComparisonDialogOpen}
        postA={postsForComparison[0] || null}
        postB={postsForComparison[1] || null}
      />
    </div>
  );
}
