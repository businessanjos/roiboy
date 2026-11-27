import type { VisualConfig } from '@/components/insights/visual-builder/types';
import { resolveItemVendaToProductId } from '@/lib/sales/itemVendaResolver';

export interface RankingPoint {
  name: string;
  value: number;
  count?: number;
  secondaryValue?: number;
  companyId?: string | null;
  recurringDealIds?: string[];
  products?: { name: string; qty: number }[];
}

/** Opt-in on one seller ranking, never on calls or other visual types. */
export function rankingCompanyIds(config: VisualConfig | null | undefined, chartType?: string): string[] {
  if (chartType !== 'ranking' || !config || !['deals', 'sale_items'].includes(config.dataSource)
    || config.dimension.field !== 'responsible_name' || !['sum', 'count', 'avg'].includes(config.measure.aggregation)) return [];
  return [...new Set(config.rankingCompanyIds ?? [])].filter(Boolean);
}

interface RankingProduct {
  id: string;
  name: string;
  company_id?: string | null;
}

/** Resolve only registered product identities; never guess a company from a name fragment. */
export function rankingProductCompanyId(
  rawValue: string | null | undefined,
  products: readonly RankingProduct[],
  optionLabels: ReadonlyMap<string, string>,
): string | null {
  const raw = rawValue?.trim();
  if (!raw) return null;
  const productId = resolveItemVendaToProductId(raw).toLowerCase();
  if (productId) return products.find(product => product.id.toLowerCase() === productId)?.company_id || null;
  const label = (optionLabels.get(raw) || raw).trim().toLowerCase();
  const matches = products.filter(product => product.name.trim().toLowerCase() === label);
  return matches.length === 1 ? matches[0]?.company_id || null : null;
}

/** Presentation only: prefer the registered product's company, preserving the stored sale. */
export function aggregateCompanyRanking<T extends { id?: string; ranking_recurring?: boolean; company_id?: string | null; product_company_id?: string | null; product?: string }>(
  records: T[],
  aggregate: (rows: T[]) => RankingPoint[],
): RankingPoint[] {
  const partitions = new Map<string | null, T[]>();
  for (const record of records) {
    const id = record.product_company_id || record.company_id || null;
    const rows = partitions.get(id) ?? [];
    rows.push(record);
    partitions.set(id, rows);
  }
  return [...partitions].flatMap(([companyId, rows]) => aggregate(rows).map(point => {
    const products = new Map<string, number>();
    const recurringDealIds: string[] = [];
    // Same responsible grouping as the existing visual, including joined names.
    for (const row of rows) {
      const seller = row as T & { responsible_name?: string; users?: { name?: string } | null };
      if ((seller.responsible_name || seller.users?.name || 'Sem Responsável') !== point.name) continue;
      if (row.ranking_recurring && row.id) recurringDealIds.push(row.id);
      if (row.product && row.product !== 'Não informado') products.set(row.product, (products.get(row.product) ?? 0) + 1);
    }
    return { ...point, companyId, recurringDealIds: [...new Set(recurringDealIds)], products: [...products].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty) };
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