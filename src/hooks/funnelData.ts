/**
 * Pure helpers for funnel data normalization.
 * Extracted from useVisualData to be testable in isolation.
 *
 * Regression target: ensure the funnel never shows duplicate entries
 * for stages that share the same name across multiple pipelines
 * (e.g. "Reunião Agendada" existing in pipelines A and B).
 */

export interface FunnelStageRow {
  name: string;
  display_order: number | null;
  color: string | null;
}

export interface FunnelDataPoint {
  name: string;
  value: number;
  count?: number;
  color?: string;
  secondaryValue?: number;
}

export interface UniqueStage {
  name: string;
  display_order: number;
  color: string | null;
}

/**
 * Deduplicate a list of pipeline stages by name. When the same stage
 * name appears in multiple pipelines, keep the smallest display_order
 * and the first non-empty color.
 */
export function dedupeStagesByName(stages: FunnelStageRow[]): UniqueStage[] {
  const map = new Map<string, UniqueStage>();
  for (const stage of stages) {
    const order = stage.display_order ?? 999;
    const existing = map.get(stage.name);
    if (!existing) {
      map.set(stage.name, {
        name: stage.name,
        display_order: order,
        color: stage.color,
      });
    } else {
      if (order < existing.display_order) {
        existing.display_order = order;
      }
      if (!existing.color && stage.color) {
        existing.color = stage.color;
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Merge aggregated result rows + pipeline stages into a single, ordered,
 * de-duplicated list of funnel points.
 *
 * Rules:
 * - If the aggregated result contains duplicate names, sum their values
 *   and counts and keep the first non-empty color.
 * - Every unique stage from the pipeline must appear at least once,
 *   even with value 0 (so the funnel shows the full path).
 * - Final order respects the pipeline display_order.
 */
export function buildFunnelStageData(
  aggregatedResult: FunnelDataPoint[],
  stages: FunnelStageRow[]
): FunnelDataPoint[] {
  const uniqueStages = dedupeStagesByName(stages);
  const orderMap = new Map(uniqueStages.map((s) => [s.name, s.display_order]));

  const resultMap = new Map<string, FunnelDataPoint>();
  for (const item of aggregatedResult) {
    const existing = resultMap.get(item.name);
    if (!existing) {
      resultMap.set(item.name, { ...item });
    } else {
      existing.value = (existing.value || 0) + (item.value || 0);
      existing.count = (existing.count || 0) + (item.count || 0);
      if (!existing.color && item.color) existing.color = item.color;
    }
  }

  for (const stage of uniqueStages) {
    if (!resultMap.has(stage.name)) {
      resultMap.set(stage.name, {
        name: stage.name,
        value: 0,
        count: 0,
        color: stage.color || "#6366f1",
      });
    }
  }

  return Array.from(resultMap.values()).sort(
    (a, b) => (orderMap.get(a.name) ?? 999) - (orderMap.get(b.name) ?? 999)
  );
}
