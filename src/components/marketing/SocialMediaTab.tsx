import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
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
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSocialMediaData, InstagramPost } from '@/hooks/useSocialMediaData';
import { SocialMediaKPICard } from './SocialMediaKPICard';
import { PostFormatBadge } from './PostFormatBadge';
import { PostObjectiveBadge } from './PostObjectiveBadge';
import { InstagramConnectDialog } from './InstagramConnectDialog';
import { InstagramProfileHeader } from './InstagramProfileHeader';
import { AddPostDialog, PostFormData } from './AddPostDialog';
import { EditPostDialog, EditPostFormData } from './EditPostDialog';
import { DeletePostDialog } from './DeletePostDialog';
import { cn } from '@/lib/utils';

export function SocialMediaTab() {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [addPostDialogOpen, setAddPostDialogOpen] = useState(false);
  const [editPostDialogOpen, setEditPostDialogOpen] = useState(false);
  const [deletePostDialogOpen, setDeletePostDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null);
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [objectiveFilter, setObjectiveFilter] = useState<string>('all');
  
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
    createPost,
    updatePost,
    deletePost,
  } = useSocialMediaData();

  // Filter posts based on selected filters
  const filteredPosts = posts.filter((post) => {
    const matchesFormat = formatFilter === 'all' || post.post_type === formatFilter;
    const matchesObjective = objectiveFilter === 'all' || post.ai_objective === objectiveFilter;
    return matchesFormat && matchesObjective;
  });

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
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

  const handleEditPost = (postId: string, data: EditPostFormData) => {
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
      <InstagramProfileHeader profile={currentProfile} isLoading={isLoading} />

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
                <SelectItem key={profile.id} value={profile.id}>
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

          {useMockData && (
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
              Dados de exemplo
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled
          >
            <RefreshCw className="h-4 w-4" />
            Sincronizar
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

      {/* Posts Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              Análise de Conteúdos
              <Badge variant="secondary" className="font-normal">
                {filteredPosts.length} posts
              </Badge>
            </CardTitle>

            <div className="flex items-center gap-2">
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
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead className="w-[100px]">Formato</TableHead>
                  <TableHead className="w-[120px]">Objetivo (IA)</TableHead>
                  <TableHead className="min-w-[200px]">Conteúdo</TableHead>
                  <TableHead className="text-right w-[80px]">
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 ml-auto">
                        <Eye className="h-3.5 w-3.5" />
                      </TooltipTrigger>
                      <TooltipContent>Alcance</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="text-right w-[70px]">
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 ml-auto">
                        <Heart className="h-3.5 w-3.5" />
                      </TooltipTrigger>
                      <TooltipContent>Curtidas</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="text-right w-[70px]">
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 ml-auto">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </TooltipTrigger>
                      <TooltipContent>Comentários</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="text-right w-[70px]">
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 ml-auto">
                        <Share2 className="h-3.5 w-3.5" />
                      </TooltipTrigger>
                      <TooltipContent>Compartilhamentos</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="text-right w-[70px]">
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 ml-auto">
                        <Bookmark className="h-3.5 w-3.5" />
                      </TooltipTrigger>
                      <TooltipContent>Salvamentos</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="text-right w-[70px]">
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 ml-auto">
                        <Link2 className="h-3.5 w-3.5" />
                      </TooltipTrigger>
                      <TooltipContent>Cliques no Link</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="text-right w-[90px] font-semibold text-primary">
                    Engaj. %
                  </TableHead>
                  <TableHead className="text-right w-[90px] font-semibold text-primary">
                    Viral %
                  </TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPosts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-12 text-muted-foreground">
                      {posts.length === 0 
                        ? 'Nenhum post encontrado para este perfil.'
                        : 'Nenhum post encontrado com os filtros selecionados.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPosts.map((post) => (
                    <TableRow 
                      key={post.id}
                      className={cn(
                        'group transition-colors',
                        post.is_trending && 'bg-amber-50/50 dark:bg-amber-950/10'
                      )}
                    >
                      <TableCell className="font-medium text-sm">
                        {format(new Date(post.posted_at), 'dd/MM', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <PostFormatBadge format={post.post_type} />
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
                        <Badge
                          variant="outline" 
                          className={cn(
                            'font-semibold',
                            post.engagement_rate >= 10 
                              ? 'bg-green-100 text-green-700 border-green-200' 
                              : post.engagement_rate >= 5
                              ? 'bg-amber-100 text-amber-700 border-amber-200'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                          )}
                        >
                          {post.engagement_rate.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            'font-semibold',
                            post.virality_rate >= 1.5 
                              ? 'bg-purple-100 text-purple-700 border-purple-200' 
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                          )}
                        >
                          {post.virality_rate.toFixed(2)}%
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
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
    </div>
  );
}
