import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { aggregateLinkClickWeeks, LINK_CLICK_STORAGE, type DatedLinkClicks, type LinkClickPlacement } from '@/lib/marketing/linkClicks';

export function useRecordsLinkClicks(accountId: string | undefined, profileId: string, year: number) {
  const queries = useQueries({
    queries: (['story', 'feed'] as const).map((placement: LinkClickPlacement) => {
      const storage = LINK_CLICK_STORAGE[placement];
      return {
        queryKey: ['link-clicks', placement, accountId, profileId, String(year), 'records'],
        enabled: Boolean(accountId && profileId),
        queryFn: async (): Promise<DatedLinkClicks[]> => {
          if (!accountId || !profileId) return [];
          const { data, error } = await fetchAllRows<{ story_date?: string; post_date?: string; link_clicks: number }>(
            (from, to) => supabase.from(storage.table).select(`${storage.dateField}, link_clicks`)
              .eq('account_id', accountId).eq('profile_id', profileId)
              .gte(storage.dateField, `${year}-01-01`).lte(storage.dateField, `${year}-12-31`)
              .order(storage.dateField).order('id').range(from, to),
          );
          if (error) throw error;
          return data.map((row) => ({ date: row.story_date ?? row.post_date ?? '', link_clicks: row.link_clicks }));
        },
      };
    }),
  });
  const story = queries[0];
  const feed = queries[1];
  const weeks = useMemo(() => aggregateLinkClickWeeks(year, story?.data ?? [], feed?.data ?? []), [year, story?.data, feed?.data]);
  return {
    weeks,
    story: { loading: Boolean(story?.isPending), error: Boolean(story?.isError) },
    feed: { loading: Boolean(feed?.isPending), error: Boolean(feed?.isError) },
  };
}