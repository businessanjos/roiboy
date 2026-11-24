export type LinkClickPlacement = 'story' | 'feed';

export const LINK_CLICK_STORAGE = {
  story: { table: 'instagram_story_link_clicks', dateField: 'story_date' },
  feed: { table: 'instagram_feed_link_clicks', dateField: 'post_date' },
} as const;

export function sumLinkClicks(rows: readonly { views: number; link_clicks: number }[]) {
  const views = rows.reduce((sum, row) => sum + row.views, 0);
  const clicks = rows.reduce((sum, row) => sum + row.link_clicks, 0);
  return { count: rows.length, views, clicks, rate: views ? clicks / views * 100 : 0 };
}