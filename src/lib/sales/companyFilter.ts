/** Display-only filtering: use the sale's stored company, never the client's or the current catalog. */
export function filterDealsByCompany<T extends { company_id?: string | null }>(
  deals: T[],
  companyId: string,
): T[] {
  if (companyId === "all") return deals;
  return deals.filter((deal) => deal.company_id === companyId);
}