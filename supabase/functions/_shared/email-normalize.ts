/**
 * Normalização canônica de emails para matching consistente entre
 * Typeform, leads, deals e webhooks externos.
 *
 * Regras:
 *  - trim
 *  - lowercase
 *  - remove "mailto:" e espaços internos
 *  - retorna null para strings vazias / sem '@'
 */
export function canonicalEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  let e = String(input).trim().toLowerCase();
  if (!e) return null;
  if (e.startsWith("mailto:")) e = e.slice(7);
  e = e.replace(/\s+/g, "");
  if (!e.includes("@")) return null;
  return e;
}
