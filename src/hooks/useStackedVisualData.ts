import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { VisualConfig } from "@/components/insights/visual-builder/types";
import { format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth } from "date-fns";

export interface StackedDataPoint {
  name: string;
  [key: string]: string | number;
}

interface UseStackedVisualDataParams {
  config: VisualConfig | null;
  enabled?: boolean;
}

export function useStackedVisualData({ config, enabled = true }: UseStackedVisualDataParams) {
  const { currentUser } = useCurrentUser();
  const { filters } = useInsightsFilters();

  return useQuery({
    queryKey: ['stacked-visual-data', config, filters, currentUser?.account_id],
    queryFn: async (): Promise<{ data: StackedDataPoint[]; seriesKeys: string[] }> => {
      if (!config || !currentUser?.account_id || !config.stackBy) {
        return { data: [], seriesKeys: [] };
      }

      return fetchStackedDealsData(
        currentUser.account_id,
        config,
        filters
      );
    },
    enabled: enabled && !!config && !!config.stackBy && !!currentUser?.account_id,
    staleTime: 120000,
    refetchOnWindowFocus: false,
  });
}

async function fetchStackedDealsData(
  accountId: string,
  config: VisualConfig,
  filters: any
): Promise<{ data: StackedDataPoint[]; seriesKeys: string[] }> {
  const { measure, dimension, statusFilter } = config;

  let query = supabase
    .from('deals')
    .select(`
      id, value, status, created_at, won_at, lost_at,
      users!deals_responsible_user_id_fkey(name)
    `)
    .eq('account_id', accountId);

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  // Determine date field with smart mapping (same logic as useVisualData)
  let dateField: string;
  if (dimension.field && dimension.field !== 'created_at') {
    dateField = dimension.field;
  } else if (statusFilter === 'won') {
    dateField = 'won_at';
  } else if (statusFilter === 'lost') {
    dateField = 'lost_at';
  } else {
    dateField = 'created_at';
  }

  if (dateField === 'won_at') {
    query = query.not('won_at', 'is', null);
  } else if (dateField === 'lost_at') {
    query = query.not('lost_at', 'is', null);
  }

  if (filters.startDate) query = query.gte(dateField, filters.startDate);
  if (filters.endDate) query = query.lte(dateField, filters.endDate);
  if (filters.userId && filters.userId !== 'all') query = query.eq('responsible_user_id', filters.userId);
  if (filters.stageId && filters.stageId !== 'all') query = query.eq('stage_id', filters.stageId);

  // Paginate
  let allDeals: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) { console.error('Error fetching stacked deals:', error); return { data: [], seriesKeys: [] }; }
    allDeals = allDeals.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  // Determine the full date range from filters
  let rangeStart: Date;
  let rangeEnd: Date;

  if (filters.startDate && filters.endDate) {
    rangeStart = parseISO(filters.startDate);
    rangeEnd = parseISO(filters.endDate);
  } else if (filters.startDate) {
    rangeStart = parseISO(filters.startDate);
    rangeEnd = endOfMonth(rangeStart);
  } else if (filters.endDate) {
    rangeEnd = parseISO(filters.endDate);
    rangeStart = startOfMonth(rangeEnd);
  } else {
    // Default to current month
    rangeStart = startOfMonth(new Date());
    rangeEnd = endOfMonth(new Date());
  }

  // Generate all days in the interval
  const allDays = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  // Check if range spans multiple months
  const spansMultipleMonths = rangeStart.getMonth() !== rangeEnd.getMonth() || rangeStart.getFullYear() !== rangeEnd.getFullYear();

  // Group by full date key (yyyy-MM-dd) and by seller
  const dayMap = new Map<string, Map<string, number>>();
  const allSellers = new Set<string>();

  for (const deal of allDeals) {
    const dateStr = (deal as any)[dateField];
    if (!dateStr) continue;

    const date = parseISO(dateStr);
    const dayKey = format(date, 'yyyy-MM-dd');
    const sellerName = (deal.users as any)?.name || 'Sem Responsável';

    allSellers.add(sellerName);

    if (!dayMap.has(dayKey)) dayMap.set(dayKey, new Map());
    const sellerMap = dayMap.get(dayKey)!;

    const currentVal = sellerMap.get(sellerName) || 0;

    if (measure.aggregation === 'count') {
      sellerMap.set(sellerName, currentVal + 1);
    } else {
      sellerMap.set(sellerName, currentVal + (deal.value || 0));
    }
  }

  // Remove "Sem Responsável" from sellers
  allSellers.delete('Sem Responsável');

  const seriesKeys = Array.from(allSellers).sort();

  // Build data points for ALL days in the range
  const result: StackedDataPoint[] = [];

  for (const day of allDays) {
    const dayKey = format(day, 'yyyy-MM-dd');
    const label = spansMultipleMonths ? format(day, 'd/MMM') : String(day.getDate());
    const sellerMap = dayMap.get(dayKey);
    const point: StackedDataPoint = { name: label };

    for (const seller of seriesKeys) {
      point[seller] = sellerMap?.get(seller) || 0;
    }

    result.push(point);
  }

  return { data: result, seriesKeys };
}
