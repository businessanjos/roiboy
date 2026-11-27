import { contractMrr, isLiveOn, payDay, type PayPortfolio } from '@/lib/sales/payPortfolio';
import type { RankingPoint } from './companyRanking';

/** Whole seller portfolio, regardless of win date; historical months use their closing day. */
export function rankingRecurringValue(row: Pick<RankingPoint, 'sellerIds'>, snapshot: PayPortfolio | null | undefined, endDate?: string): number | null {
  const readDay = payDay(snapshot?.generatedAt);
  const selectedDay = payDay(endDate);
  const day = readDay && selectedDay ? (selectedDay < readDay ? selectedDay : readDay) : readDay;
  if (!snapshot || !day || snapshot.partial || !row.sellerIds?.length) return null;
  const sellers = new Set(row.sellerIds);
  const clinics = snapshot.clinics.filter(c => c.sellerId && sellers.has(c.sellerId));
  const contracts = new Map(clinics.flatMap(c => c.contracts.filter(contract => isLiveOn(contract, day)).map(contract => [contract.id, contract] as const)));
  return [...contracts.values()].reduce((sum, contract) => sum + contractMrr(contract), 0) / 100;
}