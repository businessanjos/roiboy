import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { Move } from "lucide-react";
import GridLayout from "react-grid-layout";

import { getCompactor } from "react-grid-layout/core";
import { InsightsVisual } from "@/hooks/useInsightsDashboards";
import { ConfigurableVisualCard } from "../visuals/ConfigurableVisualCard";
import { useIsMobile } from "@/hooks/use-mobile";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

// Free position compactor: no compaction, allows overlap, true free-form positioning
const freePositionCompactor = getCompactor(null, true, false);

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

interface InsightsGridProps {
  visuals: InsightsVisual[];
  onLayoutChange: (layouts: Array<{ id: string; layout: LayoutItem }>) => void;
  readOnly?: boolean;
  onUpdateVisual?: (id: string, updates: any) => Promise<void>;
  onRemoveVisual?: (id: string) => Promise<void>;
  /** Optional per-surface override of the auto-fit minimum card widths (px). */
  minCardWidths?: Partial<MinCardWidths>;
  /** TV mode: fit every visual inside the available height (no page scroll). */
  fitHeight?: boolean;
}

const ROW_HEIGHT = 20;
const COLS = 48;
const MARGIN: [number, number] = [12, 12];
const CONTAINER_PADDING: [number, number] = [4, 4];

// ── Helpers ──────────────────────────────────────────────────

function getMobileMinHeight(visual: InsightsVisual): string {
  const ct = visual.chart_type || "bar";
  if (["scorecard", "kpi", "number"].includes(ct)) return "min-h-[120px]";
  if (["table", "ranking"].includes(ct)) return "min-h-[280px]";
  if (ct === "map") return "min-h-[300px]";
  if (["pie", "donut"].includes(ct)) return "min-h-[280px]";
  return "min-h-[260px]";
}

function getMinHeight(visual: InsightsVisual): number {
  const ct = visual.chart_type || "bar";
  if (["number", "scorecard", "kpi"].includes(ct)) return 120;
  if (["table", "ranking", "data_table"].includes(ct)) return 300;
  if (ct === "map") return 400;
  if (ct === "gauge") return 200;
  if (ct === "funnel") return 360;
  return 280;
}

function isGauge(visual: InsightsVisual) {
  return visual.chart_type === "gauge";
}

function isCompactCard(visual: InsightsVisual) {
  return isScorecard(visual) || isGauge(visual);
}

function isScorecard(visual: InsightsVisual) {
  return ["number", "scorecard", "kpi"].includes(visual.chart_type || "bar");
}

// ── Row-grouping: groups visuals by their y-position proximity ──

interface VisualRow {
  visuals: InsightsVisual[];
  isAllScorecards: boolean;
  isAllCompact: boolean;
}

function groupVisualsIntoRows(visuals: InsightsVisual[]): VisualRow[] {
  if (visuals.length === 0) return [];

  // Extract all scorecards and gauges first, regardless of position
  const allScorecards = visuals.filter(isScorecard);
  const allGauges = visuals.filter(isGauge);
  const regularVisuals = visuals.filter(v => !isScorecard(v) && !isGauge(v));

  const rows: VisualRow[] = [];

  // Scorecards row at top
  if (allScorecards.length > 0) {
    rows.push({
      visuals: allScorecards.sort((a, b) => (a.layout?.x ?? 0) - (b.layout?.x ?? 0)),
      isAllScorecards: true,
      isAllCompact: true,
    });
  }

  // Gauges row right below scorecards
  if (allGauges.length > 0) {
    rows.push({
      visuals: allGauges.sort((a, b) => (a.layout?.x ?? 0) - (b.layout?.x ?? 0)),
      isAllScorecards: false,
      isAllCompact: true,
    });
  }

  // Group remaining visuals by y-proximity
  if (regularVisuals.length > 0) {
    const sorted = [...regularVisuals].sort((a, b) => {
      const ay = a.layout?.y ?? 0;
      const by = b.layout?.y ?? 0;
      if (ay !== by) return ay - by;
      return (a.layout?.x ?? 0) - (b.layout?.x ?? 0);
    });

    const isFullWidth = (v: InsightsVisual) => v.layout?.col_span === "1/1";

    let currentRow: InsightsVisual[] = [sorted[0]];
    let currentY = sorted[0].layout?.y ?? 0;

    for (let i = 1; i < sorted.length; i++) {
      const vy = sorted[i].layout?.y ?? 0;
      const breaksRow =
        isFullWidth(sorted[i]) ||
        currentRow.some(isFullWidth) ||
        Math.abs(vy - currentY) > 5;
      if (!breaksRow) {
        currentRow.push(sorted[i]);
      } else {
        rows.push({
          visuals: currentRow,
          isAllScorecards: false,
          isAllCompact: false,
        });
        currentRow = [sorted[i]];
        currentY = vy;
      }
    }


    rows.push({
      visuals: currentRow,
      isAllScorecards: false,
      isAllCompact: false,
    });
  }

  return rows;
}

// ── Responsive static grid ──

/** Minimum card widths (px) used by the auto-fit CSS grid. Parametrizable per surface. */
export interface MinCardWidths {
  /** scorecard / kpi / number */
  scorecard: number;
  gauge: number;
  /** everything else */
  default: number;
}

export const DEFAULT_MIN_CARD_WIDTHS: MinCardWidths = {
  scorecard: 220,
  gauge: 300,
  default: 300,
};

const GRID_GAP = 12;

function getRowMinWidth(row: VisualRow, mins: MinCardWidths): number {
  if (row.isAllScorecards) return mins.scorecard;
  if (row.isAllCompact) return mins.gauge;
  return mins.default;
}

function ResponsiveInsightsGrid({ visuals, onUpdateVisual, onRemoveVisual, containerWidth, readOnly, minCardWidths, fitHeight }: {
  visuals: InsightsVisual[];
  onUpdateVisual?: (id: string, updates: any) => Promise<void>;
  onRemoveVisual?: (id: string) => Promise<void>;
  containerWidth: number;
  readOnly?: boolean;
  minCardWidths?: Partial<MinCardWidths>;
  fitHeight?: boolean;
}) {
  const rows = useMemo(() => groupVisualsIntoRows(visuals), [visuals]);
  const mins = useMemo(() => ({ ...DEFAULT_MIN_CARD_WIDTHS, ...(minCardWidths || {}) }), [minCardWidths]);

  return (
    <div className={fitHeight ? "flex flex-col gap-3 h-full min-h-0" : "flex flex-col gap-3"}>
      {rows.map((row, rowIdx) => (
        <ResponsiveRow
          key={rowIdx}
          row={row}
          containerWidth={containerWidth}
          onUpdateVisual={onUpdateVisual}
          onRemoveVisual={onRemoveVisual}
          readOnly={readOnly}
          minWidth={getRowMinWidth(row, mins)}
          fitHeight={fitHeight}
        />
      ))}
    </div>
  );
}

function ResponsiveRow({ row, containerWidth, onUpdateVisual, onRemoveVisual, readOnly, minWidth, fitHeight }: {
  row: VisualRow;
  containerWidth: number;
  onUpdateVisual?: (id: string, updates: any) => Promise<void>;
  onRemoveVisual?: (id: string) => Promise<void>;
  readOnly?: boolean;
  minWidth: number;
  fitHeight?: boolean;
}) {
  const { visuals } = row;

  // How many columns the auto-fit grid will actually create at this width.
  // Used only to translate col_span (1/1, 1/2, 1/3) into a real column span.
  const fitMinWidth = fitHeight ? Math.min(minWidth, 200) : minWidth;
  const effectiveCols = Math.max(
    1,
    Math.min(visuals.length, Math.floor((containerWidth + GRID_GAP) / (fitMinWidth + GRID_GAP)) || 1)
  );

  return (
    <div
      className={fitHeight ? "grid gap-3 min-h-0" : "grid gap-3"}
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(${fitMinWidth}px, 1fr))`,
        ...(fitHeight
          ? {
              // Compact rows (scorecards / gauges) take less vertical space than charts
              flex: `${row.isAllScorecards ? 0.55 : row.isAllCompact ? 0.9 : 1} 1 0%`,
              gridAutoRows: "1fr",
            }
          : {}),
      }}
    >
      {visuals.map((visual) => {
        const minH = getMinHeight(visual);
        const colSpan = visual.layout?.col_span;

        let span = 1;
        if (colSpan === "1/1") span = effectiveCols;
        else if (colSpan === "1/2") span = Math.max(1, Math.round(effectiveCols / 2));
        else if (colSpan === "1/3") span = Math.max(1, Math.round(effectiveCols / 3));

        return (
          <div
            key={visual.id}
            className={`overflow-hidden rounded-lg min-w-0 ${fitHeight ? "h-full min-h-0" : ""}`}
            style={{
              ...(fitHeight ? { minHeight: 0 } : { minHeight: minH }),
              gridColumn: `span ${Math.min(span, effectiveCols)} / span ${Math.min(span, effectiveCols)}`,
            }}
          >
            <ConfigurableVisualCard
              visual={visual}
              onUpdateVisual={readOnly ? undefined : onUpdateVisual}
              onRemoveVisual={readOnly ? undefined : onRemoveVisual}
              readOnly={readOnly}
            />
          </div>
        );

      })}
    </div>
  );
}


// ── Mobile: stacked ──

function MobileInsightsGrid({ visuals, onUpdateVisual, onRemoveVisual, readOnly }: {
  visuals: InsightsVisual[];
  onUpdateVisual?: (id: string, updates: any) => Promise<void>;
  onRemoveVisual?: (id: string) => Promise<void>;
  readOnly?: boolean;
}) {
  const sorted = useMemo(() => {
    return [...visuals].sort((a, b) => {
      const ay = a.layout?.y ?? 0;
      const by = b.layout?.y ?? 0;
      if (ay !== by) return ay - by;
      return (a.layout?.x ?? 0) - (b.layout?.x ?? 0);
    });
  }, [visuals]);

  return (
    <div className="space-y-3">
      {sorted.map((visual) => (
        <div key={visual.id} className={`w-full rounded-lg overflow-hidden ${getMobileMinHeight(visual)}`}>
          <ConfigurableVisualCard visual={visual} onUpdateVisual={onUpdateVisual} onRemoveVisual={onRemoveVisual} readOnly={readOnly} />
        </div>
      ))}
    </div>
  );
}

// ── Layout item conversion ──

function visualToLayoutItem(visual: InsightsVisual, index: number): LayoutItem {
  const existingLayout = visual.layout;

  if (existingLayout) {
    if (existingLayout.scale === 48) {
      return {
        i: visual.id,
        x: existingLayout.x,
        y: existingLayout.y,
        w: existingLayout.w,
        h: existingLayout.h,
        minW: 8,
        minH: 10,
      };
    }
    return {
      i: visual.id,
      x: existingLayout.x * 4,
      y: existingLayout.y * 5,
      w: existingLayout.w * 4,
      h: existingLayout.h * 5,
      minW: 8,
      minH: 10,
    };
  }

  return {
    i: visual.id,
    x: (index % 2) * 24,
    y: Math.floor(index / 2) * 20,
    w: 24,
    h: 18,
    minW: 8,
    minH: 8,
  };
}

// ── Main component ──

const FREE_LAYOUT_KEY = "insights:free-layout-mode";

export function InsightsGrid({ visuals, onLayoutChange, readOnly = false, onUpdateVisual, onRemoveVisual, minCardWidths, fitHeight }: InsightsGridProps) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [freeLayout, setFreeLayout] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(FREE_LAYOUT_KEY) === "1";
  });

  const toggleFreeLayout = useCallback(() => {
    setFreeLayout((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(FREE_LAYOUT_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const [localLayout, setLocalLayout] = useState<LayoutItem[]>(() =>
    visuals.map((v, i) => visualToLayoutItem(v, i))
  );


  const prevVisualIdsRef = useRef<string>(visuals.map(v => v.id).sort().join(","));
  const isMountedRef = useRef(false);

  useEffect(() => {
    const currentIds = visuals.map(v => v.id).sort().join(",");
    if (currentIds !== prevVisualIdsRef.current) {
      prevVisualIdsRef.current = currentIds;
      isMountedRef.current = false;
      setLocalLayout(prev => {
        const existingMap = new Map(prev.map(item => [item.i, item]));
        return visuals.map((v, i) => existingMap.get(v.id) || visualToLayoutItem(v, i));
      });
    }
  }, [visuals]);

  // ResizeObserver with debounce
  useEffect(() => {
    if (!containerRef.current || isMobile) return;

    let rafId: number | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleWidthUpdate = (nextWidth: number) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (rafId) cancelAnimationFrame(rafId);

      debounceTimer = setTimeout(() => {
        rafId = requestAnimationFrame(() => {
          setWidth((prev) => (prev === nextWidth ? prev : nextWidth));
        });
      }, 50);
    };

    scheduleWidthUpdate(containerRef.current.getBoundingClientRect().width);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        scheduleWidthUpdate(entry.contentRect.width);
      }
    });

    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isMobile, readOnly]);

  const handleContinuousLayoutChange = useCallback(
    (newLayout: LayoutItem[]) => {
      if (!isMountedRef.current) {
        isMountedRef.current = true;
        return;
      }
      setLocalLayout(newLayout.map(item => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: 8,
        minH: 10,
      })));
    },
    []
  );

  const handlePersist = useCallback(
    (newLayout: LayoutItem[]) => {
      const layoutUpdates = newLayout.map((item) => ({
        id: item.i,
        layout: { i: item.i, x: item.x, y: item.y, w: item.w, h: item.h, scale: 48 },
      }));
      onLayoutChange(layoutUpdates);
      // In free layout mode the grid stays visible/editable
      if (!freeLayout) setTimeout(() => setIsEditing(false), 100);
    },
    [onLayoutChange, freeLayout]
  );


  const handleDragStart = useCallback(() => setIsEditing(true), []);
  const handleResizeStart = useCallback(() => setIsEditing(true), []);

  if (visuals.length === 0) return null;

  if (isMobile) {
    return (
      <MobileInsightsGrid
        visuals={visuals}
        onUpdateVisual={readOnly ? undefined : onUpdateVisual}
        onRemoveVisual={readOnly ? undefined : onRemoveVisual}
        readOnly={readOnly}
      />
    );
  }

  const containerWidth = width ?? 1200;

  if (readOnly) {
    return (
      <div ref={containerRef} className={`insights-grid pointer-events-auto relative ${fitHeight ? "h-full min-h-0 overflow-hidden" : ""}`}>
        <ResponsiveInsightsGrid
          visuals={visuals}
          onUpdateVisual={undefined}
          onRemoveVisual={undefined}
          containerWidth={containerWidth}
          readOnly
          minCardWidths={minCardWidths}
          fitHeight={fitHeight}
        />
      </div>
    );
  }

  const gridVisible = freeLayout || isEditing;

  // Responsive CSS grid by default; free layout mode keeps the draggable/resizable grid visible
  return (
    <div ref={containerRef} className={`insights-grid pointer-events-auto relative ${freeLayout ? "free-layout" : ""}`}>
      <div className="flex justify-end pb-2">
        <button
          type="button"
          onClick={toggleFreeLayout}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
            freeLayout
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-muted/50"
          }`}
          title="Redimensionar e posicionar os cards livremente"
        >
          <Move className="h-3.5 w-3.5" />
          {freeLayout ? "Concluir layout" : "Ajustar layout"}
        </button>
      </div>

      {/* Responsive CSS grid — visible when not in free/edit mode */}
      {!gridVisible && (
        <ResponsiveInsightsGrid
          visuals={visuals}
          onUpdateVisual={onUpdateVisual}
          onRemoveVisual={onRemoveVisual}
          containerWidth={containerWidth}
          readOnly={readOnly}
          minCardWidths={minCardWidths}
        />
      )}

      {/* React-grid-layout — interactive drag/resize surface */}
      <div className={gridVisible ? "block" : "absolute inset-0 opacity-0 pointer-events-none"}
        style={!gridVisible ? { height: 0, overflow: "hidden" } : undefined}
      >

        <GridLayout
          className="layout"
          layout={localLayout}
          width={containerWidth}
          onLayoutChange={handleContinuousLayoutChange}
          onDragStart={handleDragStart}
          onResizeStart={handleResizeStart}
          onDragStop={handlePersist}
          onResizeStop={handlePersist}
          gridConfig={{
            cols: COLS,
            rowHeight: ROW_HEIGHT,
            margin: MARGIN,
            containerPadding: CONTAINER_PADDING,
          }}
          dragConfig={{
            enabled: !readOnly,
            handle: ".widget-drag-handle",
          }}
          resizeConfig={{
            enabled: !readOnly,
          }}
          compactor={freePositionCompactor}
        >
          {visuals.map((visual) => (
            <div key={visual.id} className="h-full overflow-hidden rounded-lg">
              <ConfigurableVisualCard visual={visual} onUpdateVisual={readOnly ? undefined : onUpdateVisual} onRemoveVisual={readOnly ? undefined : onRemoveVisual} readOnly={readOnly} />
            </div>
          ))}
        </GridLayout>
      </div>

      <style>{`
        .insights-grid .react-grid-item {
          transition: none;
        }
        .insights-grid .react-grid-item.resizing {
          z-index: 1;
          will-change: width, height;
        }
        .insights-grid .react-grid-item.react-draggable-dragging {
          z-index: 100;
          will-change: transform;
        }
        .insights-grid .react-grid-item > .react-resizable-handle {
          position: absolute;
          width: 22px;
          height: 22px;
        }
        .insights-grid .react-grid-item > .react-resizable-handle::after {
          content: "";
          position: absolute;
          right: 4px;
          bottom: 4px;
          width: 9px;
          height: 9px;
          border-right: 2px solid hsl(var(--muted-foreground));
          border-bottom: 2px solid hsl(var(--muted-foreground));
          opacity: 0.5;
        }
        .insights-grid.free-layout .react-grid-item {
          outline: 1px dashed hsl(var(--border));
          outline-offset: 2px;
          border-radius: 0.5rem;
        }
        .insights-grid.free-layout .react-grid-item > .react-resizable-handle::after {
          border-color: hsl(var(--primary));
          opacity: 1;
        }
        .insights-grid.free-layout .widget-drag-handle {
          cursor: move;
        }
        .insights-grid .react-grid-placeholder {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
        }
        .insights-grid.free-layout .react-grid-placeholder {
          display: block !important;
          opacity: 0.15 !important;
          visibility: visible !important;
          background: hsl(var(--primary)) !important;
          border-radius: 0.5rem;
        }

      `}</style>
    </div>
  );
}
