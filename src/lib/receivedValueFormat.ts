/**
 * Helpers for the "Valor recebido" field in DealDetailSheet.
 *
 * The draft is stored as a string of raw digits representing CENTS.
 * This preserves trailing zeros while the user types (e.g. "0", "00", "1050").
 */

/** Strip non-digits from raw user input and return the digits-only string (cents). */
export function parseReceivedInput(input: string): string {
  return (input ?? "").replace(/\D/g, "");
}

/** Format a digits-only cents string for display as pt-BR currency (no R$ prefix). */
export function formatReceivedDraft(draft: string): string {
  if (!draft) return "";
  const num = Number(draft) / 100;
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Convert a numeric DB value (reais) into the draft cents-string. */
export function toReceivedDraft(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n * 100));
}

/** Convert the draft back to a number in reais (or null if empty). */
export function fromReceivedDraft(draft: string): number | null {
  if (!draft) return null;
  return Number(draft) / 100;
}
