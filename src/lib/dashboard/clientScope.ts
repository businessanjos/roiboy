/**
 * Escopo de clientes usado pelos filtros do dashboard (ex.: filtro de formação).
 * `clientIds` vazio/null significa "sem restrição" — todas as contas entram.
 */

export function clientScopeIds(clientIds?: string[] | null): Set<string> | null {
  if (!clientIds || clientIds.length === 0) return null;
  return new Set(clientIds);
}

/** Chave curta e estável para compor queryKeys do React Query. */
export function clientScopeKey(clientIds?: string[] | null): string {
  if (!clientIds || clientIds.length === 0) return "all";
  let hash = 7;
  for (const id of clientIds) {
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return `${clientIds.length}-${hash}`;
}

/** Mantém apenas as linhas cujo cliente está dentro do escopo. */
export function filterByClientScope<T>(
  rows: T[],
  getClientId: (row: T) => string | null | undefined,
  clientIds?: string[] | null,
): T[] {
  const scope = clientScopeIds(clientIds);
  if (!scope) return rows;
  return rows.filter((row) => {
    const id = getClientId(row);
    return !!id && scope.has(id);
  });
}
