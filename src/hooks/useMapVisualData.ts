import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";

const CIDADE_FIELD_ID = '5accffbd-3d87-4735-b890-bc6c361694b7';

export interface MapDataPoint {
  city: string;
  lat: number;
  lng: number;
  revenue: number;
  dealCount: number;
}

export function useMapVisualData({ enabled = true }: { enabled?: boolean } = {}) {
  const { currentUser } = useCurrentUser();
  const { filters } = useInsightsFilters();

  const accountId = filters.accountIdOverride || currentUser?.account_id;

  return useQuery({
    queryKey: ['map-visual-data', filters, accountId],
    queryFn: async (): Promise<MapDataPoint[]> => {
      if (!accountId) return [];

      // 1. Fetch won deals with date filters
      let dealsQuery = supabase
        .from('deals')
        .select('id, value, won_at')
        .eq('account_id', accountId)
        .eq('status', 'won')
        .is('deleted_at', null)
        .not('won_at', 'is', null);

      if (filters.startDate) dealsQuery = dealsQuery.gte('won_at', filters.startDate);
      if (filters.endDate) dealsQuery = dealsQuery.lte('won_at', filters.endDate);
      if (filters.userId && filters.userId !== 'all') dealsQuery = dealsQuery.eq('responsible_user_id', filters.userId);

      let allDeals: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await dealsQuery.range(from, from + pageSize - 1);
        if (error) { console.error('Error fetching deals for map:', error); return []; }
        allDeals = allDeals.concat(data || []);
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }

      if (allDeals.length === 0) return [];

      // 2. Fetch city field values for these deals
      const dealIds = allDeals.map(d => d.id);
      let allFieldValues: any[] = [];
      const batchSize = 500;
      for (let i = 0; i < dealIds.length; i += batchSize) {
        const batch = dealIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('deal_field_values')
          .select('deal_id, value_json')
          .eq('field_id', CIDADE_FIELD_ID)
          .eq('account_id', accountId)
          .in('deal_id', batch)
          .not('value_json', 'is', null);

        if (error) { console.error('Error fetching city values:', error); continue; }
        allFieldValues = allFieldValues.concat(data || []);
      }

      // 3. Build city map: deal_id -> { formatted_address, lat, lng }
      const cityMap = new Map<string, { formatted_address: string; latitude: number; longitude: number }>();
      for (const fv of allFieldValues) {
        const json = fv.value_json as any;
        if (json?.formatted_address && json?.latitude && json?.longitude) {
          cityMap.set(fv.deal_id, {
            formatted_address: json.formatted_address,
            latitude: Number(json.latitude),
            longitude: Number(json.longitude),
          });
        }
      }

      // 4. Build deal value map
      const dealValueMap = new Map<string, number>();
      for (const deal of allDeals) {
        dealValueMap.set(deal.id, Number(deal.value) || 0);
      }

      // 5. Aggregate by city
      const cityAgg = new Map<string, { lat: number; lng: number; revenue: number; dealCount: number }>();
      for (const [dealId, cityInfo] of cityMap) {
        const value = dealValueMap.get(dealId) || 0;
        const key = cityInfo.formatted_address;
        const existing = cityAgg.get(key);
        if (existing) {
          existing.revenue += value;
          existing.dealCount += 1;
        } else {
          cityAgg.set(key, {
            lat: cityInfo.latitude,
            lng: cityInfo.longitude,
            revenue: value,
            dealCount: 1,
          });
        }
      }

      // 6. Convert to array and sort by revenue desc
      const result: MapDataPoint[] = [];
      for (const [city, data] of cityAgg) {
        result.push({ city, ...data });
      }
      result.sort((a, b) => b.revenue - a.revenue);

      return result;
    },
    enabled: enabled && !!accountId,
    staleTime: 120000,
    refetchOnWindowFocus: false,
  });
}
