import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useRecordsLinkClicks } from '../useRecordsLinkClicks';

const { from, store, requests } = vi.hoisted(() => ({
  from: vi.fn(),
  store: { rows: [] as Record<string, unknown>[], failAfterPage: false },
  requests: [] as { table: string; filters: Record<string, unknown>; start: number }[],
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));

const wrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

beforeEach(() => {
  store.rows = [];
  store.failAfterPage = false;
  requests.length = 0;
  from.mockReset().mockImplementation((table: string) => {
    const filters: Record<string, unknown> = {};
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((key: string, value: unknown) => { filters[key] = value; return builder; }),
      gte: vi.fn((key: string, value: string) => { filters[`gte:${key}`] = value; return builder; }),
      lte: vi.fn((key: string, value: string) => { filters[`lte:${key}`] = value; return builder; }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn(async (start: number, end: number) => {
        requests.push({ table, filters: { ...filters }, start });
        const dateKey = table.includes('story') ? 'story_date' : 'post_date';
        const rows = store.rows.filter((row) => row.table === table && row.account_id === filters.account_id && row.profile_id === filters.profile_id && String(row[dateKey]) >= String(filters[`gte:${dateKey}`]) && String(row[dateKey]) <= String(filters[`lte:${dateKey}`]));
        return { data: rows.slice(start, end + 1), error: store.failAfterPage && start > 0 && table.includes('story') ? new Error('Página indisponível') : null };
      }),
    };
    return builder;
  });
});

describe('cliques no comparativo de RECORDES', () => {
  it('lê somente o perfil, conta e ano selecionados, mantendo Story e Feed separados', async () => {
    store.rows = [
      { table: 'instagram_story_link_clicks', account_id: 'a', profile_id: 'p', story_date: '2026-11-01', link_clicks: 34 },
      { table: 'instagram_feed_link_clicks', account_id: 'a', profile_id: 'p', post_date: '2026-11-01', link_clicks: 70 },
      { table: 'instagram_story_link_clicks', account_id: 'a', profile_id: 'other', story_date: '2026-11-01', link_clicks: 100 },
      { table: 'instagram_story_link_clicks', account_id: 'other', profile_id: 'p', story_date: '2026-11-01', link_clicks: 200 },
      { table: 'instagram_story_link_clicks', account_id: 'a', profile_id: 'p', story_date: '2025-11-01', link_clicks: 300 },
    ];
    const { result } = renderHook(() => useRecordsLinkClicks('a', 'p', 2026), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.story.loading || result.current.feed.loading).toBe(false));
    expect(result.current.weeks.find((week) => week.month === 11 && week.week === 1)).toEqual({ year: 2026, month: 11, week: 1, story_link_clicks: 34, feed_link_clicks: 70 });
    expect(requests[0].filters).toMatchObject({ account_id: 'a', profile_id: 'p', 'gte:story_date': '2026-01-01', 'lte:story_date': '2026-12-31' });
  });

  it('carrega além da primeira página para não perder cliques', async () => {
    store.rows = Array.from({ length: 1050 }, () => ({ table: 'instagram_story_link_clicks', account_id: 'a', profile_id: 'p', story_date: '2026-11-01', link_clicks: 1 }));
    const { result } = renderHook(() => useRecordsLinkClicks('a', 'p', 2026), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.story.loading).toBe(false));
    expect(result.current.weeks.reduce((sum, week) => sum + week.story_link_clicks, 0)).toBe(1050);
    expect(requests.filter((request) => request.table.includes('story')).map((request) => request.start)).toEqual([0, 1000, 1050]);
  });

  it('sinaliza uma falha sem exibir soma parcial como sucesso', async () => {
    store.rows = [{ table: 'instagram_story_link_clicks', account_id: 'a', profile_id: 'p', story_date: '2026-11-01', link_clicks: 34 }];
    store.failAfterPage = true;
    const { result } = renderHook(() => useRecordsLinkClicks('a', 'p', 2026), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.story.error).toBe(true));
    expect(result.current.weeks.reduce((sum, week) => sum + week.story_link_clicks, 0)).toBe(0);
    expect(result.current.feed.error).toBe(false);
  });
});