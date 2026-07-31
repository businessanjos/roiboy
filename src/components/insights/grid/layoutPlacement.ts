/**
 * Generic helpers to place visuals inside the 48-column insights grid.
 * Reused by any dashboard surface (Insights, Marketing, Financeiro, WhatsApp, TeamInsights).
 */

export const GRID_COLS = 48;

export interface GridRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StoredLayout {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  scale?: number;
  [key: string]: unknown;
}

/** Converts a stored layout (legacy 12-col scale or native 48-col) into 48-col coordinates. */
export function normalizeToGrid48(layout?: StoredLayout | null): GridRect | null {
  if (!layout) return null;
  const { x = 0, y = 0, w = 6, h = 4, scale } = layout;
  if (scale === GRID_COLS) return { x, y, w, h };
  return { x: x * 4, y: y * 5, w: w * 4, h: h * 5 };
}

function overlaps(a: GridRect, b: GridRect) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Finds the first free slot (scanning top-to-bottom, left-to-right) that fits w x h
 * without overlapping any existing rect.
 */
export function findNextFreePosition(
  existing: Array<StoredLayout | null | undefined>,
  w: number,
  h: number,
  cols: number = GRID_COLS
): { x: number; y: number } {
  const rects = existing
    .map(normalizeToGrid48)
    .filter((r): r is GridRect => !!r);

  if (rects.length === 0) return { x: 0, y: 0 };

  const width = Math.min(w, cols);
  const maxY = rects.reduce((m, r) => Math.max(m, r.y + r.h), 0);

  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x <= cols - width; x++) {
      const candidate: GridRect = { x, y, w: width, h };
      if (!rects.some((r) => overlaps(candidate, r))) {
        return { x, y };
      }
    }
  }

  return { x: 0, y: maxY };
}

/**
 * Builds the layout for a brand new visual, keeping the historical per-chart-type
 * default sizes (expressed in the legacy 12-col scale) but persisting in 48-col scale.
 */
export function buildNewVisualLayout(
  existing: Array<StoredLayout | null | undefined>,
  legacyW: number,
  legacyH: number
): GridRect & { scale: number } {
  const w = Math.min(legacyW * 4, GRID_COLS);
  const h = legacyH * 5;
  const { x, y } = findNextFreePosition(existing, w, h);
  return { x, y, w, h, scale: GRID_COLS };
}
