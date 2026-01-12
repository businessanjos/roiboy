/**
 * Parseia uma string de data no formato YYYY-MM-DD como hora local meia-noite,
 * evitando o problema de timezone onde new Date("YYYY-MM-DD") cria UTC.
 */
export function parseLocalDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return null;
  
  return new Date(year, month - 1, day); // month é 0-indexed
}

/**
 * Formata uma data para exibição no formato brasileiro (DD/MM/YYYY)
 * a partir de uma string YYYY-MM-DD, evitando problemas de timezone.
 */
export function formatLocalDate(dateString: string | null | undefined): string {
  const date = parseLocalDate(dateString);
  if (!date) return "";
  
  return date.toLocaleDateString("pt-BR");
}
