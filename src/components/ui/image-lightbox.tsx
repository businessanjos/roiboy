import { useState, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface ImageLightboxProps {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, open, onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (open) {
      setScale(1);
      setRotation(0);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(s + 0.25, 3));
      if (e.key === "-") setScale((s) => Math.max(s - 0.25, 0.5));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            handleZoomOut();
          }}
        >
          <ZoomOut className="h-5 w-5" />
        </Button>
        <span className="text-sm font-medium bg-secondary px-3 py-2 rounded-full min-w-[60px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            handleZoomIn();
          }}
        >
          <ZoomIn className="h-5 w-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            handleRotate();
          }}
        >
          <RotateCw className="h-5 w-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Image Container */}
      <div
        className="relative max-w-[90vw] max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt || "Imagem"}
          className={cn(
            "max-w-none transition-transform duration-200 cursor-grab active:cursor-grabbing rounded-lg shadow-2xl"
          )}
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transformOrigin: "center center",
          }}
          draggable={false}
        />
      </div>

      {/* Caption */}
      {alt && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-secondary/90 px-4 py-2 rounded-full">
          <p className="text-sm font-medium">{alt}</p>
        </div>
      )}
    </div>
  );
}
