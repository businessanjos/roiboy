import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import GridLayout from "react-grid-layout";
import { getCompactor } from "react-grid-layout/core";
import { InsightsVisual } from "@/hooks/useInsightsDashboards";
import { ConfigurableVisualCard } from "../visuals/ConfigurableVisualCard";
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
}

const ROW_HEIGHT = 20;
const COLS = 48;

function visualToLayoutItem(visual: InsightsVisual, index: number): LayoutItem {
  const existingLayout = visual.layout;

  if (existingLayout) {
    const isOldScale = existingLayout.x <= 12 && existingLayout.w <= 12;

    if (isOldScale) {
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
    x: (index % 2) * 26,
    y: Math.floor(index / 2) * 27,
    w: 24,
    h: 25,
    minW: 8,
    minH: 10,
  };
}

export function InsightsGrid({ visuals, onLayoutChange, readOnly = false }: InsightsGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);

  // Local layout state — only syncs from props when visuals are added/removed
  const [localLayout, setLocalLayout] = useState<LayoutItem[]>(() =>
    visuals.map((v, i) => visualToLayoutItem(v, i))
  );

  // Track visual IDs to detect additions/removals (not layout changes)
  const prevVisualIdsRef = useRef<string>(visuals.map(v => v.id).sort().join(","));

  useEffect(() => {
    const currentIds = visuals.map(v => v.id).sort().join(",");
    if (currentIds !== prevVisualIdsRef.current) {
      // Visuals were added or removed — rebuild layout, keeping local positions for existing items
      prevVisualIdsRef.current = currentIds;
      setLocalLayout(prev => {
        const existingMap = new Map(prev.map(item => [item.i, item]));
        return visuals.map((v, i) => existingMap.get(v.id) || visualToLayoutItem(v, i));
      });
    }
    // Intentionally NOT syncing when only layout data changes from props
  }, [visuals]);

  // Update container width on mount and resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();

    if (readOnly) {
      document.addEventListener("fullscreenchange", updateWidth);
      return () => document.removeEventListener("fullscreenchange", updateWidth);
    } else {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }
  }, [readOnly]);

  // Handle user drag/resize stop — update local state AND persist
  const handleUserLayoutChange = useCallback(
    (newLayout: LayoutItem[]) => {
      // Update local state immediately (prevents snap-back)
      setLocalLayout(newLayout.map(item => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: 8,
        minH: 10,
      })));

      // Persist to DB
      const layoutUpdates = newLayout.map((item) => ({
        id: item.i,
        layout: { i: item.i, x: item.x, y: item.y, w: item.w, h: item.h },
      }));
      onLayoutChange(layoutUpdates);
    },
    [onLayoutChange]
  );

  const handleDragStop = useCallback(
    (layout: LayoutItem[]) => {
      handleUserLayoutChange(layout);
    },
    [handleUserLayoutChange]
  );

  const handleResizeStop = useCallback(
    (layout: LayoutItem[]) => {
      handleUserLayoutChange(layout);
    },
    [handleUserLayoutChange]
  );

  if (visuals.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="insights-grid">
      <GridLayout
        className="layout"
        layout={localLayout}
        width={width}
        onDragStop={handleDragStop}
        onResizeStop={handleResizeStop}
        gridConfig={{
          cols: COLS,
          rowHeight: ROW_HEIGHT,
          margin: [0, 0] as [number, number],
          containerPadding: [0, 0] as [number, number],
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
          <div key={visual.id} className="h-full">
            <ConfigurableVisualCard visual={visual} />
          </div>
        ))}
      </GridLayout>

      <style>{`
        .insights-grid .react-grid-item {
          transition: none;
        }
        .insights-grid .react-grid-item:not(.react-draggable-dragging) {
          transition: width 200ms ease, height 200ms ease;
        }
        .insights-grid .react-grid-item.resizing {
          z-index: 1;
          will-change: width, height;
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
