import { useState, useEffect } from 'react';
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarIcon,
  Music2,
  Plus,
  Users,
  Percent,
  Sparkles,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  ExternalLink,
  Pencil,
  Trash2,
  MoreHorizontal,
  Clock,
  TrendingUp,
  Flame,
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTikTokData, TikTokPost } from '@/hooks/useTikTokData';
import { SocialMediaKPICard } from './SocialMediaKPICard';
import { TikTokProfileHeader } from './TikTokProfileHeader';
import { TikTokConnectDialog } from './TikTokConnectDialog';
import { AddTikTokPostDialog } from './AddTikTokPostDialog';
import { EditTikTokPostDialog } from './EditTikTokPostDialog';
import { DeleteTikTokPostDialog } from './DeleteTikTokPostDialog';
import { DeleteSocialProfileDialog } from './DeleteSocialProfileDialog';
import { cn } from '@/lib/utils';
import { IntegrationAccessAlert } from '@/components/integrations/IntegrationAccessAlert';

interface TikTokTabProps {
  initialPostId?: string | null;
  onPostOpened?: () => void;
}

export function TikTokTab({ initialPostId, onPostOpened }: TikTokTabProps) {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [addPostDialogOpen, setAddPostDialogOpen] = useState(false);
  const [editPostDialogOpen, setEditPostDialogOpen] = useState(false);
  const [deletePostDialogOpen, setDeletePostDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<TikTokPost | null>(null);
  const [profileToDelete, setProfileToDelete] = useState<{ id: string; username: string } | null>(null);
  const [objectiveFilter, setObjectiveFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
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
    syncProfile,
    createPost,
    updatePost,
    deletePost,
    refetchData,
    updateProfilePicture,
  } = useTikTokData();

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

  // Profile picture change handler (if needed in future)
  // const handleProfilePictureChange = (url: string | null) => {
  //   if (currentProfile) {
  //     updateProfilePicture.mutate({ profileId: currentProfile.id, avatarUrl: url });
  //   }
  // };

  // Get unique categories from posts
  const categories = [...new Set(posts.filter(p => p.category).map(p => p.category))];

  // Filter posts
  const filteredPosts = posts.filter((post) => {
    const matchesObjective = objectiveFilter === 'all' || post.ai_objective === objectiveFilter;
    const matchesCategory = categoryFilter === 'all' || post.category === categoryFilter;

    const postDate = post.posted_at ? new Date(post.posted_at) : null;
    const matchesDateFrom = !dateFrom || !postDate || !isBefore(postDate, startOfDay(dateFrom));
    const matchesDateTo = !dateTo || !postDate || !isAfter(postDate, endOfDay(dateTo));

    return matchesObjective && matchesCategory && matchesDateFrom && matchesDateTo;
  });

  // Sort posts
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (!sortBy) return 0;
    const aValue = (a[sortBy as keyof TikTokPost] as number) || 0;
    const bValue = (b[sortBy as keyof TikTokPost] as number) || 0;
    return bValue - aValue;
  });

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

  const handleConnect = (data: { username: string; followers_count?: number; following_count?: number; videos_count?: number; bio?: string }) => {
    createProfile.mutate(data, {
      onSuccess: () => setConnectDialogOpen(false),
    });
  };

  const handleAddPost = (data: any) => {
    createPost.mutate(data, {
      onSuccess: () => setAddPostDialogOpen(false),
    });
  };

  const handleEditPost = (postId: string, data: any) => {
    updatePost.mutate(
      { postId, data },
      {
        onSuccess: () => {
          setEditPostDialogOpen(false);
          setSelectedPost(null);
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

  const openEditDialog = (post: TikTokPost) => {
    setSelectedPost(post);
    setEditPostDialogOpen(true);
  };

  const openDeleteDialog = (post: TikTokPost) => {
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
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
      <IntegrationAccessAlert platform="tiktok" visibleCount={profiles.length} onReload={refetchData} />

      {/* TikTok Profile Header */}
      <TikTokProfileHeader
        profile={currentProfile}
        isLoading={isLoading}
        onProfilePictureChange={(url) => {
          if (currentProfile) {
            updateProfilePicture.mutate({ profileId: currentProfile.id, avatarUrl: url });
          }
        }}
        onSync={() => syncProfile.mutate(currentProfile?.id)}
        isSyncing={syncProfile.isPending}
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
                <Music2 className="h-4 w-4 text-black" />
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
              href={`https://tiktok.com/@${currentProfile.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          title="Total de Views"
          value={formatNumber(kpis.totalViews)}
          icon={Eye}
          variant="default"
        />
        <SocialMediaKPICard
          title="Insight de IA"
          value=""
          icon={Sparkles}
          description={kpis.aiInsight}
          variant="insight"
        />
      </div>

      {/* Videos Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              Análise de Vídeos
              <Badge variant="secondary" className="font-normal">
                {filteredPosts.length} vídeos
              </Badge>
            </CardTitle>

            <div className="flex flex-wrap items-center gap-2">
              {/* Date Filters */}
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

              {/* Category Filter */}
              {categories.length > 0 && (
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px] h-9 bg-card">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas categorias</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat || ''}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                size="sm"
                className="gap-1.5 h-9"
                onClick={() => setAddPostDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Adicionar Vídeo
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead className="min-w-[200px]">Legenda</TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSortToggle('views')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Views
                      {sortBy === 'views' && <ChevronDown className="h-3 w-3" />}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSortToggle('likes')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <Heart className="h-3.5 w-3.5" />
                      {sortBy === 'likes' && <ChevronDown className="h-3 w-3" />}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSortToggle('comments')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {sortBy === 'comments' && <ChevronDown className="h-3 w-3" />}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSortToggle('shares')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <Share2 className="h-3.5 w-3.5" />
                      {sortBy === 'shares' && <ChevronDown className="h-3 w-3" />}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSortToggle('saves')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <Bookmark className="h-3.5 w-3.5" />
                      {sortBy === 'saves' && <ChevronDown className="h-3 w-3" />}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSortToggle('completion_rate')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Conclusão
                      {sortBy === 'completion_rate' && <ChevronDown className="h-3 w-3" />}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSortToggle('followers_gained')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      +Seg
                      {sortBy === 'followers_gained' && <ChevronDown className="h-3 w-3" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPosts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      Nenhum vídeo encontrado. Adicione seu primeiro vídeo!
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedPosts.map((post) => (
                    <TableRow key={post.id} className="group">
                      <TableCell className="text-muted-foreground text-sm">
                        {post.posted_at
                          ? format(new Date(post.posted_at), "dd/MM/yy", { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {post.is_viral && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Flame className="h-4 w-4 text-orange-500" />
                              </TooltipTrigger>
                              <TooltipContent>Vídeo Viral</TooltipContent>
                            </Tooltip>
                          )}
                          <span className="truncate max-w-[300px]">
                            {post.caption || 'Sem legenda'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(post.views)}
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(post.likes)}</TableCell>
                      <TableCell className="text-right">{formatNumber(post.comments)}</TableCell>
                      <TableCell className="text-right">{formatNumber(post.shares)}</TableCell>
                      <TableCell className="text-right">{formatNumber(post.saves)}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            'font-medium',
                            (post.completion_rate || 0) >= 70
                              ? 'text-green-600'
                              : (post.completion_rate || 0) >= 50
                              ? 'text-amber-600'
                              : 'text-muted-foreground'
                          )}
                        >
                          {post.completion_rate ? `${post.completion_rate}%` : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {post.followers_gained > 0 && (
                          <span className="text-green-600 font-medium">
                            +{formatNumber(post.followers_gained)}
                          </span>
                        )}
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
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(post)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <TikTokConnectDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        onConnect={handleConnect}
        isLoading={createProfile.isPending}
      />

      <AddTikTokPostDialog
        open={addPostDialogOpen}
        onOpenChange={setAddPostDialogOpen}
        onSubmit={handleAddPost}
        isLoading={createPost.isPending}
      />

      <EditTikTokPostDialog
        open={editPostDialogOpen}
        onOpenChange={(open) => {
          setEditPostDialogOpen(open);
          if (!open) setSelectedPost(null);
        }}
        post={selectedPost}
        onSubmit={(data) => selectedPost && handleEditPost(selectedPost.id, data)}
        isLoading={updatePost.isPending}
      />

      <DeleteTikTokPostDialog
        open={deletePostDialogOpen}
        onOpenChange={(open) => {
          setDeletePostDialogOpen(open);
          if (!open) setSelectedPost(null);
        }}
        post={selectedPost}
        onConfirm={() => selectedPost && handleDeletePost(selectedPost.id)}
        isLoading={deletePost.isPending}
      />
    </div>
  );
}
