import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { InsightCard } from './InsightCard';
import { MetaInsightsImporter } from './MetaInsightsImporter';
import { subDays, startOfDay, endOfDay } from 'date-fns';

interface ProfileInsightsDashboardProps {
  profileId: string;
  profiles: Array<{ id: string; username: string }>;
  period: string;
  onPeriodChange: (period: string) => void;
}

const METRIC_TYPES = ['views', 'reach', 'interactions', 'link_clicks', 'visits', 'followers'];

const PERIOD_OPTIONS = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '14', label: 'Últimos 14 dias' },
  { value: '28', label: 'Últimos 28 dias' },
  { value: '90', label: 'Últimos 90 dias' },
];

export function ProfileInsightsDashboard({ profileId, profiles, period, onPeriodChange }: ProfileInsightsDashboardProps) {
  const queryClient = useQueryClient();
  const [importerOpen, setImporterOpen] = useState(false);

  const periodDays = parseInt(period);

  const dateRange = useMemo(() => {
    const now = new Date();
    const currentEnd = endOfDay(now);
    const currentStart = startOfDay(subDays(now, periodDays - 1));
    const previousEnd = startOfDay(subDays(now, periodDays));
    const previousStart = startOfDay(subDays(now, periodDays * 2 - 1));

    return {
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
    };
  }, [periodDays]);

  // Fetch insights data
  const { data: insightsData, isLoading } = useQuery({
    queryKey: ['instagram-insights', profileId, period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instagram_insights')
        .select('metric_type, metric_date, value')
        .eq('profile_id', profileId)
        .gte('metric_date', dateRange.previousStart.toISOString().split('T')[0])
        .lte('metric_date', dateRange.currentEnd.toISOString().split('T')[0])
        .order('metric_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!profileId,
  });

  // Organize data by metric type and period
  const organizedData = useMemo(() => {
    if (!insightsData) return {};

    const result: Record<string, { current: Array<{ date: Date; value: number }>; previous: Array<{ date: Date; value: number }> }> = {};

    METRIC_TYPES.forEach((type) => {
      result[type] = { current: [], previous: [] };
    });

    insightsData.forEach((row) => {
      const rowDate = new Date(row.metric_date + 'T00:00:00');
      const dataPoint = { date: rowDate, value: Number(row.value) };

      if (rowDate >= dateRange.currentStart && rowDate <= dateRange.currentEnd) {
        result[row.metric_type]?.current.push(dataPoint);
      } else if (rowDate >= dateRange.previousStart && rowDate < dateRange.currentStart) {
        result[row.metric_type]?.previous.push(dataPoint);
      }
    });

    return result;
  }, [insightsData, dateRange]);

  const hasAnyData = insightsData && insightsData.length > 0;

  const handleImportSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['instagram-insights', profileId] });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={period} onValueChange={onPeriodChange}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setImporterOpen(true)}
        >
          <Upload className="h-4 w-4" />
          Importar CSV
        </Button>
      </div>

      {/* Insights Grid */}
      {hasAnyData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {METRIC_TYPES.map((type) => (
            <InsightCard
              key={type}
              metricType={type}
              currentData={organizedData[type]?.current || []}
              previousData={organizedData[type]?.previous || []}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Upload className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum dado importado</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            Importe os arquivos CSV exportados do Meta Business Suite para visualizar as métricas de performance do seu perfil.
          </p>
          <Button onClick={() => setImporterOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Importar do Meta
          </Button>
        </div>
      )}

      {/* Importer Dialog */}
      <MetaInsightsImporter
        open={importerOpen}
        onOpenChange={setImporterOpen}
        profiles={profiles}
        selectedProfileId={profileId}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}
