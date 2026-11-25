import { describe, expect, it } from 'vitest';
import { aggregateCompanyRanking, companyRankingRows, companyRankingShares, rankingCompanyIds } from './companyRanking';
import type { VisualConfig } from '@/components/insights/visual-builder/types';

const config: VisualConfig = {
  dataSource: 'deals', dimension: { field: 'responsible_name', type: 'text' },
  measure: { field: 'value', aggregation: 'sum' }, formatting: { type: 'currency', decimals: 2 },
  rankingCompanyIds: ['eternum', 'anjos'],
};
const records = [
  { users: { name: 'Darlan' }, company_id: 'anjos', product: 'CR l Programa de Aceleração', value: 35000 },
  { users: { name: 'Darlan' }, company_id: 'eternum', product: 'EM l Eternum Mentoring', value: 75400 },
  { users: { name: 'Jonathan' }, company_id: 'eternum', product: 'EM l Eternum Mentoring', value: 160800 },
];
const aggregate = (rows: typeof records) => {
  const sellers = new Map<string, { name: string; value: number; count: number }>();
  for (const row of rows) {
    const seller = sellers.get(row.users.name) ?? { name: row.users.name, value: 0, count: 0 };
    seller.value += row.value; seller.count += 1; sellers.set(seller.name, seller);
  }
  return [...sellers.values()];
};
describe('ranking exclusivo por empresa', () => {
  it('opção só habilita o ranking de vendedores configurado', () => {
    expect(rankingCompanyIds(config, 'ranking')).toEqual(['eternum', 'anjos']);
    expect(rankingCompanyIds({ ...config, rankingCompanyIds: undefined }, 'ranking')).toEqual([]);
  });
  it('Calls Comerciais não muda mesmo recebendo essa configuração', () => {
    expect(rankingCompanyIds(config, 'call_commercial')).toEqual([]);
    expect(rankingCompanyIds({ ...config, dataSource: 'tasks' }, 'ranking')).toEqual([]);
  });
  it('não altera rankings por canal, MQL ou outras medidas', () => {
    expect(rankingCompanyIds({ ...config, dimension: { field: 'canal', type: 'text' } }, 'ranking')).toEqual([]);
    expect(rankingCompanyIds({ ...config, measure: { field: 'value', aggregation: 'conversion_rate' } }, 'ranking')).toEqual([]);
  });
  it('cada empresa tem classificação e valor próprios para o mesmo vendedor', () => {
    const result = aggregateCompanyRanking(records, aggregate);
    expect(companyRankingRows(result, 'eternum').map(r => [r.name, r.value])).toEqual([['Jonathan', 160800], ['Darlan', 75400]]);
    expect(companyRankingRows(result, 'anjos').map(r => [r.name, r.value])).toEqual([['Darlan', 35000]]);
  });
  it('as pílulas incluem apenas os produtos das vendas da empresa', () => {
    const result = aggregateCompanyRanking(records, aggregate);
    expect(companyRankingRows(result, 'anjos')[0]?.products).toEqual([{ name: 'CR l Programa de Aceleração', qty: 1 }]);
    expect(companyRankingRows(result, 'eternum').find(r => r.name === 'Darlan')?.products).toEqual([{ name: 'EM l Eternum Mentoring', qty: 1 }]);
  });
  it('usa empresa salva na venda, sem reclassificar por catálogo ou nome do produto', () => {
    const original = [{ ...records[0], company_id: 'eternum' }];
    const result = aggregateCompanyRanking(original, aggregate);
    expect(companyRankingRows(result, 'anjos')).toEqual([]);
    expect(companyRankingRows(result, 'eternum')[0]?.value).toBe(35000);
    expect(original[0]?.company_id).toBe('eternum');
  });
  it('não atribui vendas sem empresa à Eternum ou Anjos', () => {
    const result = aggregateCompanyRanking([{ ...records[0], company_id: null }] as unknown as typeof records, aggregate);
    expect(result[0]?.companyId).toBeNull();
    expect(result[0]?.value).toBe(35000);
    expect(companyRankingRows(result, 'eternum')).toEqual([]);
    expect(companyRankingRows(result, 'anjos')).toEqual([]);
  });
  it('empresa sem vendas fica vazia sem repetir vendedores da outra', () => {
    expect(companyRankingRows(aggregateCompanyRanking(records.slice(1), aggregate), 'anjos')).toEqual([]);
  });
  it('percentual usa total independente em cada empresa', () => {
    const result = companyRankingShares(aggregateCompanyRanking(records, aggregate));
    expect(companyRankingRows(result, 'anjos')[0]?.value).toBe(100);
    expect(companyRankingRows(result, 'eternum').reduce((sum, row) => sum + row.value, 0)).toBeCloseTo(100);
  });
  it('desempate continua usando valor recebido dentro da empresa', () => {
    expect(companyRankingRows([{ name: 'A', companyId: 'anjos', value: 10, secondaryValue: 1 },
      { name: 'B', companyId: 'anjos', value: 10, secondaryValue: 3 }], 'anjos').map(r => r.name)).toEqual(['B', 'A']);
  });
});