import { describe, expect, it } from 'vitest';
import { aggregateLinkClickWeeks, LINK_CLICK_STORAGE, sumLinkClicks } from './linkClicks';

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

  it('agrega Story e Feed separadamente nas mesmas semanas de RECORDES', () => {
    const weeks = aggregateLinkClickWeeks(2026,
      [{ date: '2026-11-01', link_clicks: 30 }, { date: '2026-11-07', link_clicks: 4 }, { date: '2026-11-08', link_clicks: 12 }, { date: '2026-11-30', link_clicks: 7 }],
      [{ date: '2026-11-07', link_clicks: 70 }, { date: '2026-12-01', link_clicks: 90 }],
    );
    const november = weeks.filter((week) => week.month === 11);
    expect(november.map((week) => week.story_link_clicks)).toEqual([34, 12, 0, 0, 7]);
    expect(november.map((week) => week.feed_link_clicks)).toEqual([70, 0, 0, 0, 0]);
    expect(weeks.filter((week) => week.month === 12).reduce((sum, week) => sum + week.feed_link_clicks, 0)).toBe(90);
  });

  it('respeita o ano escolhido e descarta datas inválidas, sem alterar lançamentos', () => {
    const rows = [{ date: '2025-11-01', link_clicks: 100 }, { date: '2026-02-30', link_clicks: 200 }, { date: '2026-11-01', link_clicks: 30 }];
    const before = structuredClone(rows);
    expect(aggregateLinkClickWeeks(2026, rows, []).reduce((sum, week) => sum + week.story_link_clicks, 0)).toBe(30);
    expect(rows).toEqual(before);
  });
});