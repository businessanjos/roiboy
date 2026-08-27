export function countScreeningAnswers(raw: unknown): number {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
  return Object.values(raw as Record<string, unknown>).filter(
    (v) => (typeof v === "string" ? v.trim().length > 0 : v !== null && v !== undefined)
  ).length;
}

export function screeningAnswersText(raw: unknown): string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  return Object.values(raw as Record<string, unknown>)
    .map((v) => (typeof v === "string" ? v : v == null ? "" : String(v)))
    .join(" \n ");
}

export function screeningAnswersLength(raw: unknown): number {
  return screeningAnswersText(raw).trim().length;
}

export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
