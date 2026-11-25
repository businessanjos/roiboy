import type { VisualConfig } from '@/components/insights/visual-builder/types';

export interface RankingPoint {
  name: string;
  value: number;
  count?: number;
  secondaryValue?: number;
  companyId?: string | null;
  products?: { name: string; qty: number }[];
}

/** Opt-in on one seller ranking, never on calls or other visual types. */
export function rankingCompanyIds(config: VisualConfig | null | undefined, chartType?: string): string[] {
  if (chartType !== 'ranking' || !config || !['deals', 'sale_items'].includes(config.dataSource)
    || config.dimension.field !== 'responsible_name' || !['sum', 'count', 'avg'].includes(config.measure.aggregation)) return [];
  return [...new Set(config.rankingCompanyIds ?? [])].filter(Boolean);
}

/** Partition before aggregation: a shared seller never shares revenue/products. */
export function aggregateCompanyRanking<T extends { company_id?: string | null; product?: string }>(
  records: T[],
  aggregate: (rows: T[]) => RankingPoint[],
): RankingPoint[] {
  const partitions = new Map<string | null, T[]>();
  for (const record of records) {
    const id = record.company_id || null;
    const rows = partitions.get(id) ?? [];
    rows.push(record);
    partitions.set(id, rows);
  }
  return [...partitions].flatMap(([companyId, rows]) => aggregate(rows).map(point => {
    const products = new Map<string, number>();
    // Same responsible grouping as the existing visual, including joined names.
    for (const row of rows) {
      const seller = row as T & { responsible_name?: string; users?: { name?: string } | null };
      if ((seller.responsible_name || seller.users?.name || 'Sem Responsável') !== point.name) continue;
      if (row.product && row.product !== 'Não informado') products.set(row.product, (products.get(row.product) ?? 0) + 1);
    }
    return { ...point, companyId, products: [...products].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty) };
  }));
}

export function companyRankingRows<T extends RankingPoint>(data: T[], companyId: string): T[] {
  return data.filter(row => row.companyId === companyId).sort((a, b) =>
    b.value - a.value || (b.secondaryValue ?? 0) - (a.secondaryValue ?? 0));
}

/** Percentages must have the company's denominator, not the combined revenue. */
export function companyRankingShares<T extends RankingPoint>(data: T[]): T[] {
  const totals = new Map<string | null | undefined, number>();
  for (const row of data) totals.set(row.companyId, (totals.get(row.companyId) ?? 0) + row.value);
  return data.map(row => {
    const total = totals.get(row.companyId) ?? 0;
    return { ...row, value: total ? row.value / total * 100 : 0 };
  });
}