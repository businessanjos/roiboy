/**
 * Paleta oficial Ryka para gráficos (inclusive Recharts).
 * Sempre tokens de tema — nunca hex hardcoded.
 */
export const RYKA_CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
] as const;

export function rykaChartColor(index: number) {
  return RYKA_CHART_COLORS[Math.abs(index) % RYKA_CHART_COLORS.length];
}
