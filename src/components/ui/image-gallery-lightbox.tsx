import { useState, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface GalleryImage {
  url: string;
  alt?: string;
}

interface ImageGalleryLightboxProps {
  images: GalleryImage[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

export function ImageGalleryLightbox({ 
  images, 
  initialIndex = 0, 
  open, 
  onClose 
}: ImageGalleryLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setScale(1);
      setRotation(0);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, initialIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goToPrev();
      if (e.key === "ArrowRight") goToNext();
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(s + 0.25, 3));
      if (e.key === "-") setScale((s) => Math.max(s - 0.25, 0.5));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, images.length]);

  if (!open || images.length === 0) return null;

  const currentImage = images[currentIndex];

  const goToPrev = () => {
    setScale(1);
    setRotation(0);
    setCurrentIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  };

  const goToNext = () => {
    setScale(1);
    setRotation(0);
    setCurrentIndex((i) => (i < images.length - 1 ? i + 1 : 0));
  };

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/* Navigation - Previous */}
      {images.length > 1 && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full z-50"
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
      )}

      {/* Navigation - Next */}
      {images.length > 1 && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full z-50"
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      )}

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
          src={currentImage?.url}
          alt={currentImage?.alt || "Imagem"}
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

      {/* Position Indicator */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-secondary/90 px-4 py-2 rounded-full">
          <p className="text-sm font-medium">
            {currentIndex + 1} / {images.length}
          </p>
        </div>
      )}

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 bg-secondary/80 p-2 rounded-lg">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(idx);
                setScale(1);
                setRotation(0);
              }}
              className={cn(
                "w-12 h-12 rounded-md overflow-hidden border-2 transition-all",
                idx === currentIndex
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-transparent opacity-60 hover:opacity-100"
              )}
            >
              <img
                src={img.url}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
