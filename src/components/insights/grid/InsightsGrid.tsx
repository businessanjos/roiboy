import { useMemo, useRef, useEffect, useState, useCallback } from "react";
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

  const sorted = [...visuals].sort((a, b) => {
    const ay = a.layout?.y ?? 0;
    const by = b.layout?.y ?? 0;
    if (ay !== by) return ay - by;
    return (a.layout?.x ?? 0) - (b.layout?.x ?? 0);
  });

  const rawRows: VisualRow[] = [];
  let currentRow: InsightsVisual[] = [sorted[0]];
  let currentY = sorted[0].layout?.y ?? 0;

  for (let i = 1; i < sorted.length; i++) {
    const vy = sorted[i].layout?.y ?? 0;
    // If within 5 units of y, treat as same row
    if (Math.abs(vy - currentY) <= 5) {
      currentRow.push(sorted[i]);
    } else {
      rawRows.push({
        visuals: currentRow,
        isAllScorecards: currentRow.every(isScorecard),
      });
      currentRow = [sorted[i]];
      currentY = vy;
    }
  }

  rawRows.push({
    visuals: currentRow,
    isAllScorecards: currentRow.every(isScorecard),
  });

  // Merge consecutive scorecard-only rows into a single row
  const rows: VisualRow[] = [];
  for (const row of rawRows) {
    const prev = rows[rows.length - 1];
    if (prev && prev.isAllScorecards && row.isAllScorecards) {
      prev.visuals.push(...row.visuals);
    } else {
      rows.push(row);
    }
  }

  return rows;
}

// ── Responsive static grid ──

function ResponsiveInsightsGrid({ visuals, onUpdateVisual, onRemoveVisual, containerWidth }: {
  visuals: InsightsVisual[];
  onUpdateVisual?: (id: string, updates: any) => Promise<void>;
  onRemoveVisual?: (id: string) => Promise<void>;
  containerWidth: number;
}) {
  const rows = useMemo(() => groupVisualsIntoRows(visuals), [visuals]);

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, rowIdx) => (
        <ResponsiveRow
          key={rowIdx}
          row={row}
          containerWidth={containerWidth}
          onUpdateVisual={onUpdateVisual}
          onRemoveVisual={onRemoveVisual}
        />
      ))}
    </div>
  );
}

function ResponsiveRow({ row, containerWidth, onUpdateVisual, onRemoveVisual }: {
  row: VisualRow;
  containerWidth: number;
  onUpdateVisual?: (id: string, updates: any) => Promise<void>;
  onRemoveVisual?: (id: string) => Promise<void>;
}) {
  const { visuals, isAllScorecards } = row;

  // Calculate flex basis for each visual based on its w proportion
  const totalW = visuals.reduce((sum, v) => sum + (v.layout?.w ?? 24), 0);
  const scale = visuals[0]?.layout?.scale || 48;

  // For scorecard rows: don't set minWidth so all fit in one line
  const gapPx = 12;

  return (
    <div
      className="flex gap-3"
      style={{ flexWrap: isAllScorecards ? "nowrap" : "wrap" }}
    >
      {visuals.map((visual) => {
        const w = visual.layout?.w ?? 24;
        const minH = getMinHeight(visual);

        // For scorecards: distribute evenly accounting for gaps
        const flexStyle = isAllScorecards
          ? {
              flex: `1 1 0`,
              minWidth: 0,
              minHeight: minH,
            }
          : {
              flex: `1 1 ${(w / totalW) * 100}%`,
              minWidth: 300,
              minHeight: minH,
              maxWidth: "100%" as const,
            };

        return (
          <div
            key={visual.id}
            className="overflow-hidden rounded-lg"
            style={flexStyle}
          >
            <ConfigurableVisualCard
              visual={visual}
              onUpdateVisual={onUpdateVisual}
              onRemoveVisual={onRemoveVisual}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Mobile: stacked ──

function MobileInsightsGrid({ visuals, onUpdateVisual, onRemoveVisual }: {
  visuals: InsightsVisual[];
  onUpdateVisual?: (id: string, updates: any) => Promise<void>;
  onRemoveVisual?: (id: string) => Promise<void>;
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
          <ConfigurableVisualCard visual={visual} onUpdateVisual={onUpdateVisual} onRemoveVisual={onRemoveVisual} />
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

export function InsightsGrid({ visuals, onLayoutChange, readOnly = false, onUpdateVisual, onRemoveVisual }: InsightsGridProps) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);

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
  }, [isMobile]);

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
      // Exit editing mode after drag/resize
      setTimeout(() => setIsEditing(false), 100);
    },
    [onLayoutChange]
  );

  const handleDragStart = useCallback(() => setIsEditing(true), []);
  const handleResizeStart = useCallback(() => setIsEditing(true), []);

  if (visuals.length === 0) return null;

  if (isMobile) {
    return (
      <MobileInsightsGrid
        visuals={visuals}
        onUpdateVisual={onUpdateVisual}
        onRemoveVisual={onRemoveVisual}
      />
    );
  }

  const containerWidth = width ?? 1200;

  // Always show responsive CSS grid, with an invisible react-grid-layout
  // overlay that activates only during drag/resize
  return (
    <div ref={containerRef} className="insights-grid pointer-events-auto relative">
      {/* Responsive CSS grid — always visible when not dragging */}
      {!isEditing && (
        <ResponsiveInsightsGrid
          visuals={visuals}
          onUpdateVisual={onUpdateVisual}
          onRemoveVisual={onRemoveVisual}
          containerWidth={containerWidth}
        />
      )}

      {/* React-grid-layout — hidden but interactive for drag handles,
          becomes visible during active drag/resize */}
      <div className={isEditing ? "block" : "absolute inset-0 opacity-0 pointer-events-none"}
        style={!isEditing ? { height: 0, overflow: "hidden" } : undefined}
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
              <ConfigurableVisualCard visual={visual} onUpdateVisual={onUpdateVisual} onRemoveVisual={onRemoveVisual} />
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
          width: 20px;
          height: 20px;
        }
        .insights-grid .react-grid-item > .react-resizable-handle::after {
          content: "";
          position: absolute;
          right: 3px;
          bottom: 3px;
          width: 8px;
          height: 8px;
          border-right: 2px solid rgba(0, 0, 0, 0.3);
          border-bottom: 2px solid rgba(0, 0, 0, 0.3);
        }
        .insights-grid .react-grid-placeholder {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
        }
      `}</style>
    </div>
  );
}
