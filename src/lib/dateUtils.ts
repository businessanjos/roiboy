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

/**
 * Converte uma string de datetime-local para ISO UTC.
 * datetime-local retorna "2026-01-21T13:30", que deve ser tratado como horário LOCAL.
 */
export function localDateTimeToUTC(dateTimeLocal: string): string {
  if (!dateTimeLocal) return "";
  // new Date() interpreta "YYYY-MM-DDTHH:mm" como horário local
  // toISOString() converte corretamente para UTC
  return new Date(dateTimeLocal).toISOString();
}

/**
 * Converte uma string ISO UTC para formato datetime-local (para inputs).
 * Usado ao preencher forms de edição.
 */
export function utcToLocalDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  // Formatar como YYYY-MM-DDTHH:mm no horário LOCAL do usuário
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Formata uma data como ISO string mantendo o horário LOCAL (sem conversão UTC).
 * Usado para APIs que esperam horário local com timezone separado (ex: Zoom, Google Calendar).
 * Retorna formato: YYYY-MM-DDTHH:mm:ss
 */
export function formatLocalISOString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}
