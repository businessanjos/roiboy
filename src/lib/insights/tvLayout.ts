/** TV-only density; never changes the editable/saved dashboard layout. */
export interface TvVisualShape {
  chart_type?: string | null;
  config?: { rankingCompanyIds?: unknown; stackBy?: unknown; stackByCustomField?: unknown } | null;
}

export function hasCompanyRanking(visual: TvVisualShape): boolean {
  return visual.chart_type === 'ranking' && Array.isArray(visual.config?.rankingCompanyIds) && visual.config.rankingCompanyIds.length > 0;
}

export function tvRowSizing(visuals: TvVisualShape[], sellerBoard: boolean, fallback: { minHeight: number; weight: number }) {
  if (!sellerBoard) return fallback;
  if (visuals.some(hasCompanyRanking)) return { minHeight: 320, weight: 1.05 };
  if (visuals.every(v => v.chart_type === 'call_commercial')) return { minHeight: 180, weight: 0.65 };
  if (visuals.every(v => ['bar', 'bar_horizontal', 'bar_stacked'].includes(v.chart_type || ''))) return { minHeight: 220, weight: 1 };
  return fallback;
}