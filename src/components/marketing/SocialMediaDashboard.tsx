import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Users,
  Percent,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  BarChart3,
} from 'lucide-react';
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
  posts_count: number;
  avg_likes: number;
  avg_comments: number;
  avg_engagement: number;
  total_reach: number;
}

type SortField = 'followers' | 'engagement' | 'likes' | 'comments';
type SortDirection = 'asc' | 'desc';

export function SocialMediaDashboard() {
  const { currentUser: user } = useCurrentUser();
  const [monthFilter, setMonthFilter] = useState<string>('3');
  const [sortField, setSortField] = useState<SortField>('followers');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Calculate date range based on filter
  const dateRange = useMemo(() => {
    const months = parseInt(monthFilter);
    const endDate = endOfMonth(new Date());
    const startDate = startOfMonth(subMonths(new Date(), months - 1));
    return { startDate, endDate };
  }, [monthFilter]);

  // Fetch all profiles with aggregated metrics
  const { data: profilesWithMetrics = [], isLoading } = useQuery({
    queryKey: ['instagram-dashboard', user?.account_id, dateRange],
    queryFn: async () => {
      if (!user?.account_id) return [];

      // Fetch all active profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('instagram_profiles')
        .select('*')
        .eq('account_id', user.account_id)
        .eq('is_active', true)
        .order('followers_count', { ascending: false });

      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) return [];

      // Fetch posts for all profiles in date range
      const profileIds = profiles.map((p) => p.id);
      const { data: posts, error: postsError } = await supabase
        .from('instagram_posts')
        .select('profile_id, likes, comments, shares, saves, reach, engagement_rate')
        .in('profile_id', profileIds)
        .gte('posted_at', dateRange.startDate.toISOString())
        .lte('posted_at', dateRange.endDate.toISOString());

      if (postsError) throw postsError;

      // Calculate metrics for each profile
      const profileMetrics: ProfileWithMetrics[] = profiles.map((profile) => {
        const profilePosts = posts?.filter((p) => p.profile_id === profile.id) || [];
        const postCount = profilePosts.length;

        const totalLikes = profilePosts.reduce((sum, p) => sum + (p.likes || 0), 0);
        const totalComments = profilePosts.reduce((sum, p) => sum + (p.comments || 0), 0);
        const totalReach = profilePosts.reduce((sum, p) => sum + (p.reach || 0), 0);
        const totalEngagement = profilePosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0);

        return {
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          profile_picture_url: profile.profile_picture_url,
          followers_count: profile.followers_count || 0,
          followers_previous_count: profile.followers_previous_count || 0,
          following_count: profile.following_count || 0,
          posts_count: profile.posts_count || 0,
          avg_likes: postCount > 0 ? Math.round(totalLikes / postCount) : 0,
          avg_comments: postCount > 0 ? Math.round(totalComments / postCount) : 0,
          avg_engagement: postCount > 0 ? Math.round((totalEngagement / postCount) * 10) / 10 : 0,
          total_reach: totalReach,
        };
      });

      return profileMetrics;
    },
    enabled: !!user?.account_id,
  });

  // Sort profiles
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
        case 'likes':
          aValue = a.avg_likes;
          bValue = b.avg_likes;
          break;
        case 'comments':
          aValue = a.avg_comments;
          bValue = b.avg_comments;
          break;
        default:
          aValue = a.followers_count;
          bValue = b.followers_count;
      }

      return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
    });

    return sorted;
  }, [profilesWithMetrics, sortField, sortDirection]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalFollowers = profilesWithMetrics.reduce((sum, p) => sum + p.followers_count, 0);
    const totalPosts = profilesWithMetrics.reduce((sum, p) => sum + p.posts_count, 0);
    const avgEngagement =
      profilesWithMetrics.length > 0
        ? profilesWithMetrics.reduce((sum, p) => sum + p.avg_engagement, 0) /
          profilesWithMetrics.length
        : 0;

    return {
      totalFollowers,
      totalPosts,
      avgEngagement: Math.round(avgEngagement * 10) / 10,
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
      <div className="flex items-center gap-1">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold">Nenhum perfil encontrado</h3>
            <p className="text-muted-foreground">
              Adicione perfis do Instagram na aba "Perfis" para visualizar o dashboard consolidado.
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
        <h2 className="text-lg font-semibold">Visão Consolidada</h2>
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
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <div className="p-2 rounded-lg bg-blue-500/10">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Posts</p>
                <p className="text-2xl font-bold">{formatNumber(totals.totalPosts)}</p>
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
                  <TableHead className="text-right">Seguindo</TableHead>
                  <TableHead className="text-right">Posts</TableHead>
                  <SortableHeader field="engagement" className="text-right">
                    Engaj. %
                  </SortableHeader>
                  <SortableHeader field="likes" className="text-right">
                    Méd. Curtidas
                  </SortableHeader>
                  <SortableHeader field="comments" className="text-right">
                    Méd. Comentários
                  </SortableHeader>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProfiles.map((profile) => (
                  <TableRow key={profile.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-pink-200">
                          <AvatarImage src={profile.profile_picture_url || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-pink-400 to-purple-500 text-white text-sm">
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
                    <TableCell className="text-right">{formatNumber(profile.following_count)}</TableCell>
                    <TableCell className="text-right">{formatNumber(profile.posts_count)}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          'font-medium',
                          profile.avg_engagement >= 5
                            ? 'text-green-600'
                            : profile.avg_engagement >= 2
                            ? 'text-amber-600'
                            : 'text-muted-foreground'
                        )}
                      >
                        {profile.avg_engagement}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(profile.avg_likes)}</TableCell>
                    <TableCell className="text-right">{formatNumber(profile.avg_comments)}</TableCell>
                    <TableCell>
                      <a
                        href={`https://instagram.com/${profile.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-pink-500" />
                      </a>
                    </TableCell>
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
