import { DateGrouping } from "@/components/insights/visual-builder/types";

const DAY_MS = 86400000;

const ORDER: DateGrouping[] = ['day', 'week', 'month', 'year'];

/**
 * Granularidade mínima legível para uma janela de tempo.
 * - até ~45 dias  -> dia
 * - até ~120 dias -> semana
 * - até ~3 anos   -> mês
 * - acima disso   -> ano
 */
export function minimumGrainForSpan(days: number): DateGrouping {
  if (days <= 45) return 'day';
  if (days <= 120) return 'week';
  if (days <= 1100) return 'month';
  return 'year';
}

export function spanInDays(startDate?: string, endDate?: string): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, (end - start) / DAY_MS);
}

/**
 * Ajusta o agrupamento configurado para nunca ser mais fino que o
 * suportado pelo período filtrado (evita centenas de rótulos no eixo X).
 * Nunca torna o agrupamento mais fino do que o usuário escolheu.
 */
export function resolveAdaptiveGrain(
  configured: DateGrouping | undefined,
  startDate?: string,
  endDate?: string,
): DateGrouping | undefined {
  if (!configured) return configured;
  const days = spanInDays(startDate, endDate);
  if (days === null) return configured;
  const minimum = minimumGrainForSpan(days);
  return ORDER.indexOf(minimum) > ORDER.indexOf(configured) ? minimum : configured;
}

/**
 * Aplica {@link resolveAdaptiveGrain} sobre um VisualConfig.
 */
export function withAdaptiveDateGrain<T extends { dimension?: any } | null>(
  cfg: T,
  startDate?: string,
  endDate?: string,
): T {
  if (!cfg) return cfg;
  const dimension = (cfg as any).dimension;
  if (!dimension?.dateGrouping) return cfg;
  const next = resolveAdaptiveGrain(dimension.dateGrouping, startDate, endDate);
  if (!next || next === dimension.dateGrouping) return cfg;
  return { ...(cfg as any), dimension: { ...dimension, dateGrouping: next } } as T;
}
