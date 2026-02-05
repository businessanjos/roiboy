import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Users,
  Percent,
  Eye,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  BarChart3,
  Music2,
  Maximize2,
  Minimize2,
  X,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';

interface ProfileWithMetrics {
  id: string;
  username: string;
  display_name: string | null;
  profile_picture_url: string | null;
  followers_count: number;
  followers_previous_count: number;
  following_count: number;
  videos_count: number;
  likes_count: number;
  avg_views: number;
  avg_likes: number;
  avg_comments: number;
  avg_completion_rate: number;
  avg_engagement: number;
}

type SortField = 'followers' | 'engagement' | 'views' | 'completion' | 'likes';
type SortDirection = 'asc' | 'desc';

export function TikTokDashboard() {
  const { currentUser: user } = useCurrentUser();
  const [monthFilter, setMonthFilter] = useState<string>('3');
  const [sortField, setSortField] = useState<SortField>('followers');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ESC key listener for focus mode
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocusMode) {
        setIsFocusMode(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isFocusMode]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
      await document.exitFullscreen();
    }
  };

  const dateRange = useMemo(() => {
    const months = parseInt(monthFilter);
    const endDate = endOfMonth(new Date());
    const startDate = startOfMonth(subMonths(new Date(), months - 1));
    return { startDate, endDate };
  }, [monthFilter]);

  const { data: profilesWithMetrics = [], isLoading } = useQuery({
    queryKey: ['tiktok-dashboard', user?.account_id, dateRange],
    queryFn: async () => {
      if (!user?.account_id) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from('tiktok_profiles')
        .select('*')
        .eq('account_id', user.account_id)
        .eq('is_active', true)
        .order('followers_count', { ascending: false });

      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) return [];

      const profileIds = profiles.map((p) => p.id);
      const { data: posts, error: postsError } = await supabase
        .from('tiktok_posts')
        .select('profile_id, views, likes, comments, shares, saves, completion_rate, engagement_rate')
        .in('profile_id', profileIds)
        .gte('posted_at', dateRange.startDate.toISOString())
        .lte('posted_at', dateRange.endDate.toISOString());

      if (postsError) throw postsError;

      const profileMetrics: ProfileWithMetrics[] = profiles.map((profile) => {
        const profilePosts = posts?.filter((p) => p.profile_id === profile.id) || [];
        const postCount = profilePosts.length;

        const totalViews = profilePosts.reduce((sum, p) => sum + (p.views || 0), 0);
        const totalLikes = profilePosts.reduce((sum, p) => sum + (p.likes || 0), 0);
        const totalComments = profilePosts.reduce((sum, p) => sum + (p.comments || 0), 0);
        const totalCompletionRate = profilePosts.reduce((sum, p) => sum + (p.completion_rate || 0), 0);
        const totalEngagement = profilePosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0);

        return {
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          profile_picture_url: profile.profile_picture_url,
          followers_count: profile.followers_count || 0,
          followers_previous_count: profile.followers_previous_count || 0,
          following_count: profile.following_count || 0,
          videos_count: profile.videos_count || 0,
          likes_count: profile.likes_count || 0,
          avg_views: postCount > 0 ? Math.round(totalViews / postCount) : 0,
          avg_likes: postCount > 0 ? Math.round(totalLikes / postCount) : 0,
          avg_comments: postCount > 0 ? Math.round(totalComments / postCount) : 0,
          avg_completion_rate: postCount > 0 ? Math.round((totalCompletionRate / postCount) * 10) / 10 : 0,
          avg_engagement: postCount > 0 ? Math.round((totalEngagement / postCount) * 10) / 10 : 0,
        };
      });

      return profileMetrics;
    },
    enabled: !!user?.account_id,
  });

  const sortedProfiles = useMemo(() => {
    const sorted = [...profilesWithMetrics].sort((a, b) => {
      let aValue: number, bValue: number;

      switch (sortField) {
        case 'followers':
          aValue = a.followers_count;
          bValue = b.followers_count;
          break;
        case 'engagement':
          aValue = a.avg_engagement;
          bValue = b.avg_engagement;
          break;
        case 'views':
          aValue = a.avg_views;
          bValue = b.avg_views;
          break;
        case 'completion':
          aValue = a.avg_completion_rate;
          bValue = b.avg_completion_rate;
          break;
        case 'likes':
          aValue = a.avg_likes;
          bValue = b.avg_likes;
          break;
        default:
          aValue = a.followers_count;
          bValue = b.followers_count;
      }

      return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
    });

    return sorted;
  }, [profilesWithMetrics, sortField, sortDirection]);

  const totals = useMemo(() => {
    const totalFollowers = profilesWithMetrics.reduce((sum, p) => sum + p.followers_count, 0);
    const totalVideos = profilesWithMetrics.reduce((sum, p) => sum + p.videos_count, 0);
    const avgEngagement =
      profilesWithMetrics.length > 0
        ? profilesWithMetrics.reduce((sum, p) => sum + p.avg_engagement, 0) /
          profilesWithMetrics.length
        : 0;
    const avgCompletionRate =
      profilesWithMetrics.length > 0
        ? profilesWithMetrics.reduce((sum, p) => sum + p.avg_completion_rate, 0) /
          profilesWithMetrics.length
        : 0;

    return {
      totalFollowers,
      totalVideos,
      avgEngagement: Math.round(avgEngagement * 10) / 10,
      avgCompletionRate: Math.round(avgCompletionRate * 10) / 10,
      profileCount: profilesWithMetrics.length,
    };
  }, [profilesWithMetrics]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getGrowthIndicator = (current: number, previous: number) => {
    if (previous === 0) return null;
    const growth = ((current - previous) / previous) * 100;

    if (growth > 0) {
      return (
        <span className="flex items-center gap-0.5 text-green-600 text-xs">
          <TrendingUp className="h-3 w-3" />
          {Math.round(growth)}%
        </span>
      );
    } else if (growth < 0) {
      return (
        <span className="flex items-center gap-0.5 text-red-600 text-xs">
          <TrendingDown className="h-3 w-3" />
          {Math.abs(Math.round(growth))}%
        </span>
      );
    }
    return (
      <span className="flex items-center gap-0.5 text-muted-foreground text-xs">
        <Minus className="h-3 w-3" />
      </span>
    );
  };

  const SortableHeader = ({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <TableHead
      className={cn('cursor-pointer hover:bg-muted/50 transition-colors select-none', className)}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1 justify-end">
        {children}
        {sortField === field && (
          <span className="text-primary">
            {sortDirection === 'desc' ? '↓' : '↑'}
          </span>
        )}
      </div>
    </TableHead>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (profilesWithMetrics.length === 0) {
    return (
      <Card className="p-12">
        <div className="text-center space-y-4">
          <Music2 className="h-12 w-12 mx-auto text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold">Nenhum perfil encontrado</h3>
            <p className="text-muted-foreground">
              Adicione perfis do TikTok na aba "Perfis" para visualizar o dashboard consolidado.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Visão Consolidada TikTok</h2>
        <div className="flex items-center gap-2">
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-[180px] bg-card">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Último mês</SelectItem>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsFocusMode(true)}
            title="Modo Foco (ideal para TV)"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Seguidores</p>
                <p className="text-2xl font-bold">{formatNumber(totals.totalFollowers)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Percent className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Engaj. Médio</p>
                <p className="text-2xl font-bold">{totals.avgEngagement}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Clock className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa Conclusão</p>
                <p className="text-2xl font-bold">{totals.avgCompletionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Vídeos</p>
                <p className="text-2xl font-bold">{formatNumber(totals.totalVideos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <BarChart3 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Perfis Ativos</p>
                <p className="text-2xl font-bold">{totals.profileCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profiles Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Métricas por Perfil</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[250px]">Perfil</TableHead>
                  <SortableHeader field="followers" className="text-right">
                    Seguidores
                  </SortableHeader>
                  <TableHead className="text-right">Vídeos</TableHead>
                  <SortableHeader field="views" className="text-right">
                    Méd. Views
                  </SortableHeader>
                  <SortableHeader field="engagement" className="text-right">
                    Engaj. %
                  </SortableHeader>
                  <SortableHeader field="completion" className="text-right">
                    Conclusão %
                  </SortableHeader>
                  <SortableHeader field="likes" className="text-right">
                    Méd. Curtidas
                  </SortableHeader>
                  <TableHead className="text-right">Méd. Comentários</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProfiles.map((profile) => (
                  <TableRow key={profile.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-gray-200">
                          <AvatarImage src={profile.profile_picture_url || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-gray-700 to-black text-white text-sm">
                            {profile.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">@{profile.username}</p>
                          {profile.display_name && (
                            <p className="text-xs text-muted-foreground">{profile.display_name}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-medium">{formatNumber(profile.followers_count)}</span>
                        {getGrowthIndicator(profile.followers_count, profile.followers_previous_count)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(profile.videos_count)}</TableCell>
                    <TableCell className="text-right">{formatNumber(profile.avg_views)}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          'font-medium',
                          profile.avg_engagement >= 10
                            ? 'text-green-600'
                            : profile.avg_engagement >= 5
                            ? 'text-amber-600'
                            : 'text-muted-foreground'
                        )}
                      >
                        {profile.avg_engagement}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          'font-medium',
                          profile.avg_completion_rate >= 70
                            ? 'text-green-600'
                            : profile.avg_completion_rate >= 50
                            ? 'text-amber-600'
                            : 'text-muted-foreground'
                        )}
                      >
                        {profile.avg_completion_rate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(profile.avg_likes)}</TableCell>
                    <TableCell className="text-right">{formatNumber(profile.avg_comments)}</TableCell>
                    <TableCell>
                      <a
                        href={`https://tiktok.com/@${profile.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Focus Mode Overlay */}
      {isFocusMode && (
        <div className="fixed inset-0 z-[9999] bg-background overflow-auto">
          <div className="container mx-auto py-8 px-6 max-w-7xl">
            {/* Header with buttons */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Visão Consolidada TikTok</h2>
              <div className="flex items-center gap-2">
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger className="w-[180px] bg-card">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Último mês</SelectItem>
                    <SelectItem value="3">Últimos 3 meses</SelectItem>
                    <SelectItem value="6">Últimos 6 meses</SelectItem>
                    <SelectItem value="12">Último ano</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-5 w-5" />
                  ) : (
                    <Maximize2 className="h-5 w-5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFocusMode(false)}
                  className="hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Seguidores</p>
                      <p className="text-3xl font-bold">{formatNumber(totals.totalFollowers)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-green-500/10">
                      <Percent className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Engaj. Médio</p>
                      <p className="text-3xl font-bold">{totals.avgEngagement}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-cyan-500/10">
                      <Clock className="h-6 w-6 text-cyan-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Taxa Conclusão</p>
                      <p className="text-3xl font-bold">{totals.avgCompletionRate}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-500/10">
                      <Eye className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Vídeos</p>
                      <p className="text-3xl font-bold">{formatNumber(totals.totalVideos)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-purple-500/10">
                      <BarChart3 className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Perfis Ativos</p>
                      <p className="text-3xl font-bold">{totals.profileCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Profiles Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">Métricas por Perfil</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[250px]">Perfil</TableHead>
                        <TableHead className="text-right">Seguidores</TableHead>
                        <TableHead className="text-right">Vídeos</TableHead>
                        <TableHead className="text-right">Méd. Views</TableHead>
                        <TableHead className="text-right">Engaj. %</TableHead>
                        <TableHead className="text-right">Conclusão %</TableHead>
                        <TableHead className="text-right">Méd. Curtidas</TableHead>
                        <TableHead className="text-right">Méd. Comentários</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedProfiles.map((profile) => (
                        <TableRow key={profile.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border-2 border-gray-200">
                                <AvatarImage src={profile.profile_picture_url || undefined} />
                                <AvatarFallback className="bg-gradient-to-br from-gray-700 to-black text-white text-sm">
                                  {profile.username.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">@{profile.username}</p>
                                {profile.display_name && (
                                  <p className="text-xs text-muted-foreground">{profile.display_name}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="font-medium">{formatNumber(profile.followers_count)}</span>
                              {getGrowthIndicator(profile.followers_count, profile.followers_previous_count)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatNumber(profile.videos_count)}</TableCell>
                          <TableCell className="text-right">{formatNumber(profile.avg_views)}</TableCell>
                          <TableCell className="text-right">
                            <span
                              className={cn(
                                'font-medium',
                                profile.avg_engagement >= 10
                                  ? 'text-green-600'
                                  : profile.avg_engagement >= 5
                                  ? 'text-amber-600'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {profile.avg_engagement}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={cn(
                                'font-medium',
                                profile.avg_completion_rate >= 70
                                  ? 'text-green-600'
                                  : profile.avg_completion_rate >= 50
                                  ? 'text-amber-600'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {profile.avg_completion_rate}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{formatNumber(profile.avg_likes)}</TableCell>
                          <TableCell className="text-right">{formatNumber(profile.avg_comments)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
