/**
 * Rotas filhas reservadas de /clients/ que NÃO são fichas de cliente.
 * Elas devem manter o sidebar principal de Customer Success.
 */
export const RESERVED_CLIENT_SUBROUTES = ["medicos", "checkpoints", "new"] as const;

/**
 * Retorna o id do cliente quando o path é a ficha individual (/clients/:id),
 * ou null para qualquer outra rota (inclusive as reservadas acima).
 */
export function getClientDetailId(pathname: string): string | null {
  const match = pathname.match(/^\/clients\/([^/]+)$/);
  if (!match) return null;
  const segment = match[1];
  return (RESERVED_CLIENT_SUBROUTES as readonly string[]).includes(segment) ? null : segment;
}

/** True quando a rota deve exibir o sidebar de detalhe do cliente. */
export function isClientDetailRoute(pathname: string): boolean {
  return getClientDetailId(pathname) !== null;
}
