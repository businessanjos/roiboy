import { useMemo } from 'react';
import { format, startOfWeek, getISOWeek, getYear, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Area,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  FileText, 
  Eye, 
  Percent, 
  Users 
} from 'lucide-react';
import { InstagramPost } from '@/hooks/useSocialMediaData';
import { cn } from '@/lib/utils';

interface WeeklyAnalysisDashboardProps {
  posts: InstagramPost[];
  isLoading?: boolean;
}

interface WeeklyData {
  week: string;
  weekLabel: string;
  weekNumber: number;
  year: number;
  postCount: number;
  totalReach: number;
  avgReach: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  totalEngagement: number;
  avgEngagement: number;
  followersGained: number;
}

function KPICard({ 
  title, 
  value, 
  previousValue, 
  icon: Icon,
  suffix = ''
}: { 
  title: string; 
  value: number; 
  previousValue: number; 
  icon: React.ElementType;
  suffix?: string;
}) {
  const change = previousValue > 0 
    ? ((value - previousValue) / previousValue) * 100 
    : 0;
  
  const isPositive = change > 0;
  const isNegative = change < 0;

  const formatValue = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('pt-BR');
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">
              {formatValue(value)}{suffix}
            </p>
            {previousValue > 0 && (
              <div className={cn(
                "flex items-center gap-1 text-xs",
                isPositive && "text-emerald-600",
                isNegative && "text-red-600",
                !isPositive && !isNegative && "text-muted-foreground"
              )}>
                {isPositive && <TrendingUp className="h-3 w-3" />}
                {isNegative && <TrendingDown className="h-3 w-3" />}
                {!isPositive && !isNegative && <Minus className="h-3 w-3" />}
                <span>{Math.abs(change).toFixed(1)}% vs. semana anterior</span>
              </div>
            )}
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function WeeklyAnalysisDashboard({ posts, isLoading }: WeeklyAnalysisDashboardProps) {
  // Process posts into weekly data
  const weeklyData = useMemo(() => {
    if (!posts || posts.length === 0) return [];

    const weekMap = new Map<string, WeeklyData>();

    posts.forEach(post => {
      const postDate = parseISO(post.posted_at);
      const weekStart = startOfWeek(postDate, { weekStartsOn: 1 });
      const weekNumber = getISOWeek(postDate);
      const year = getYear(postDate);
      const weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
      
      const existing = weekMap.get(weekKey) || {
        week: weekKey,
        weekLabel: format(weekStart, "dd/MM", { locale: ptBR }),
        weekNumber,
        year,
        postCount: 0,
        totalReach: 0,
        avgReach: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalSaves: 0,
        totalEngagement: 0,
        avgEngagement: 0,
        followersGained: 0,
      };

      existing.postCount += 1;
      existing.totalReach += post.reach || 0;
      existing.totalLikes += post.likes || 0;
      existing.totalComments += post.comments || 0;
      existing.totalShares += post.shares || 0;
      existing.totalSaves += post.saves || 0;
      existing.followersGained += post.followers_gained || 0;
      existing.totalEngagement += (post.likes || 0) + (post.comments || 0) + (post.shares || 0) + (post.saves || 0);

      weekMap.set(weekKey, existing);
    });

    // Calculate averages and sort by week
    const result = Array.from(weekMap.values())
      .map(week => ({
        ...week,
        avgReach: week.postCount > 0 ? Math.round(week.totalReach / week.postCount) : 0,
        avgEngagement: week.postCount > 0 
          ? Math.round((week.totalEngagement / week.totalReach) * 1000) / 10 
          : 0,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    return result;
  }, [posts]);

  // Get current and previous week for KPIs
  const currentWeek = weeklyData[weeklyData.length - 1];
  const previousWeek = weeklyData[weeklyData.length - 2];

  // Get last 8 weeks for charts
  const chartData = weeklyData.slice(-8);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!posts || posts.length === 0 || weeklyData.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhum dado semanal disponível</p>
        <p className="text-sm">Adicione posts para visualizar a análise semanal.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Posts na Semana"
          value={currentWeek?.postCount || 0}
          previousValue={previousWeek?.postCount || 0}
          icon={FileText}
        />
        <KPICard
          title="Alcance Médio"
          value={currentWeek?.avgReach || 0}
          previousValue={previousWeek?.avgReach || 0}
          icon={Eye}
        />
        <KPICard
          title="Engajamento Médio"
          value={currentWeek?.avgEngagement || 0}
          previousValue={previousWeek?.avgEngagement || 0}
          icon={Percent}
          suffix="%"
        />
        <KPICard
          title="Seguidores Ganhos"
          value={currentWeek?.followersGained || 0}
          previousValue={previousWeek?.followersGained || 0}
          icon={Users}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Posts por Semana */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              Posts Publicados por Semana
              <Badge variant="secondary" className="font-normal">
                Últimas {chartData.length} semanas
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="weekLabel" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [value, 'Posts']}
                  labelFormatter={(label) => `Semana de ${label}`}
                />
                <Bar 
                  dataKey="postCount" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                  name="Posts"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Evolução do Engajamento */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução do Engajamento</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="weekLabel" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  unit="%"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Engajamento']}
                  labelFormatter={(label) => `Semana de ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="avgEngagement" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  name="Engajamento %"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Métricas Agregadas - Full Width */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Métricas Agregadas por Semana</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="weekLabel" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                yAxisId="left"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number, name: string) => {
                  const formatted = value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value;
                  return [formatted, name];
                }}
                labelFormatter={(label) => `Semana de ${label}`}
              />
              <Legend />
              <Bar 
                yAxisId="left"
                dataKey="totalLikes" 
                fill="hsl(346, 77%, 50%)" 
                name="Curtidas"
                stackId="a"
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                yAxisId="left"
                dataKey="totalComments" 
                fill="hsl(217, 91%, 60%)" 
                name="Comentários"
                stackId="a"
              />
              <Bar 
                yAxisId="left"
                dataKey="totalShares" 
                fill="hsl(142, 71%, 45%)" 
                name="Compartilhamentos"
                stackId="a"
              />
              <Bar 
                yAxisId="left"
                dataKey="totalSaves" 
                fill="hsl(48, 96%, 53%)" 
                name="Salvamentos"
                stackId="a"
                radius={[4, 4, 0, 0]}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="avgReach" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                name="Alcance Médio"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
