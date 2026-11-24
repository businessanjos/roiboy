import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ManualMetricsTab } from '../ManualMetricsTab';
import { aggregateLinkClickWeeks } from '@/lib/marketing/linkClicks';

if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

const { from, upsert } = vi.hoisted(() => ({ from: vi.fn(), upsert: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ currentUser: { account_id: 'qa' } }) }));
vi.mock('@/hooks/useRecordsLinkClicks', () => ({ useRecordsLinkClicks: () => ({
  weeks: aggregateLinkClickWeeks(2026, [{ date: '2026-11-01', link_clicks: 34 }], [{ date: '2026-11-07', link_clicks: 70 }]),
  story: { loading: false, error: false }, feed: { loading: false, error: false },
}) }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-24T16:40:00Z'));
  upsert.mockReset().mockResolvedValue({ error: null });
  from.mockReset().mockImplementation((table: string) => {
    const data = table === 'instagram_profiles' ? [{ id: 'p', username: 'testeqa' }] : [];
    const builder = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), upsert,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
    };
    return builder;
  });
});

afterEach(() => vi.useRealTimers());

describe('Story e Feed junto das métricas semanais', () => {
  it('mostra os totais existentes no gráfico e mantém Salvar restrito aos campos manuais', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><ManualMetricsTab /></QueryClientProvider>);
    const story = await screen.findByRole('button', { name: 'Clique no link - Story' });
    fireEvent.click(story);
    expect(screen.getByRole('img', { name: /Story por semana/ }).getAttribute('aria-label')).toContain('Sem 1: 34');
    fireEvent.click(screen.getByRole('button', { name: 'Clique no link - Feed' }));
    expect(screen.getByRole('img', { name: /Feed por semana/ }).getAttribute('aria-label')).toContain('Sem 1: 70');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(2));
    const weekly = upsert.mock.calls[0][0];
    const goals = upsert.mock.calls[1][0];
    expect(weekly).toHaveLength(5);
    expect(weekly[0]).toMatchObject({ account_id: 'qa', profile_id: 'p', year: 2026, month: 11, week: 1, views: 0, link_clicks: 0 });
    weekly.forEach((row: Record<string, unknown>) => {
      expect(row).not.toHaveProperty('story_link_clicks');
      expect(row).not.toHaveProperty('feed_link_clicks');
    });
    expect(goals).not.toHaveProperty('story_link_clicks');
    expect(goals).not.toHaveProperty('feed_link_clicks');
  });
});