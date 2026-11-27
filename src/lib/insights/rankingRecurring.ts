import { contractMrr, isLiveOn, payDay, type PayPortfolio } from '@/lib/sales/payPortfolio';
import type { RankingPoint } from './companyRanking';

/** Same filtered deal IDs as the ranking; provider amounts only, from the stored read. */
export function rankingRecurringValue(row: Pick<RankingPoint, 'recurringDealIds'>, snapshot: PayPortfolio | null | undefined): number | null {
  const day = payDay(snapshot?.generatedAt);
  if (!snapshot || !day || snapshot.partial) return null;
  const ids = new Set(row.recurringDealIds ?? []);
  const clinics = snapshot.clinics.filter(c => ids.has(c.dealId));
  if (clinics.length !== ids.size || clinics.some(c => c.state !== 'found')) return null;
  const contracts = new Map(clinics.flatMap(c => c.contracts.filter(contract => isLiveOn(contract, day)).map(contract => [contract.id, contract] as const)));
  return [...contracts.values()].reduce((sum, contract) => sum + contractMrr(contract), 0) / 100;
}