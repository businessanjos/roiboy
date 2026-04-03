import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DateDisplayFormat,
  ColorPalette,
  FontScale,
  DATE_DISPLAY_FORMAT_OPTIONS,
  COLOR_PALETTES,
  COLOR_PALETTE_OPTIONS,
  FONT_SCALE_OPTIONS,
} from "./types";

const VALUE_COLOR_PRESETS = [
  { color: '', label: 'Padrão' },
  { color: '#c8a961', label: 'Dourado' },
  { color: '#2563eb', label: 'Azul' },
  { color: '#16a34a', label: 'Verde' },
  { color: '#dc2626', label: 'Vermelho' },
  { color: '#8b5cf6', label: 'Roxo' },
  { color: '#ea580c', label: 'Laranja' },
];

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
  fontScale?: FontScale;
  onFontScaleChange?: (value: FontScale) => void;
  valueColor?: string;
  onValueColorChange?: (value: string) => void;
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
  fontScale = 'normal',
  onFontScaleChange,
  valueColor = '',
  onValueColorChange,
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

      {/* Font Scale */}
      {onFontScaleChange && (
        <div className="space-y-2">
          <Label className="text-sm font-normal">Tamanho da Fonte</Label>
          <Select value={fontScale} onValueChange={(v) => onFontScaleChange(v as FontScale)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_SCALE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Value Color */}
      {onValueColorChange && (
        <div className="space-y-2">
          <Label className="text-sm font-normal">Cor do Valor</Label>
          <div className="flex gap-2 flex-wrap">
            {VALUE_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.color || 'default'}
                type="button"
                onClick={() => onValueColorChange(preset.color)}
                className={cn(
                  "flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-all",
                  valueColor === preset.color
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:border-muted-foreground/30"
                )}
              >
                <div
                  className={cn("w-6 h-6 rounded-full border", !preset.color && "bg-foreground")}
                  style={preset.color ? { backgroundColor: preset.color } : undefined}
                />
                <span className="text-[10px] text-muted-foreground">{preset.label}</span>
              </button>
            ))}
          </div>
          <Input
            type="text"
            placeholder="#hex personalizado"
            value={valueColor}
            onChange={(e) => onValueColorChange(e.target.value)}
            className="h-8 text-sm mt-1"
          />
        </div>
      )}

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
