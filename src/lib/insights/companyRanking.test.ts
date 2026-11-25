import { describe, expect, it } from 'vitest';
import { aggregateCompanyRanking, companyRankingRows, companyRankingShares, rankingCompanyIds, rankingProductCompanyId } from './companyRanking';
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
  it('CR conta na Anjos mesmo com a venda histórica na Eternum, sem alterar o registro', () => {
    const original = [{ ...records[0], company_id: 'eternum', product_company_id: 'anjos' }];
    const result = aggregateCompanyRanking(original, aggregate);
    expect(companyRankingRows(result, 'eternum')).toEqual([]);
    expect(companyRankingRows(result, 'anjos')[0]?.value).toBe(35000);
    expect(original[0]?.company_id).toBe('eternum');
  });
  it('os quatro CR de R$ 125 mil saem da Eternum e entram na Anjos sem duplicar o total', () => {
    const current = [
      { ...records[0], company_id: 'anjos', product_company_id: 'anjos', value: 35000 },
      ...[30000, 30000, 30000, 35000].map(value => ({ ...records[0], company_id: 'eternum', product_company_id: 'anjos', value })),
      { ...records[1], product_company_id: 'eternum', value: 80400 },
      { ...records[2], product_company_id: 'eternum', value: 241200 },
    ];
    const result = aggregateCompanyRanking(current, aggregate);
    expect(companyRankingRows(result, 'eternum').reduce((sum, row) => sum + row.value, 0)).toBe(321600);
    expect(companyRankingRows(result, 'anjos')).toMatchObject([{ name: 'Darlan', value: 160000, count: 5, products: [{ name: 'CR l Programa de Aceleração', qty: 5 }] }]);
    expect(result.reduce((sum, row) => sum + row.value, 0)).toBe(481600);
    expect(current.filter(row => row.company_id === 'eternum')).toHaveLength(6);
  });
  it('produto não resolvido conserva a empresa histórica, sem inferência pelo nome', () => {
    const original = [{ ...records[0], company_id: 'eternum', product_company_id: null }];
    const result = aggregateCompanyRanking(original, aggregate);
    expect(companyRankingRows(result, 'eternum')[0]?.value).toBe(35000);
    expect(companyRankingRows(result, 'anjos')).toEqual([]);
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

describe('identidade de produto para a empresa do ranking', () => {
  const products = [
    { id: 'feb34040-ba60-417a-a5d3-66dbdf1cfc02', name: 'CR l Programa de Aceleração', company_id: 'anjos' },
    { id: 'f48e141b-e3da-4547-9b4a-70548fcdfe2c', name: 'EM l Eternum Mentoring', company_id: 'eternum' },
    { id: '27d83762-7ce0-49d5-a12b-b51571303096', name: 'REN. EM l Eternum Mentoring', company_id: 'eternum' },
  ];
  const labels = new Map([['opt_custom_cr', 'CR l Programa de Aceleração']]);
  it('UUID e opção antiga do CR apontam para Anjos', () => {
    expect(rankingProductCompanyId('feb34040-ba60-417a-a5d3-66dbdf1cfc02', products, labels)).toBe('anjos');
    expect(rankingProductCompanyId('opt_1787176918301', products, labels)).toBe('anjos');
  });
  it('opções novas e nome exato também usam a empresa cadastrada', () => {
    expect(rankingProductCompanyId('opt_custom_cr', products, labels)).toBe('anjos');
    expect(rankingProductCompanyId(' CR l Programa de Aceleração ', products, labels)).toBe('anjos');
  });
  it('EM e renovação mantêm a empresa dos respectivos produtos', () => {
    expect(rankingProductCompanyId('rykas_mentoring', products, labels)).toBe('eternum');
    expect(rankingProductCompanyId('ren_rykas_mentoring', products, labels)).toBe('eternum');
  });
  it('não inventa vínculo para nome parcial, duplicado, desconhecido ou sem empresa', () => {
    expect(rankingProductCompanyId('CR', products, labels)).toBeNull();
    expect(rankingProductCompanyId('opt_desconhecido', products, labels)).toBeNull();
    expect(rankingProductCompanyId(null, products, labels)).toBeNull();
    expect(rankingProductCompanyId('opt_custom_cr', [...products, { ...products[0], id: 'duplicate', name: 'CR l Programa de Aceleração', company_id: 'eternum' }], labels)).toBeNull();
    expect(rankingProductCompanyId('opt_1787176918301', [{ ...products[0], id: products[0]?.id ?? '', name: 'CR l Programa de Aceleração', company_id: null }], labels)).toBeNull();
  });
});