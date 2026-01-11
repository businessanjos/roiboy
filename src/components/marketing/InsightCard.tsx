import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Eye, Users, MousePointerClick, UserPlus, Activity, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMetricValue, calculateChange, getMetricLabel, getMetricColor } from '@/lib/meta-csv-parser';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InsightDataPoint {
  date: Date;
  value: number;
}

interface InsightCardProps {
  metricType: string;
  currentData: InsightDataPoint[];
  previousData: InsightDataPoint[];
  isLoading?: boolean;
}

const metricIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  views: Eye,
  reach: Target,
  interactions: Activity,
  link_clicks: MousePointerClick,
  visits: Users,
  followers: UserPlus,
};

export function InsightCard({ metricType, currentData, previousData, isLoading }: InsightCardProps) {
  const Icon = metricIcons[metricType] || Eye;
  const color = getMetricColor(metricType);
  const label = getMetricLabel(metricType);

  const { totalCurrent, totalPrevious, percentChange } = useMemo(() => {
    const totalCurrent = currentData.reduce((sum, d) => sum + d.value, 0);
    const totalPrevious = previousData.reduce((sum, d) => sum + d.value, 0);
    const percentChange = calculateChange(totalCurrent, totalPrevious);
    return { totalCurrent, totalPrevious, percentChange };
  }, [currentData, previousData]);

  const chartData = useMemo(() => {
    return currentData.map((d) => ({
      date: format(d.date, 'dd/MM', { locale: ptBR }),
      value: d.value,
    }));
  }, [currentData]);

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-8 w-20 mb-1" />
          <Skeleton className="h-4 w-16 mb-3" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasData = currentData.length > 0;
  const TrendIcon = percentChange > 0 ? TrendingUp : percentChange < 0 ? TrendingDown : Minus;
  const trendColor = percentChange > 0 ? 'text-emerald-600' : percentChange < 0 ? 'text-red-500' : 'text-muted-foreground';

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4" style={{ color }} />
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>

        {/* Value */}
        <div className="text-2xl font-bold mb-1">
          {hasData ? formatMetricValue(totalCurrent) : '—'}
        </div>

        {/* Change */}
        {hasData && previousData.length > 0 && (
          <div className={`flex items-center gap-1 text-sm ${trendColor} mb-3`}>
            <TrendIcon className="h-3.5 w-3.5" />
            <span>{Math.abs(percentChange).toFixed(1)}%</span>
          </div>
        )}

        {/* Chart */}
        {hasData ? (
          <div className="h-20 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`gradient-${metricType}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [formatMetricValue(value), label]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#gradient-${metricType})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-20 flex items-center justify-center text-sm text-muted-foreground">
            Sem dados
          </div>
        )}
      </CardContent>
    </Card>
  );
}
