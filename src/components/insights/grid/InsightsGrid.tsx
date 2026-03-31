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

// Minimum heights per chart type for mobile stacked view
function getMobileMinHeight(visual: InsightsVisual): string {
  const chartType = visual.chart_type || 'bar';
  switch (chartType) {
    case 'scorecard':
    case 'kpi':
      return 'min-h-[120px]';
    case 'table':
    case 'ranking':
      return 'min-h-[280px]';
    case 'map':
      return 'min-h-[300px]';
    case 'pie':
    case 'donut':
      return 'min-h-[280px]';
    default:
      return 'min-h-[260px]';
  }
}

function visualToLayoutItem(visual: InsightsVisual, index: number): LayoutItem {
  const existingLayout = visual.layout;

  if (existingLayout) {
    // Explicit scale marker means it was saved in 48-col grid — use as-is
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

    // Legacy: no scale marker — apply 12→48 migration
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

// Mobile: simple stacked list — no grid, no drag, full width
function MobileInsightsGrid({ visuals, onUpdateVisual, onRemoveVisual }: {
  visuals: InsightsVisual[];
  onUpdateVisual?: (id: string, updates: any) => Promise<void>;
  onRemoveVisual?: (id: string) => Promise<void>;
}) {
  // Sort visuals by their saved layout y position so order matches desktop
  const sorted = useMemo(() => {
    return [...visuals].sort((a, b) => {
      const ay = a.layout?.y ?? 0;
      const by = b.layout?.y ?? 0;
      if (ay !== by) return ay - by;
      const ax = a.layout?.x ?? 0;
      const bx = b.layout?.x ?? 0;
      return ax - bx;
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

export function InsightsGrid({ visuals, onLayoutChange, readOnly = false, onUpdateVisual, onRemoveVisual }: InsightsGridProps) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);

  // Local layout state — only syncs from props when visuals are added/removed
  const [localLayout, setLocalLayout] = useState<LayoutItem[]>(() =>
    visuals.map((v, i) => visualToLayoutItem(v, i))
  );

  // Track visual IDs to detect additions/removals (not layout changes)
  const prevVisualIdsRef = useRef<string>(visuals.map(v => v.id).sort().join(","));

  // Guard: skip the automatic onLayoutChange fired on mount
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

  // Update container width on mount and any size change
  useEffect(() => {
    if (!containerRef.current || isMobile) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
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
    },
    [onLayoutChange]
  );

  if (visuals.length === 0) {
    return null;
  }

  // Mobile: stacked single-column layout
  if (isMobile) {
    return (
      <MobileInsightsGrid
        visuals={visuals}
        onUpdateVisual={onUpdateVisual}
        onRemoveVisual={onRemoveVisual}
      />
    );
  }

  return (
    <div ref={containerRef} className="insights-grid pointer-events-auto">
      <GridLayout
        className="layout"
        layout={localLayout}
        width={width}
        onLayoutChange={handleContinuousLayoutChange}
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

      <style>{`
        .insights-grid .react-grid-item {
          transition: none;
        }
        .insights-grid .react-grid-item:not(.react-draggable-dragging):not(.resizing) {
          transition: transform 200ms ease, width 200ms ease, height 200ms ease;
        }
        .insights-grid .react-grid-item.resizing {
          z-index: 1;
          will-change: width, height;
          transition: none;
        }
        .insights-grid .react-grid-item.react-draggable-dragging {
          transition: none;
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
