export function countScreeningAnswers(raw: unknown): number {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
  return Object.values(raw as Record<string, unknown>).filter(
    (v) => (typeof v === "string" ? v.trim().length > 0 : v !== null && v !== undefined)
  ).length;
}
