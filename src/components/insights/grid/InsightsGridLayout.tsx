import { useMemo, useRef, useEffect, useState } from "react";
import GridLayout from "react-grid-layout";
import { useInsightsPanels, LayoutItem } from "@/hooks/useInsightsPanels";
import { WidgetCard } from "../widgets/WidgetCard";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

interface LayoutType {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export function InsightsGridLayout() {
  const { activePanel, updateLayout } = useInsightsPanels();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);

  const widgets = useMemo(() => activePanel?.widgets || [], [activePanel]);
  const layout = useMemo(() => activePanel?.layout || [], [activePanel]);

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

  const handleLayoutChange = (newLayout: LayoutType[]) => {
    const mappedLayout: LayoutItem[] = newLayout.map((item) => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: item.minW,
      minH: item.minH,
    }));
    updateLayout(mappedLayout);
  };

  if (widgets.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef}>
      <GridLayout
        className="layout"
        layout={layout.map((l) => ({
          i: l.i,
          x: l.x,
          y: l.y,
          w: l.w,
          h: l.h,
          minW: l.minW || 2,
          minH: l.minH || 2,
        }))}
        width={width}
        onLayoutChange={handleLayoutChange}
        gridConfig={{
          cols: 12,
          rowHeight: 80,
          margin: [16, 16] as [number, number],
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
        {widgets.map((widget) => (
          <div key={widget.id} className="h-full">
            <WidgetCard widget={widget} />
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
