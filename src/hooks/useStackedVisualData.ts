import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { VisualConfig } from "@/components/insights/visual-builder/types";
import { format, parseISO } from "date-fns";

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

  // Determine date field
  const dateField = dimension.field || 'created_at';

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

  if (allDeals.length === 0) return { data: [], seriesKeys: [] };

  // Group by day number and by seller
  const dayMap = new Map<number, Map<string, number>>();
  const allSellers = new Set<string>();

  for (const deal of allDeals) {
    const dateStr = (deal as any)[dateField];
    if (!dateStr) continue;

    const date = parseISO(dateStr);
    const dayNum = date.getDate();
    const sellerName = (deal.users as any)?.name || 'Sem Responsável';

    allSellers.add(sellerName);

    if (!dayMap.has(dayNum)) dayMap.set(dayNum, new Map());
    const sellerMap = dayMap.get(dayNum)!;

    const currentVal = sellerMap.get(sellerName) || 0;

    if (measure.aggregation === 'count') {
      sellerMap.set(sellerName, currentVal + 1);
    } else {
      // sum or avg - for stacked, sum makes more sense
      sellerMap.set(sellerName, currentVal + (deal.value || 0));
    }
  }

  // Remove "Sem Responsável" from sellers
  allSellers.delete('Sem Responsável');

  const seriesKeys = Array.from(allSellers).sort();

  // Build data points for each day that has data
  const result: StackedDataPoint[] = [];
  const sortedDays = Array.from(dayMap.keys()).sort((a, b) => a - b);

  for (const day of sortedDays) {
    const sellerMap = dayMap.get(day)!;
    const point: StackedDataPoint = { name: String(day) };
    let hasValue = false;

    for (const seller of seriesKeys) {
      const val = sellerMap.get(seller) || 0;
      if (val > 0) hasValue = true;
      point[seller] = val;
    }

    if (hasValue) {
      result.push(point);
    }
  }

  return { data: result, seriesKeys };
}
