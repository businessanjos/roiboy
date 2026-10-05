/**
 * Monta a lista de condições do `.or(...)` usado por DeletedDealsDrawer para
 * buscar negócios excluídos — tanto na consulta das linhas quanto na
 * contagem (`count: 'exact'`), garantindo que ambas usem exatamente o mesmo
 * filtro. Mantido puro e separado do componente para ser testado sem rede.
 *
 * Escape do ILIKE (`%`, `_`, `\`) e serialização da gramática do PostgREST
 * (valor entre aspas duplas) são etapas separadas — ver `@/lib/postgrestFilter`.
 */
import { ilikeContains } from "@/lib/postgrestFilter";
export { escapeIlikeWildcards as escapeIlikeTerm } from "@/lib/postgrestFilter";

export interface BuildDeletedDealsOrFilterInput {
  term: string;
  /** ids de `users` (referenciados por responsible_user_id) cujo nome combina com o termo */
  matchingUserIds: string[];
  /** auth_user_id de quem excluiu, cujo nome combina com o termo */
  matchingAuthIds: string[];
}

/**
 * Retorna as condições do `.or()` para o termo buscado, ou `null` quando o
 * termo é vazio (sem filtro de busca aplicado).
 */
export function buildDeletedDealsOrFilter({
  term,
  matchingUserIds,
  matchingAuthIds,
}: BuildDeletedDealsOrFilterInput): string | null {
  if (!term) return null;

  const digits = term.replace(/\D/g, "");
  const orParts = [
    ilikeContains("title", term),
    ilikeContains("contact_name", term),
    ilikeContains("contact_email", term),
  ];
  if (digits.length >= 4) orParts.push(`contact_phone.ilike.%${digits}%`);

  // Nome de responsável ou de quem excluiu: inclui no MESMO .or() usado nas
  // linhas e na contagem, para que ambos reflitam exatamente os mesmos
  // resultados.
  if (matchingUserIds.length > 0) {
    orParts.push(`responsible_user_id.in.(${matchingUserIds.join(",")})`);
  }
  if (matchingAuthIds.length > 0) {
    orParts.push(`deleted_by.in.(${matchingAuthIds.join(",")})`);
  }

  return orParts.join(",");
}
