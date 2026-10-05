/**
 * Monta a lista de condições do `.or(...)` usado por DeletedDealsDrawer para
 * buscar negócios excluídos — tanto na consulta das linhas quanto na
 * contagem (`count: 'exact'`), garantindo que ambas usem exatamente o mesmo
 * filtro. Mantido puro e separado do componente para ser testado sem rede.
 *
 * Escapa o termo para uso seguro dentro da gramática do .or()/.ilike() do
 * PostgREST: vírgula e parênteses quebram a lista de condições, '%' e '_'
 * são coringas do ILIKE e precisam ser tratados como texto literal.
 */
export function escapeIlikeTerm(term: string): string {
  return term.replace(/[\\%_,()]/g, (c) => `\\${c}`);
}

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

  const safeTerm = escapeIlikeTerm(term);
  const digits = term.replace(/\D/g, "");
  const orParts = [
    `title.ilike.%${safeTerm}%`,
    `contact_name.ilike.%${safeTerm}%`,
    `contact_email.ilike.%${safeTerm}%`,
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
