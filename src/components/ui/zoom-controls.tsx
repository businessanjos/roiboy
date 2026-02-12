import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface ZoomControlsProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function ZoomControls({
  zoom,
  onZoomChange,
  min = 50,
  max = 200,
  step = 10,
}: ZoomControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onZoomChange(Math.max(min, zoom - step))}
        disabled={zoom <= min}
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Slider
        value={[zoom]}
        onValueChange={([v]) => onZoomChange(v)}
        min={min}
        max={max}
        step={step}
        className="w-24"
      />
      <span className="text-xs font-medium text-muted-foreground w-10 text-center tabular-nums">
        {zoom}%
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onZoomChange(Math.min(max, zoom + step))}
        disabled={zoom >= max}
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
    </div>
  );
}
