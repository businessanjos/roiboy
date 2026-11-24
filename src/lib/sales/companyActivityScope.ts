export interface CompanyScopeDeal {
  id: string;
  company_id: string | null;
  client_id?: string | null;
  lead_id?: string | null;
}
export interface CompanyActivity { deal_id?: string | null; client_id?: string | null; lead_id?: string | null }

export function buildCompanyActivityScope(deals: CompanyScopeDeal[]) {
  const byDeal = new Map(deals.map((deal) => [deal.id, deal.company_id]));
  const byClient = new Map<string, Set<string | null>>();
  const byLead = new Map<string, Set<string | null>>();
  for (const deal of deals) {
    for (const [id, map] of [[deal.client_id, byClient], [deal.lead_id, byLead]] as const) {
      if (!id) continue;
      const companies = map.get(id) || new Set<string | null>();
      companies.add(deal.company_id);
      map.set(id, companies);
    }
  }
  return { byDeal, byClient, byLead };
}
export type CompanyActivityScope = ReturnType<typeof buildCompanyActivityScope>;

/** Explicit deal wins. Unlinked activity needs an unambiguous entity; shared clients are never assigned to one company. */
export function activityMatchesCompany(activity: CompanyActivity, companyId: string, scope: CompanyActivityScope): boolean {
  if (companyId === "all") return true;
  if (activity.deal_id) return scope.byDeal.get(activity.deal_id) === companyId;
  const companies = activity.lead_id ? scope.byLead.get(activity.lead_id) : activity.client_id ? scope.byClient.get(activity.client_id) : undefined;
  return companies?.size === 1 && companies.has(companyId);
}

/** Linked sales keep their historical company; unlinked contracts use only the product. */
export function contractMatchesCompany(contract: { deal_id?: string | null; products?: { company_id?: string | null } | null }, companyId: string, scope: CompanyActivityScope): boolean {
  if (companyId === "all") return true;
  if (contract.deal_id) return scope.byDeal.get(contract.deal_id) === companyId;
  return contract.products?.company_id === companyId;
}