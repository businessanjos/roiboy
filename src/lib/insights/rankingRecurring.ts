import { payDay, type PayPortfolio } from '@/lib/sales/payPortfolio';
import { isHiddenTechnicalPerson } from '@/lib/peopleVisibility';
import type { RankingPoint } from './companyRanking';

/** Cash received in the selected month from recurring sales won before that month. */
export function rankingRecurringValue(row: Pick<RankingPoint, 'sellerIds'>, snapshot: PayPortfolio | null | undefined, endDate?: string): number | null {
  const day = payDay(endDate) ?? payDay(snapshot?.generatedAt);
  if (!snapshot || !day || snapshot.partial || !row.sellerIds?.length) return null;
  const month = day.slice(0, 7);
  const sellers = new Set(row.sellerIds);
  const payments = new Map<string, number>();
  for (const clinic of snapshot.clinics) {
    const wonDay = payDay(clinic.wonAt);
    if (!clinic.sellerId || !sellers.has(clinic.sellerId) || !wonDay || wonDay >= `${month}-01`) continue;
    for (const contract of clinic.contracts) {
      if (contract.kind !== 'mensal' && contract.kind !== 'anual') continue;
      for (const invoice of contract.invoices) {
        const paidDay = invoice.situation === 'pago' ? payDay(invoice.paidAt) : null;
        if (!paidDay || paidDay.slice(0, 7) !== month || invoice.amountCents == null) continue;
        payments.set(`${contract.source}:${invoice.id}`, invoice.amountCents);
      }
    }
  }
  return [...payments.values()].reduce((sum, cents) => sum + cents, 0) / 100;
}

/** Keep cash from previous sales visible even when the seller has no new sales this month. */
export function rankingRecurringRows(rows: RankingPoint[], snapshot: PayPortfolio | null | undefined, endDate?: string, userId = 'all'): (RankingPoint & { recurringValue: number | null })[] {
  const result = rows.map(row => ({ ...row, recurringValue: rankingRecurringValue(row, snapshot, endDate) }));
  const existing = new Set(rows.flatMap(row => row.sellerIds ?? []));
  for (const clinic of snapshot?.clinics ?? []) {
    const id = clinic.sellerId;
    if (!id || existing.has(id) || (userId !== 'all' && id !== userId) || isHiddenTechnicalPerson({ id, name: clinic.sellerName })) continue;
    existing.add(id);
    const recurringValue = rankingRecurringValue({ sellerIds: [id] }, snapshot, endDate);
    if (!recurringValue) continue;
    result.push({ name: clinic.sellerName || 'Sem nome', value: 0, count: 0, companyId: rows[0]?.companyId, sellerIds: [id], products: [], recurringValue });
  }
  return result;
}