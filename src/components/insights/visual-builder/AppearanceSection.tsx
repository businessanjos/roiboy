import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DateDisplayFormat,
  ColorPalette,
  DATE_DISPLAY_FORMAT_OPTIONS,
  COLOR_PALETTES,
  COLOR_PALETTE_OPTIONS,
} from "./types";

interface AppearanceSectionProps {
  showDataLabels: boolean;
  onShowDataLabelsChange: (value: boolean) => void;
  dateDisplayFormat: DateDisplayFormat;
  onDateDisplayFormatChange: (value: DateDisplayFormat) => void;
  colorPalette: ColorPalette;
  onColorPaletteChange: (value: ColorPalette) => void;
  fillEmptyDates: boolean;
  onFillEmptyDatesChange: (value: boolean) => void;
  isDimensionDate: boolean;
}

export function AppearanceSection({
  showDataLabels,
  onShowDataLabelsChange,
  dateDisplayFormat,
  onDateDisplayFormatChange,
  colorPalette,
  onColorPaletteChange,
  fillEmptyDates,
  onFillEmptyDatesChange,
  isDimensionDate,
}: AppearanceSectionProps) {
  return (
    <div className="space-y-4">
      <Label className="text-base font-medium">Personalização Visual</Label>

      {/* Show Data Labels */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="showDataLabels" className="text-sm font-normal cursor-pointer">
            Exibir rótulos de dados
          </Label>
          <p className="text-xs text-muted-foreground">
            Mostrar o valor em cima das barras/linhas
          </p>
        </div>
        <Switch
          id="showDataLabels"
          checked={showDataLabels}
          onCheckedChange={onShowDataLabelsChange}
        />
      </div>

      {/* Date Display Format - Only show when dimension is date */}
      {isDimensionDate && (
        <div className="space-y-2">
          <Label className="text-sm font-normal">Formato de Data</Label>
          <Select value={dateDisplayFormat} onValueChange={(v) => onDateDisplayFormatChange(v as DateDisplayFormat)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_DISPLAY_FORMAT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label} <span className="text-muted-foreground ml-1">({option.example})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Color Palette */}
      <div className="space-y-2">
        <Label className="text-sm font-normal">Paleta de Cores</Label>
        <div className="flex gap-2 flex-wrap">
          {COLOR_PALETTE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onColorPaletteChange(option.value)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all",
                colorPalette === option.value
                  ? "border-primary bg-primary/5"
                  : "border-transparent hover:border-muted-foreground/30"
              )}
            >
              <div className="flex gap-0.5">
                {COLOR_PALETTES[option.value].slice(0, 5).map((color, idx) => (
                  <div
                    key={idx}
                    className="w-4 h-4 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Fill Empty Dates - Only show when dimension is date */}
      {isDimensionDate && (
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="fillEmptyDates" className="text-sm font-normal cursor-pointer">
              Mostrar todos os meses
            </Label>
            <p className="text-xs text-muted-foreground">
              Inclui meses sem dados com valor zero
            </p>
          </div>
          <Switch
            id="fillEmptyDates"
            checked={fillEmptyDates}
            onCheckedChange={onFillEmptyDatesChange}
          />
        </div>
      )}
    </div>
  );
}
