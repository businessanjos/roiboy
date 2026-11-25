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
  // Stacked bars also need room for their legend, totals and seller labels.
  if (visuals.some(v => v.chart_type === 'bar_stacked' || (v.chart_type === 'bar' && (v.config?.stackBy || v.config?.stackByCustomField)))) return { minHeight: 300, weight: 1 };
  if (visuals.every(v => ['bar', 'bar_horizontal', 'bar_stacked'].includes(v.chart_type || ''))) return { minHeight: 220, weight: 1 };
  return fallback;
}

/** A fitted row must reserve its natural content before distributing spare space. */
export function tvRowContentSizing(sizing: { minHeight: number; weight: number }, contentHeight: number) {
  return { ...sizing, minHeight: Math.max(sizing.minHeight, Math.ceil(contentHeight)) };
}

/** Local presentation defaults only; explicit links and newer device choices win. */
export function tvPresentationDefault(dashboardId: string | null, sellerBoard: boolean) {
  const mqlBoard = dashboardId === '29104b57-a5bf-41aa-b28a-2bd42a525206';
  return { tvFit: sellerBoard || !mqlBoard, zoom: sellerBoard || mqlBoard ? 60 : 100 };
}

/** Zoom expands the drawing canvas, while the content floor still prevents clipping. */
export function tvStageSizing(width: number, height: number, requiredHeight = 0, headerAllowance = 0, zoom = 100) {
  const zoomScale = Math.min(1, Math.max(0.5, zoom / 100));
  const stageAllowance = headerAllowance + 4;
  const targetContent = Math.max(1, height / zoomScale - stageAllowance, requiredHeight);
  const fit = height ? Math.min(zoomScale, height / (targetContent + stageAllowance)) : zoomScale;
  return {
    fit,
    stageWidth: width ? width / fit : undefined,
    stageHeight: height ? targetContent + stageAllowance : undefined,
    // Compensate only automatic fitting, never the user's intentional zoom reduction.
    fontScale: Math.min(1.2, 1 / Math.max(fit / zoomScale, 0.85)),
  };
}