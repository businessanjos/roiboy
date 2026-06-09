import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export interface EventHealth {
  done: number;
  total: number;
}

/**
 * Aggregates content deliverables per event for the given event ids.
 * Returns a record keyed by event_id with done/total counts.
 */
export function useEventContentHealth(eventIds: string[]) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const idsKey = [...eventIds].sort().join(',');

  return useQuery({
    queryKey: ['event-content-health', accountId, idsKey],
    queryFn: async (): Promise<Record<string, EventHealth>> => {
      if (!accountId || eventIds.length === 0) return {};
      const { data, error } = await (supabase as any)
        .from('event_content_deliverables')
        .select('event_id,status')
        .eq('account_id', accountId)
        .in('event_id', eventIds);
      if (error) throw error;
      const map: Record<string, EventHealth> = {};
      for (const row of data || []) {
        const entry = map[row.event_id] ?? { done: 0, total: 0 };
        entry.total += 1;
        if (row.status === 'done') entry.done += 1;
        map[row.event_id] = entry;
      }
      return map;
    },
    enabled: !!accountId && eventIds.length > 0,
  });
}
