/**
 * Serialização segura de valores para a gramática de filtros do PostgREST
 * (`.or()`, `.and()`). Valores com caracteres reservados (`,` `.` `:` `(` `)`
 * espaços etc.) precisam estar entre aspas duplas; dentro das aspas, `\` e `"`
 * são escapados com barra. Ver docs.postgrest.org › URL grammar › reserved chars.
 *
 * Isto é SEPARADO do escape de curingas do ILIKE (`escapeIlikeWildcards`).
 */
export function pgQuote(value: string): string {
  return `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

/** Torna `%`, `_` e `\` literais num padrão ILIKE. */
export function escapeIlikeWildcards(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** `col.ilike."%termo%"` com curingas literais e gramática segura. */
export function ilikeContains(column: string, term: string): string {
  return `${column}.ilike.${pgQuote(`%${escapeIlikeWildcards(term)}%`)}`;
}
