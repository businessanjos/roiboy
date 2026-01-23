import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Trash2 } from "lucide-react";
import { AppearanceSection } from "../visual-builder/AppearanceSection";
import { VisualConfig, DateDisplayFormat, ColorPalette, DEFAULT_APPEARANCE } from "../visual-builder/types";
import { useInsightsDashboards } from "@/hooks/useInsightsDashboards";
import { toast } from "sonner";

interface InsightsVisual {
  id: string;
  title: string | null;
  chart_type: string | null;
  config: unknown;
}

interface VisualQuickSettingsProps {
  visual: InsightsVisual;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VisualQuickSettings({ visual, open, onOpenChange }: VisualQuickSettingsProps) {
  const { updateVisual, removeVisual } = useInsightsDashboards();
  const config = visual.config as VisualConfig | null;

  // Local state for appearance settings
  const [showDataLabels, setShowDataLabels] = useState(
    config?.appearance?.showDataLabels ?? DEFAULT_APPEARANCE.showDataLabels
  );
  const [dateDisplayFormat, setDateDisplayFormat] = useState<DateDisplayFormat>(
    config?.appearance?.dateDisplayFormat ?? DEFAULT_APPEARANCE.dateDisplayFormat
  );
  const [colorPalette, setColorPalette] = useState<ColorPalette>(
    config?.appearance?.colorPalette ?? DEFAULT_APPEARANCE.colorPalette
  );
  const [fillEmptyDates, setFillEmptyDates] = useState(
    config?.appearance?.fillEmptyDates ?? DEFAULT_APPEARANCE.fillEmptyDates
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset state when visual changes or sheet opens
  useEffect(() => {
    if (open) {
      setShowDataLabels(config?.appearance?.showDataLabels ?? DEFAULT_APPEARANCE.showDataLabels);
      setDateDisplayFormat(config?.appearance?.dateDisplayFormat ?? DEFAULT_APPEARANCE.dateDisplayFormat);
      setColorPalette(config?.appearance?.colorPalette ?? DEFAULT_APPEARANCE.colorPalette);
      setFillEmptyDates(config?.appearance?.fillEmptyDates ?? DEFAULT_APPEARANCE.fillEmptyDates);
    }
  }, [open, config]);

  const isDimensionDate = config?.dimension?.type === 'date';

  const handleSave = async () => {
    if (!config) return;

    setIsSaving(true);
    try {
      const newConfig: VisualConfig = {
        ...config,
        appearance: {
          showDataLabels,
          dateDisplayFormat,
          colorPalette,
          fillEmptyDates,
        },
      };

      await updateVisual(visual.id, { config: newConfig });
      toast.success("Ajustes salvos!");
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao salvar ajustes");
      console.error("Error saving visual settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await removeVisual(visual.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting visual:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[340px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Ajustes do Visual</SheetTitle>
          <SheetDescription className="truncate">
            {visual.title || "Visual sem título"}
          </SheetDescription>
        </SheetHeader>

        <div className="py-6">
          <AppearanceSection
            showDataLabels={showDataLabels}
            onShowDataLabelsChange={setShowDataLabels}
            dateDisplayFormat={dateDisplayFormat}
            onDateDisplayFormatChange={setDateDisplayFormat}
            colorPalette={colorPalette}
            onColorPaletteChange={setColorPalette}
            fillEmptyDates={fillEmptyDates}
            onFillEmptyDatesChange={setFillEmptyDates}
            isDimensionDate={isDimensionDate}
          />
        </div>

        <SheetFooter className="flex flex-col gap-4">
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? "Salvando..." : "Salvar Alterações"}
          </Button>
          
          <Separator />
          
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center">Zona de Perigo</p>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="w-full"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isDeleting ? "Excluindo..." : "Excluir Visual"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir Visual?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir "{visual.title || 'Visual sem título'}"? 
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
