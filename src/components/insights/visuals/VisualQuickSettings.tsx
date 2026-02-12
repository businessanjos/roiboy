import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AppearanceSection } from "../visual-builder/AppearanceSection";
import { 
  VisualConfig, 
  DateDisplayFormat, 
  ColorPalette, 
  DisplayScale,
  DEFAULT_APPEARANCE,
  DISPLAY_SCALE_OPTIONS,
  DEFAULT_DISPLAY_SCALE,
} from "../visual-builder/types";
import { useInsightsDashboards } from "@/hooks/useInsightsDashboards";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
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
  const { currentUser } = useCurrentUser();
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
  const [displayScale, setDisplayScale] = useState<DisplayScale>(
    config?.formatting?.displayScale ?? DEFAULT_DISPLAY_SCALE
  );
  const [decimals, setDecimals] = useState<number>(
    config?.formatting?.decimals ?? 2
  );
  const [hiddenUsers, setHiddenUsers] = useState<string[]>(
    config?.hiddenUsers ?? []
  );
  const [accountUsers, setAccountUsers] = useState<{ name: string }[]>([]);
  const [title, setTitle] = useState(visual.title || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Detect types
  const isScorecard = visual.chart_type === 'scorecard';
  const isCallCommercial = visual.chart_type === 'call_commercial';

  // Reset state when visual changes or sheet opens
  useEffect(() => {
    if (open) {
      setTitle(visual.title || "");
      setShowDataLabels(config?.appearance?.showDataLabels ?? DEFAULT_APPEARANCE.showDataLabels);
      setDateDisplayFormat(config?.appearance?.dateDisplayFormat ?? DEFAULT_APPEARANCE.dateDisplayFormat);
      setColorPalette(config?.appearance?.colorPalette ?? DEFAULT_APPEARANCE.colorPalette);
      setFillEmptyDates(config?.appearance?.fillEmptyDates ?? DEFAULT_APPEARANCE.fillEmptyDates);
      setDisplayScale(config?.formatting?.displayScale ?? DEFAULT_DISPLAY_SCALE);
      setDecimals(config?.formatting?.decimals ?? 2);
      setHiddenUsers(config?.hiddenUsers ?? []);
    }
  }, [open, config]);

  // Fetch account users for call_commercial
  useEffect(() => {
    if (!open || !isCallCommercial || !currentUser?.account_id) return;

    const fetchUsers = async () => {
      const { data } = await supabase
        .from('user_sector_access')
        .select('user:users!user_sector_access_user_id_fkey(name)')
        .eq('account_id', currentUser.account_id)
        .eq('sector_id', 'vendas')
        .eq('is_active', true);
      if (data) {
        const users = data
          .map((item: any) => ({ name: item.user?.name }))
          .filter((u: any) => u.name)
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        setAccountUsers(users);
      }
    };
    fetchUsers();
  }, [open, isCallCommercial, currentUser?.account_id]);

  const isDimensionDate = config?.dimension?.type === 'date';

  const handleSave = async () => {
    if (!config) return;

    setIsSaving(true);
    try {
      const newConfig: VisualConfig = {
        ...config,
        formatting: {
          ...config.formatting,
          displayScale,
          decimals,
        },
        appearance: {
          showDataLabels,
          dateDisplayFormat,
          colorPalette,
          fillEmptyDates,
        },
        hiddenUsers: isCallCommercial ? hiddenUsers : config.hiddenUsers,
      };

      await updateVisual(visual.id, { config: newConfig, title: title.trim() || visual.title });
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
      <SheetContent side="right" className="w-[340px] sm:w-[400px] flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>Ajustes do Visual</SheetTitle>
          <SheetDescription className="sr-only">Configurações do visual</SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Título do Visual</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Digite o título do visual"
            />
          </div>
          <Separator />
          {/* Scorecard formatting options */}
          {isScorecard && (
            <div className="space-y-4">
              <Label className="text-base font-medium">Formatação do Valor</Label>
              
              {/* Display Scale */}
              <div className="space-y-2">
                <Label className="text-sm font-normal text-muted-foreground">Escala de Exibição</Label>
                <Select value={displayScale} onValueChange={(value) => setDisplayScale(value as DisplayScale)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISPLAY_SCALE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Decimal Places */}
              <div className="space-y-2">
                <Label className="text-sm font-normal text-muted-foreground">Casas Decimais</Label>
                <Select value={String(decimals)} onValueChange={(v) => setDecimals(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 1 ? 'casa' : 'casas'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />
            </div>
          )}
          {/* Call Commercial: hidden users */}
          {isCallCommercial && accountUsers.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Vendedores Visíveis</Label>
              <div className="space-y-2">
                {accountUsers.map((user) => {
                  const isHidden = hiddenUsers.includes(user.name);
                  return (
                    <div key={user.name} className="flex items-center gap-2">
                      <Checkbox
                        id={`user-${user.name}`}
                        checked={!isHidden}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setHiddenUsers(prev => prev.filter(n => n !== user.name));
                          } else {
                            setHiddenUsers(prev => [...prev, user.name]);
                          }
                        }}
                      />
                      <label htmlFor={`user-${user.name}`} className="text-sm cursor-pointer">
                        {user.name}
                      </label>
                    </div>
                  );
                })}
              </div>
              <Separator />
            </div>
          )}
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

        <div className="flex flex-col gap-4 pt-4 mt-auto border-t flex-shrink-0">
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
