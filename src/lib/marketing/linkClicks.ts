export type LinkClickPlacement = 'story' | 'feed';

export const LINK_CLICK_STORAGE = {
  story: { table: 'instagram_story_link_clicks', dateField: 'story_date' },
  feed: { table: 'instagram_feed_link_clicks', dateField: 'post_date' },
} as const;

export const RECORDS_LINK_METRICS = [
  { key: 'story_link_clicks', label: 'Clique no link - Story', placement: 'story' },
  { key: 'feed_link_clicks', label: 'Clique no link - Feed', placement: 'feed' },
] as const;

export type RecordsLinkMetricKey = (typeof RECORDS_LINK_METRICS)[number]['key'];
export type DatedLinkClicks = { date: string; link_clicks: number };
export type LinkClickWeek = { year: number; month: number; week: number } & Record<RecordsLinkMetricKey, number>;

/** Same five weekly buckets as RECORDES; dates are calendar dates, not UTC timestamps. */
export function aggregateLinkClickWeeks(
  year: number,
  story: readonly DatedLinkClicks[],
  feed: readonly DatedLinkClicks[],
): LinkClickWeek[] {
  const weeks: LinkClickWeek[] = Array.from({ length: 60 }, (_, index) => ({
    year, month: Math.floor(index / 5) + 1, week: index % 5 + 1,
    story_link_clicks: 0, feed_link_clicks: 0,
  }));
  const add = (rows: readonly DatedLinkClicks[], key: RecordsLinkMetricKey) => {
    rows.forEach((row) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return;
      const [rowYear, month, day] = row.date.split('-').map(Number);
      if (rowYear !== year || month < 1 || month > 12 || day < 1 || day > new Date(year, month, 0).getDate()) return;
      const bucket = weeks[(month - 1) * 5 + Math.min(4, Math.floor((day - 1) / 7))];
      if (bucket) bucket[key] += Number(row.link_clicks) || 0;
    });
  };
  add(story, 'story_link_clicks');
  add(feed, 'feed_link_clicks');
  return weeks;
}

export function sumLinkClicks(rows: readonly { views: number; link_clicks: number }[]) {
  const views = rows.reduce((sum, row) => sum + row.views, 0);
  const clicks = rows.reduce((sum, row) => sum + row.link_clicks, 0);
  return { count: rows.length, views, clicks, rate: views ? clicks / views * 100 : 0 };
}