import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { VisualConfig } from '@/components/insights/visual-builder/types';

const state = vi.hoisted(() => ({
  filters: { startDate: '2026-11-01', endDate: '2026-11-30', userId: 'all', pipelineId: 'all', stageId: 'all' },
  scopes: [] as [string, unknown][],
  rows: [
    { id: 'cr', users: { name: 'Darlan' }, company_id: 'anjos', value: 35000 },
    { id: 'em1', users: { name: 'Darlan' }, company_id: 'eternum', value: 75400 },
    { id: 'em2', users: { name: 'Jonathan' }, company_id: 'eternum', value: 80400 },
    { id: 'em3', users: { name: 'Jonathan' }, company_id: 'eternum', value: 80400 },
  ],
}));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ currentUser: { account_id: 'account' } }) }));
vi.mock('@/hooks/useInsightsFilters', () => ({
  useInsightsFilters: () => ({ filters: state.filters }),
  mergeGlobalLeadFilter: (filters: unknown) => filters,
  mergeGlobalDealFilter: (filters: unknown) => filters,
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => {
  let field = '';
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { state.scopes.push([key, value]); if (key === 'field_id') field = String(value); return query; },
    in: () => query, is: () => query, not: () => query,
    gte: (key: string, value: unknown) => { state.scopes.push([key, value]); return query; },
    lte: (key: string, value: unknown) => { state.scopes.push([key, value]); return query; },
    range: (from: number, to: number) => Promise.resolve({ data: state.rows.slice(from, to + 1), error: null }),
    single: () => Promise.resolve({ data: { options: [{ value: 'cr', label: 'CR l Programa de Aceleração' }, { value: 'em', label: 'EM l Eternum Mentoring' }] }, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === 'deal_field_values' && field === '033b91fb-3add-4c96-aec9-567fefbd0fb2'
      ? state.rows.map(row => ({ deal_id: row.id, value_text: row.id === 'cr' ? 'cr' : 'em' })) : [], error: null }).then(resolve),
  };
  return query;
} } }));

import { useVisualData } from './useVisualData';
const config: VisualConfig = {
  dataSource: 'deals', dimension: { field: 'responsible_name', type: 'text' },
  measure: { field: 'value', aggregation: 'sum' }, statusFilter: 'won',
  formatting: { type: 'currency', decimals: 2 }, rankingCompanyIds: ['eternum', 'anjos'],
};
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}
describe('leitura do ranking por empresa', () => {
  beforeEach(() => { state.scopes = []; });
  it('o motor real agrega cada empresa com seus valores e produtos', async () => {
    const { result } = renderHook(() => useVisualData({ config, chartType: 'ranking' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.find(row => row.companyId === 'anjos')).toMatchObject({ name: 'Darlan', value: 35000, count: 1, products: [{ name: 'CR l Programa de Aceleração', qty: 1 }] });
    expect(result.current.data?.find(row => row.companyId === 'eternum' && row.name === 'Jonathan')).toMatchObject({ value: 160800, count: 2 });
    expect(state.scopes).toContainEqual(['account_id', 'account']);
    expect(state.scopes).toContainEqual(['status', 'won']);
    expect(state.scopes).toContainEqual(['won_at', '2026-11-01T00:00:00.000']);
    expect(state.scopes).toContainEqual(['won_at', '2026-11-30T23:59:59.999']);
  });
  it('outro ranking sem opção continua consolidado', async () => {
    const { result } = renderHook(() => useVisualData({ config: { ...config, rankingCompanyIds: undefined }, chartType: 'ranking' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.find(row => row.name === 'Darlan')).toMatchObject({ value: 110400, count: 2 });
    expect(result.current.data?.every(row => row.companyId === undefined)).toBe(true);
  });
  it('contagem continua contando vendas, não valores nem empresas', async () => {
    const { result } = renderHook(() => useVisualData({ config: { ...config, measure: { field: 'value', aggregation: 'count' } }, chartType: 'ranking' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.find(row => row.companyId === 'eternum' && row.name === 'Jonathan')?.value).toBe(2);
    expect(result.current.data?.find(row => row.companyId === 'anjos')?.value).toBe(1);
  });
  it('média é calculada somente com as vendas da empresa', async () => {
    const { result } = renderHook(() => useVisualData({ config: { ...config, measure: { field: 'value', aggregation: 'avg' } }, chartType: 'ranking' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.find(row => row.companyId === 'eternum' && row.name === 'Jonathan')?.value).toBe(80400);
    expect(result.current.data?.find(row => row.companyId === 'anjos')?.value).toBe(35000);
  });
});