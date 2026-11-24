import { describe, expect, it } from 'vitest';
import { LINK_CLICK_STORAGE, sumLinkClicks } from './linkClicks';

describe('cliques separados por publicação', () => {
  it('Story e Feed consultam destinos diferentes sem reclassificar stories existentes', () => {
    expect(LINK_CLICK_STORAGE.story).toEqual({ table: 'instagram_story_link_clicks', dateField: 'story_date' });
    expect(LINK_CLICK_STORAGE.feed).toEqual({ table: 'instagram_feed_link_clicks', dateField: 'post_date' });
    expect(LINK_CLICK_STORAGE.feed.table).not.toBe(LINK_CLICK_STORAGE.story.table);
  });

  it('soma somente os números do conjunto recebido', () => {
    const story = sumLinkClicks([{ views: 1000, link_clicks: 30 }]);
    const feed = sumLinkClicks([{ views: 500, link_clicks: 10 }, { views: 1500, link_clicks: 40 }]);
    expect(story).toEqual({ count: 1, views: 1000, clicks: 30, rate: 3 });
    expect(feed).toEqual({ count: 2, views: 2000, clicks: 50, rate: 2.5 });
  });
});