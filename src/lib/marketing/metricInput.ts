/** Digits only → "1.860" (pt-BR thousands). */
export function formatMetricInput(raw: string | number): string {
  const digits = String(raw ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits ? Number(digits).toLocaleString("pt-BR") : "";
}
/** "1.860" → 1860 (dots are thousands separators, never decimals). */
export function parseMetricInput(value: string): number {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}
