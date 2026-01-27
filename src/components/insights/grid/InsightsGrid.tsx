import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import GridLayout from "react-grid-layout";
import { InsightsVisual } from "@/hooks/useInsightsDashboards";
import { ConfigurableVisualCard } from "../visuals/ConfigurableVisualCard";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

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

const ROW_HEIGHT = 100;
const COLS = 12;
const MARGIN: [number, number] = [16, 16];

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

  // Convert visuals to layout items
  const layout = useMemo<LayoutItem[]>(() => {
    return visuals.map((visual, index) => {
      const existingLayout = visual.layout;
      
      if (existingLayout) {
        return {
          i: visual.id,
          x: existingLayout.x,
          y: existingLayout.y,
          w: existingLayout.w,
          h: existingLayout.h,
          minW: 2,
          minH: 2,
        };
      }

      // Default layout for new visuals (stack vertically)
      return {
        i: visual.id,
        x: (index % 2) * 6,
        y: Math.floor(index / 2) * 5,
        w: 6,
        h: 5,
        minW: 2,
        minH: 2,
      };
    });
  }, [visuals]);

  // Handle layout changes with debounce
  const handleLayoutChange = useCallback(
    (newLayout: LayoutItem[]) => {
      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce by 500ms to avoid excessive saves
      debounceRef.current = setTimeout(() => {
        const layoutUpdates = newLayout.map((item) => ({
          id: item.i,
          layout: {
            i: item.i,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
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
          margin: MARGIN,
          containerPadding: [0, 0] as [number, number],
        }}
        dragConfig={{
          enabled: true,
          handle: ".widget-drag-handle",
        }}
        resizeConfig={{
          enabled: true,
        }}
      >
        {visuals.map((visual) => (
          <div key={visual.id} className="h-full">
            <ConfigurableVisualCard visual={visual} />
          </div>
        ))}
      </GridLayout>

      <style>{`
        .insights-grid .react-grid-item {
          transition: all 200ms ease;
          transition-property: left, top, width, height;
        }
        .insights-grid .react-grid-item.cssTransforms {
          transition-property: transform, width, height;
        }
        .insights-grid .react-grid-item.resizing {
          z-index: 1;
          will-change: width, height;
        }
        .insights-grid .react-grid-item.react-draggable-dragging {
          transition: none;
          z-index: 3;
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
          background: hsl(var(--primary) / 0.2);
          opacity: 0.5;
          transition-duration: 100ms;
          z-index: 2;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          -o-user-select: none;
          user-select: none;
          border-radius: var(--radius);
        }
      `}</style>
    </div>
  );
}
