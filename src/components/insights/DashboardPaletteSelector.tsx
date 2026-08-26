import { useState } from "react";
import { Palette, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import {
  COLOR_PALETTES,
  COLOR_PALETTE_OPTIONS,
  type ColorPalette,
} from "./visual-builder/types";
import type { InsightsVisual } from "@/hooks/useInsightsDashboards";

interface DashboardPaletteSelectorProps {
  visuals: InsightsVisual[];
  onUpdateVisual: (id: string, updates: Partial<InsightsVisual>) => Promise<void>;
}

export function DashboardPaletteSelector({
  visuals,
  onUpdateVisual,
}: DashboardPaletteSelectorProps) {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState<ColorPalette | null>(null);

  // Current palette = the one shared by all visuals (if any)
  const palettes = new Set(
    visuals.map(
      (v) =>
        (((v.config as any)?.appearance?.colorPalette ??
          (v.config as any)?.colorPalette) as string) || "ryka"
    )
  );
  const currentPalette = palettes.size === 1 ? ([...palettes][0] as ColorPalette) : null;

  const applyPalette = async (palette: ColorPalette) => {
    if (!visuals.length) return;
    setApplying(palette);
    try {
      for (const v of visuals) {
        const cfg = (v.config as any) || {};
        if (cfg?.appearance?.colorPalette === palette) continue;
        await onUpdateVisual(v.id, {
          config: {
            ...cfg,
            colorPalette: palette,
            appearance: { ...(cfg.appearance || {}), colorPalette: palette, paletteLocked: true },
          },
        });
      }
      toast.success("Paleta aplicada a todos os visuais");
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível aplicar a paleta");
    } finally {
      setApplying(null);
    }
  };


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 md:h-9 md:w-auto md:px-3"
          disabled={!visuals.length}
        >
          <Palette className="h-4 w-4" />
          <span className="hidden md:inline ml-2">Paleta</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">Paleta do painel</p>
          <p className="text-xs text-muted-foreground">
            Aplica a todos os {visuals.length} visuais desta página.
          </p>
        </div>
        <div className="max-h-80 overflow-auto mt-1 space-y-0.5">
          {COLOR_PALETTE_OPTIONS.map((opt) => {
            const colors = COLOR_PALETTES[opt.value] || [];
            const isCurrent = currentPalette === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => applyPalette(opt.value)}
                disabled={applying !== null}
                className="w-full flex items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent transition-colors disabled:opacity-60"
              >
                <div className="flex gap-1 shrink-0">
                  {colors.slice(0, 5).map((c, i) => (
                    <span
                      key={i}
                      className="h-4 w-4 rounded-sm border border-border/50"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <span className="text-sm flex-1 truncate">{opt.label}</span>
                {applying === opt.value ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : isCurrent ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
