/** Short "x mi" / "x mil" hint so large BRL totals are never misread. */
export function formatMillionsHint(v: number): string {
  const abs = Math.abs(v);
  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (abs >= 1_000_000) return `≈ ${fmt(v / 1_000_000)} mi`;
  if (abs >= 1_000) return `≈ ${fmt(v / 1_000)} mil`;
  return "";
}

/** Axis tick: 4.5M → "4,5 mi". */
export function formatAxisMillions(v: number): string {
  const abs = Math.abs(v);
  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (abs >= 1_000_000) return `${fmt(v / 1_000_000)} mi`;
  if (abs >= 1_000) return `${fmt(v / 1_000)} mil`;
  return String(v);
}
