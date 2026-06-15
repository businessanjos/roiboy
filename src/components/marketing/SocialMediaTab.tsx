import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarIcon,
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
  KeyRound,
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
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
import { MetaCredentialsDialog } from './MetaCredentialsDialog';
import { ContentDistributionCharts } from './ContentDistributionCharts';
import { ProfileInsightsDashboard } from './ProfileInsightsDashboard';
import { PostComparisonDialog } from './PostComparisonDialog';
import { WeeklyAnalysisDashboard } from './WeeklyAnalysisDashboard';
import { cn } from '@/lib/utils';
import { IntegrationAccessAlert } from '@/components/integrations/IntegrationAccessAlert';

interface SocialMediaTabProps {
  initialPostId?: string | null;
  onPostOpened?: () => void;
}

export function SocialMediaTab({ initialPostId, onPostOpened }: SocialMediaTabProps) {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [addPostDialogOpen, setAddPostDialogOpen] = useState(false);
  const [editPostDialogOpen, setEditPostDialogOpen] = useState(false);
  const [deletePostDialogOpen, setDeletePostDialogOpen] = useState(false);
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null);
  const [selectedPostsForComparison, setSelectedPostsForComparison] = useState<string[]>([]);
  const [profileToDelete, setProfileToDelete] = useState<{ id: string; username: string } | null>(null);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [objectiveFilter, setObjectiveFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [insightsPeriod, setInsightsPeriod] = useState<string>('28');
  const [sortBy, setSortBy] = useState<string | null>(null);
  
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
      {/* Instagram Profile Header */}
      <InstagramProfileHeader 
        profile={currentProfile} 
        isLoading={isLoading}
        onProfilePictureChange={handleProfilePictureChange}
      />

      {/* Header with Profile Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Select
            value={selectedProfileId || currentProfile?.id || ''}
            onValueChange={setSelectedProfileId}
          >
            <SelectTrigger className="w-[240px] bg-card">
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
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setProfileToDelete({ id: profile.id, username: profile.username });
                      }}
                      className="ml-2 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label={`Excluir perfil @${profile.username}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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

          {currentProfile && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() =>
                setProfileToDelete({ id: currentProfile.id, username: currentProfile.username })
              }
              aria-label="Excluir perfil atual"
              title="Excluir perfil atual"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          {useMockData && (
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
              Dados de exemplo
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentProfile && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setCredentialsDialogOpen(true)}
            >
              <KeyRound className="h-4 w-4" />
              Configurar Meta API
            </Button>
          )}
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

        <MetaCredentialsDialog
          open={credentialsDialogOpen}
          onOpenChange={setCredentialsDialogOpen}
          profileId={currentProfile?.id || null}
          profileUsername={currentProfile?.username}
        />
      </div>

      <DeleteSocialProfileDialog
        open={!!profileToDelete}
        onOpenChange={(open) => !open && setProfileToDelete(null)}
        username={profileToDelete?.username}
        entityLabel="perfil"
        isDeleting={deleteProfile.isPending}
        onConfirm={() => {
          if (profileToDelete) {
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
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  Análise de Conteúdos
                  <Badge variant="secondary" className="font-normal">
                    {filteredPosts.length} posts
                  </Badge>
                </CardTitle>
                <TabsList className="h-8">
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

              <div className="flex flex-wrap items-center gap-2">
                {/* Date From Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[130px] h-9 justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "dd/MM/yy") : "De"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                      className="pointer-events-auto"
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>

                {/* Date To Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[130px] h-9 justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "dd/MM/yy") : "Até"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                      className="pointer-events-auto"
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>

                {/* Clear Date Filters */}
                {(dateFrom || dateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2"
                    onClick={() => {
                      setDateFrom(undefined);
                      setDateTo(undefined);
                    }}
                  >
                    Limpar datas
                  </Button>
                )}

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
                  className="gap-1.5 h-9"
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
              <div className="overflow-x-auto">
                <Table>
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
                                "flex items-center gap-1 ml-auto hover:text-primary transition-colors",
                                sortBy === 'reach' && "text-primary"
                              )}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              {sortBy === 'reach' && <ChevronDown className="h-3 w-3" />}
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
                                "flex items-center gap-1 ml-auto hover:text-primary transition-colors",
                                sortBy === 'likes' && "text-primary"
                              )}
                            >
                              <Heart className="h-3.5 w-3.5" />
                              {sortBy === 'likes' && <ChevronDown className="h-3 w-3" />}
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
                                "flex items-center gap-1 ml-auto hover:text-primary transition-colors",
                                sortBy === 'comments' && "text-primary"
                              )}
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              {sortBy === 'comments' && <ChevronDown className="h-3 w-3" />}
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
                                "flex items-center gap-1 ml-auto hover:text-primary transition-colors",
                                sortBy === 'shares' && "text-primary"
                              )}
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              {sortBy === 'shares' && <ChevronDown className="h-3 w-3" />}
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
                                "flex items-center gap-1 ml-auto hover:text-primary transition-colors",
                                sortBy === 'saves' && "text-primary"
                              )}
                            >
                              <Bookmark className="h-3.5 w-3.5" />
                              {sortBy === 'saves' && <ChevronDown className="h-3 w-3" />}
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
                                "flex items-center gap-1 ml-auto hover:text-primary transition-colors",
                                sortBy === 'link_clicks' && "text-primary"
                              )}
                            >
                              <Link2 className="h-3.5 w-3.5" />
                              {sortBy === 'link_clicks' && <ChevronDown className="h-3 w-3" />}
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
                                "flex items-center gap-1 ml-auto hover:text-primary transition-colors",
                                sortBy === 'views' && "text-primary"
                              )}
                            >
                              <Play className="h-3.5 w-3.5" />
                              {sortBy === 'views' && <ChevronDown className="h-3 w-3" />}
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
                                "flex items-center gap-1 ml-auto font-semibold hover:text-primary transition-colors",
                                sortBy === 'engagement_rate' ? "text-primary" : "text-primary"
                              )}
                            >
                              Engaj. %
                              {sortBy === 'engagement_rate' && <ChevronDown className="h-3 w-3" />}
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
                                "flex items-center gap-1 ml-auto font-semibold hover:text-primary transition-colors",
                                sortBy === 'virality_rate' ? "text-primary" : "text-primary"
                              )}
                            >
                              Viral %
                              {sortBy === 'virality_rate' && <ChevronDown className="h-3 w-3" />}
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
                      sortedPosts.map((post) => {
                        const isSelected = selectedPostsForComparison.includes(post.id);
                        return (
                          <TableRow 
                            key={post.id}
                            className={cn(
                              'group transition-colors',
                              post.is_trending && 'bg-amber-50/50 dark:bg-amber-950/10',
                              isSelected && 'bg-primary/5'
                            )}
                          >
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => togglePostSelection(post.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium text-sm">
                              {format(new Date(post.posted_at), 'dd/MM', { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <PostFormatBadge format={post.post_type} />
                            </TableCell>
                            <TableCell>
                              {post.theme ? (
                                <Badge variant="outline" className="text-xs">
                                  {getThemeLabel(post.theme)}
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
                                      <Flame className="h-4 w-4 text-orange-500 animate-pulse" />
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
                                <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                                  {post.caption || 'Sem legenda'}
                                </p>
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
                                  post.engagement_rate >= 5 && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                  post.engagement_rate >= 3 && post.engagement_rate < 5 && 'bg-blue-50 text-blue-700 border-blue-200',
                                  post.engagement_rate < 3 && 'bg-gray-50 text-gray-600 border-gray-200'
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
                                  post.virality_rate < 5 && 'bg-gray-50 text-gray-600 border-gray-200'
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
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
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
