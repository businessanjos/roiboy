// Resolve o "produto atual" de um cliente para exibição (área de Customer Success).
// O histórico completo continua disponível (client_products), mas na listagem
// mostramos apenas o produto vigente — o do contrato ativo/mais recente.

export interface ClientProductEntry {
  product_id: string;
  is_active?: boolean | null;
  products?: { id?: string; name?: string; color?: string | null } | null;
}

interface ClientLike {
  client_products?: ClientProductEntry[] | null;
  contract?: { product_id?: string | null; status?: string | null } | null;
}

/**
 * Retorna o produto atual do cliente:
 * 0) considera apenas produtos ativos (quando houver algum);
 * 1) produto do contrato vigente (quando existe e está entre os produtos do cliente);
 * 2) caso contrário, o último produto vinculado.
 */
export function getCurrentClientProduct(client: ClientLike): ClientProductEntry | null {
  const all = client?.client_products || [];
  if (all.length === 0) return null;

  const actives = all.filter((cp) => cp.is_active !== false);
  const list = actives.length > 0 ? actives : all;

  const contractProductId = client?.contract?.product_id || null;
  if (contractProductId) {
    const match = list.find((cp) => cp.product_id === contractProductId);
    if (match) return match;
  }

  return list[list.length - 1];
}
