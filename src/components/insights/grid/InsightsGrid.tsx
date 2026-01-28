import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import GridLayout from "react-grid-layout";
import { getCompactor } from "react-grid-layout/core";
import { InsightsVisual } from "@/hooks/useInsightsDashboards";
import { ConfigurableVisualCard } from "../visuals/ConfigurableVisualCard";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

// Free position compactor: no compaction, prevents collision, items don't push others
const freePositionCompactor = getCompactor(null, false, true);

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
}

const ROW_HEIGHT = 20;  // Ultra-granular: 5x mais fino para movimento suave
const COLS = 48;        // Ultra-granular: 4x mais colunas para posicionamento preciso
const MARGIN: [number, number] = [0, 0];

export function InsightsGrid({ visuals, onLayoutChange }: InsightsGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Update container width on mount and resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Convert visuals to layout items (scale up from DB format to ultra-granular grid)
  const layout = useMemo<LayoutItem[]>(() => {
    return visuals.map((visual, index) => {
      const existingLayout = visual.layout;
      
      if (existingLayout) {
        // Scale up: DB uses 12 cols/100px rows, grid uses 48 cols/20px rows
        return {
          i: visual.id,
          x: existingLayout.x * 4,   // 12→48 cols
          y: existingLayout.y * 5,   // 100px→20px rows
          w: existingLayout.w * 4,
          h: existingLayout.h * 5,
          minW: 8,   // ~2 colunas antigas
          minH: 10,  // ~200px
        };
      }

      // Default layout for new visuals (in granular scale)
      return {
        i: visual.id,
        x: (index % 2) * 24,         // 24 = metade do grid (48/2)
        y: Math.floor(index / 2) * 25, // 25 rows = ~500px
        w: 24,                        // metade da largura
        h: 25,                        // ~500px de altura
        minW: 8,
        minH: 10,
      };
    });
  }, [visuals]);

  // Handle layout changes with debounce (scale down to DB format)
  const handleLayoutChange = useCallback(
    (newLayout: LayoutItem[]) => {
      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce by 500ms to avoid excessive saves
      debounceRef.current = setTimeout(() => {
        // Scale down: grid uses 48 cols/20px rows, DB uses 12 cols/100px rows
        const layoutUpdates = newLayout.map((item) => ({
          id: item.i,
          layout: {
            i: item.i,
            x: Math.round(item.x / 4),  // 48→12 cols
            y: Math.round(item.y / 5),  // 20px→100px rows
            w: Math.round(item.w / 4),
            h: Math.round(item.h / 5),
          },
        }));

        onLayoutChange(layoutUpdates);
      }, 500);
    },
    [onLayoutChange]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  if (visuals.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="insights-grid">
      <GridLayout
        className="layout"
        layout={layout}
        width={width}
        onLayoutChange={handleLayoutChange}
        gridConfig={{
          cols: COLS,
          rowHeight: ROW_HEIGHT,
          margin: [0, 0] as [number, number],
          containerPadding: [0, 0] as [number, number],
        }}
        dragConfig={{
          enabled: true,
          handle: ".widget-drag-handle",
        }}
        resizeConfig={{
          enabled: true,
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
