export interface CompanyProduct { id: string; company_id?: string | null }

export function filterProductsByCompany<T extends CompanyProduct>(products: T[], companyId: string): T[] {
  return companyId === "all" ? products : products.filter((product) => product.company_id === companyId);
}

export interface CompanyClient {
  id: string;
  products?: { id: string }[];
  products_history?: { product_id: string }[];
  client_products?: { product_id: string }[];
  contract?: { product_id?: string | null } | null;
}

/** Membership is through products, never a client's own company/name. Includes history. */
export function filterClientsByCompany<T extends CompanyClient>(clients: T[], products: CompanyProduct[], companyId: string): T[] {
  if (companyId === "all") return clients;
  const ids = new Set(filterProductsByCompany(products, companyId).map((p) => p.id));
  return clients.filter((client) => [
    ...(client.products || []).map((p) => p.id),
    ...(client.products_history || []).map((p) => p.product_id),
    ...(client.client_products || []).map((p) => p.product_id),
    client.contract?.product_id,
  ].some((id) => id != null && ids.has(id)));
}

export interface ClientListResult<T extends CompanyClient = CompanyClient> {
  clients: T[];
  total: number;
  internal_ids?: string[];
  team_users?: { id: string; name: string; email: string }[];
}

/** Complete the existing read-only sorted result before filtering/counting/paging. */
export async function loadCompanyClients<T extends CompanyClient>(
  fetchPage: (offset: number, limit: number) => Promise<ClientListResult<T>>,
  products: CompanyProduct[],
  companyId: string,
): Promise<ClientListResult<T>> {
  const rows = new Map<string, T>();
  const internalIds = new Set<string>();
  let teamUsers: ClientListResult<T>["team_users"] = [];
  let offset = 0;
  while (true) {
    const page = await fetchPage(offset, 200);
    page.clients.forEach((client) => rows.set(client.id, client));
    page.internal_ids?.forEach((id) => internalIds.add(id));
    if (page.team_users?.length) teamUsers = page.team_users;
    if (page.clients.length === 0) break;
    offset += page.clients.length;
    if (offset > 50000) throw new Error("Muitos clientes para carregar. Refine os filtros.");
  }
  const clients = filterClientsByCompany(Array.from(rows.values()), products, companyId);
  return { clients, total: clients.filter((client) => !internalIds.has(client.id)).length, internal_ids: [...internalIds], team_users: teamUsers };
}