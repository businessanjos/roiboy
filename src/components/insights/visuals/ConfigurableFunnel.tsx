import { forwardRef } from "react";
import { AppearanceConfig, COLOR_PALETTES, DEFAULT_APPEARANCE, FONT_SCALE_MULTIPLIERS } from "../visual-builder/types";
import { formatValueCompact } from "@/lib/formula-evaluator";
import { useTvMode } from "../TvModeContext";
import { useChartSize } from "./useChartSize";
import { extendPalette, readableTextOn } from "@/lib/insights/paletteColors";

interface AggregatedDataPoint {
  name: string;
  value: number;
  count?: number;
  color?: string;
}

interface ConfigurableFunnelProps {
  data: AggregatedDataPoint[];
  formatting: {
    type: 'currency' | 'percentage' | 'decimal';
    decimals: number;
  };
  appearance?: AppearanceConfig;
}

export const ConfigurableFunnel = forwardRef<HTMLDivElement, ConfigurableFunnelProps>(function ConfigurableFunnel(
  { data, formatting, appearance },
  ref
) {
  const config = appearance || DEFAULT_APPEARANCE;
  const colors = extendPalette(COLOR_PALETTES[config.colorPalette] || COLOR_PALETTES.professional, 20);
  const tv = useTvMode();
  const m = FONT_SCALE_MULTIPLIERS[config.fontScale || 'normal'] * tv.scale;
  const { ref: sizeRef, height } = useChartSize();

  // Altura das barras cabe sempre no card: nada de etapa cortada no rodapé.
  const steps = Math.max(data?.length || 1, 1);
  const available = Math.max(height - 16, 0);
  const barHeight = available
    ? Math.max(22, Math.min(Math.round(48 * m), Math.floor(available / steps) - 6))
    : Math.round(40 * m);

  if (!data || data.length === 0) {
    return (
      <div ref={ref} className="flex items-center justify-center h-full text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  const isGanhos = (name: string) => name === 'Ganhos';
  const isPerdidos = (name: string) => name === 'Perdidos';
  const regularData = data.filter((d) => !isGanhos(d.name) && !isPerdidos(d.name));
  const ganhosItem = data.find((d) => isGanhos(d.name));
  const perdidosItem = data.find((d) => isPerdidos(d.name));


  const cumulativeCounts: number[] = new Array(regularData.length);
  for (let i = regularData.length - 1; i >= 0; i--) {
    const below = i < regularData.length - 1 ? cumulativeCounts[i + 1] : (ganhosItem?.value || 0);
    cumulativeCounts[i] = regularData[i].value + below;
  }

  const maxValue = cumulativeCounts[0] || 1;

  return (
    <div ref={ref} className="h-full w-full">
      <div ref={sizeRef} className="flex flex-col items-center justify-center gap-1.5 h-full w-full px-4 py-2 overflow-hidden">
      {regularData.map((item, index) => {
        const cumValue = cumulativeCounts[index];
        const widthPct = Math.max((Math.sqrt(cumValue) / Math.sqrt(maxValue)) * 100, 15);
        const prevCum = index > 0 ? cumulativeCounts[index - 1] : cumValue;
        const conversionPct = index > 0 && prevCum > 0
          ? Math.round((cumValue / prevCum) * 100)
          : null;
        const bgColor = (!config.paletteLocked && item.color) || colors[index % colors.length];

        const barText = readableTextOn(bgColor);
        const overallPct = Math.round((cumValue / maxValue) * 100);
        const stagePct = conversionPct !== null ? conversionPct : 100;

        return (
          <div key={item.name} className="w-full flex justify-center items-center">
            <div className="flex items-center gap-1.5" style={{ width: `${widthPct}%`, minWidth: `${Math.round(160 * m)}px` }}>
              <span className="text-xs font-semibold text-muted-foreground text-right shrink-0" style={{ fontSize: Math.round(11 * m), width: Math.round(40 * m) }}>
                {stagePct}%
              </span>
              <div
                className="rounded-md flex items-center justify-between px-4 transition-all flex-1 min-w-0 overflow-hidden"
                style={{ backgroundColor: bgColor, height: barHeight }}
              >
                <span className="text-sm font-medium truncate whitespace-nowrap" style={{ fontSize: Math.round(13 * m), color: barText }}>
                  {item.name}
                </span>
                <span className="text-sm font-bold ml-2 shrink-0" style={{ fontSize: Math.round(13 * m), color: barText }}>
                  {formatValueCompact(cumValue, formatting.type)}
                </span>
              </div>
              <span className="text-xs font-semibold text-muted-foreground shrink-0" style={{ fontSize: Math.round(11 * m), width: Math.round(40 * m) }}>
                {overallPct}%
              </span>
            </div>
          </div>
        );
      })}
      {ganhosItem && (() => {
        const lastCum = cumulativeCounts.length > 0 ? cumulativeCounts[cumulativeCounts.length - 1] : 1;
        const ganhosStagePct = lastCum > 0 ? Math.round((ganhosItem.value / lastCum) * 100) : 0;
        const ganhosOverallPct = Math.round((ganhosItem.value / maxValue) * 100);
        const ganhosWidthPct = Math.max((Math.sqrt(ganhosItem.value) / Math.sqrt(maxValue)) * 100, 15);
        return (
          <div className="w-full flex justify-center items-center">
            <div className="flex items-center gap-1.5" style={{ width: `${ganhosWidthPct}%`, minWidth: `${Math.round(160 * m)}px` }}>
              <span className="text-xs font-semibold text-muted-foreground text-right shrink-0" style={{ fontSize: Math.round(11 * m), width: Math.round(40 * m) }}>
                {ganhosStagePct}%
              </span>
              <div
                className="rounded-md flex items-center justify-between px-4 transition-all ring-2 ring-emerald-400 ring-offset-2 flex-1 min-w-0 overflow-hidden"
                style={{ backgroundColor: '#10b981', height: barHeight }}
              >
                <span className="text-sm font-medium text-white flex items-center gap-1.5 truncate whitespace-nowrap" style={{ fontSize: Math.round(13 * m) }}>
                  🏆 {ganhosItem.name}
                </span>
                <span className="text-sm font-bold text-white ml-2 shrink-0" style={{ fontSize: Math.round(13 * m) }}>
                  {formatValueCompact(ganhosItem.value, formatting.type)}
                </span>
              </div>
              <span className="text-xs font-semibold text-muted-foreground shrink-0" style={{ fontSize: Math.round(11 * m), width: Math.round(40 * m) }}>
                {ganhosOverallPct}%
              </span>
            </div>
          </div>
        );
      })()}
      {perdidosItem && (() => {
        const perdidosOverallPct = maxValue > 0 ? Math.round((perdidosItem.value / maxValue) * 100) : 0;
        const perdidosWidthPct = Math.max((Math.sqrt(perdidosItem.value) / Math.sqrt(maxValue)) * 100, 15);
        return (
          <div className="w-full flex justify-center items-center">
            <div className="flex items-center gap-1.5" style={{ width: `${perdidosWidthPct}%`, minWidth: `${Math.round(160 * m)}px` }}>
              <span className="shrink-0" style={{ width: Math.round(40 * m) }} />
              <div
                className="rounded-md flex items-center justify-between px-4 transition-all ring-2 ring-destructive/60 ring-offset-2 flex-1 min-w-0 overflow-hidden"
                style={{ backgroundColor: '#ef4444', height: barHeight }}
              >
                <span className="text-sm font-medium text-white flex items-center gap-1.5 truncate whitespace-nowrap" style={{ fontSize: Math.round(13 * m) }}>
                  ✖ {perdidosItem.name}
                </span>
                <span className="text-sm font-bold text-white ml-2 shrink-0" style={{ fontSize: Math.round(13 * m) }}>
                  {formatValueCompact(perdidosItem.value, formatting.type)}
                </span>
              </div>
              <span className="text-xs font-semibold text-muted-foreground shrink-0" style={{ fontSize: Math.round(11 * m), width: Math.round(40 * m) }}>
                {perdidosOverallPct}%
              </span>
            </div>
          </div>
        );
      })()}
      </div>

    </div>
  );
});

ConfigurableFunnel.displayName = "ConfigurableFunnel";
