/**
 * Aplica o filtro de "Excluído" (soft-delete) nas queries da tabela `deals`.
 *
 * Regra:
 * - Se `dealStatusFilter` incluir 'deleted' sozinho: mostra apenas deals excluídos.
 * - Se incluir 'deleted' junto com outros status: mostra excluídos OU os status escolhidos.
 * - Caso contrário: esconde excluídos (deleted_at IS NULL).
 */
export const DELETED_STATUS_VALUE = 'deleted';

export function applyDeletedFilter<Q extends { in: any; eq: any; is: any; not: any; or: any }>(
  query: Q,
  dealStatusFilter?: string[] | null,
  fallbackStatus?: 'won' | 'lost' | 'open' | null
): Q {
  const includesDeleted = !!dealStatusFilter?.includes(DELETED_STATUS_VALUE);
  const realStatuses = (dealStatusFilter || []).filter((s) => s !== DELETED_STATUS_VALUE);

  if (includesDeleted && realStatuses.length === 0) {
    return query.not('deleted_at', 'is', null);
  }

  if (includesDeleted && realStatuses.length > 0) {
    const statusList = realStatuses.map((s) => `"${s}"`).join(',');
    return query.or(`deleted_at.not.is.null,status.in.(${statusList})`);
  }

  let q = query.is('deleted_at', null);
  if (realStatuses.length > 0) {
    q = q.in('status', realStatuses);
  } else if (fallbackStatus) {
    q = q.eq('status', fallbackStatus);
  }
  return q;
}
