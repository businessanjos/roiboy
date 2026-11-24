import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
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
  lostValue?: number;
  lostCount?: number;
}

interface ConfigurableFunnelProps {
  data: AggregatedDataPoint[];
  formatting: {
    type: 'currency' | 'percentage' | 'decimal';
    decimals: number;
  };
  appearance?: AppearanceConfig;
  onDrilldown?: (groupName?: string, status?: 'won' | 'lost' | 'open') => void;
}

export const ConfigurableFunnel = forwardRef<HTMLDivElement, ConfigurableFunnelProps>(function ConfigurableFunnel(
  { data, formatting, appearance, onDrilldown },
  ref
) {
  const config = appearance || DEFAULT_APPEARANCE;
  const colors = extendPalette(COLOR_PALETTES[config.colorPalette] || COLOR_PALETTES.ryka, 20);
  const tv = useTvMode();
  const m = FONT_SCALE_MULTIPLIERS[config.fontScale || 'normal'] * tv.scale;
  const { ref: sizeRef, height } = useChartSize();

  // Keep readable rows; dense funnels scroll locally instead of clipping.
  const steps = Math.max(data?.length || 1, 1);
  const available = Math.max(height - 16, 0);
  const barHeight = available
    ? Math.max(Math.round(34 * m), Math.min(Math.round(48 * m), Math.floor(available / steps) - 6))
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
      <div ref={sizeRef} className="h-full w-full overflow-y-auto overflow-x-hidden px-1 py-2">
      <div className="flex min-h-full flex-col items-center justify-center gap-1.5">
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
        const stagePct = conversionPct !== null ? conversionPct : (cumValue > 0 ? 100 : 0);

        return (
          <div key={item.name} className="w-full shrink-0">
            <div className="grid items-center gap-1" style={{ gridTemplateColumns: `${Math.round(34 * m)}px minmax(0, 1fr) ${Math.round(34 * m)}px` }}>
              <span className="text-xs font-semibold text-muted-foreground text-right" style={{ fontSize: Math.round(11 * m) }}>
                {stagePct}%
              </span>
              <div className="flex min-w-0 justify-center">
              <Button
                variant="ghost"
                className="min-w-0 justify-between gap-1 rounded-md px-2 font-medium hover:opacity-90"
                style={{ backgroundColor: bgColor, color: barText, height: barHeight, width: `${widthPct}%`, minWidth: `min(100%, ${Math.round(220 * m)}px)` }}
                title={item.name}
                aria-label={`${item.name}: ${formatValueCompact(cumValue, formatting.type)}`}
                disabled={!onDrilldown}
                onClick={() => onDrilldown?.(item.name, 'open')}
              >
                <span className="min-w-0 whitespace-normal text-left leading-tight" style={{ fontSize: Math.round(13 * m) }}>
                  {item.name}
                </span>
                <span className="shrink-0 font-bold" style={{ fontSize: Math.round(13 * m) }}>
                  {formatValueCompact(cumValue, formatting.type)}
                </span>
              </Button>
              </div>
              <span className="text-xs font-semibold text-muted-foreground" style={{ fontSize: Math.round(11 * m) }}>
                {overallPct}%
              </span>
              {typeof item.lostValue === 'number' && item.lostValue > 0 && (
                <Button
                  variant="ghost"
                  title={`Perdidos nesta etapa: ${item.lostValue}`}
                  onClick={() => onDrilldown?.(item.name, 'lost')}
                  disabled={!onDrilldown}
                  className="col-start-2 h-auto justify-self-end rounded-md bg-destructive/15 text-destructive font-semibold px-2 py-0.5 hover:bg-destructive/25"
                  style={{ fontSize: Math.round(11 * m) }}
                >
                  ✖ {formatValueCompact(item.lostValue, formatting.type)}
                </Button>
              )}
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
          <div className="w-full shrink-0">
            <div className="grid items-center gap-1" style={{ gridTemplateColumns: `${Math.round(34 * m)}px minmax(0, 1fr) ${Math.round(34 * m)}px` }}>
              <span className="text-xs font-semibold text-muted-foreground text-right" style={{ fontSize: Math.round(11 * m) }}>
                {ganhosStagePct}%
              </span>
              <div className="flex min-w-0 justify-center">
              <Button
                variant="ghost"
                className="min-w-0 justify-between gap-1 rounded-md bg-success text-success-foreground px-2 hover:bg-success hover:opacity-90"
                style={{ height: barHeight, width: `${ganhosWidthPct}%`, minWidth: `min(100%, ${Math.round(220 * m)}px)` }}
                disabled={!onDrilldown}
                aria-label={`Ganhos: ${formatValueCompact(ganhosItem.value, formatting.type)}`}
                onClick={() => onDrilldown?.('Ganhos', 'won')}
              >
                <span className="min-w-0 font-medium whitespace-normal text-left leading-tight" style={{ fontSize: Math.round(13 * m) }}>
                  🏆 {ganhosItem.name}
                </span>
                <span className="font-bold shrink-0" style={{ fontSize: Math.round(13 * m) }}>
                  {formatValueCompact(ganhosItem.value, formatting.type)}
                </span>
              </Button>
              </div>
              <span className="text-xs font-semibold text-muted-foreground" style={{ fontSize: Math.round(11 * m) }}>
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
          <div className="w-full shrink-0">
            <div className="grid items-center gap-1" style={{ gridTemplateColumns: `${Math.round(34 * m)}px minmax(0, 1fr) ${Math.round(34 * m)}px` }}>
              <span />
              <div className="flex min-w-0 justify-center">
              <Button
                variant="ghost"
                className="min-w-0 justify-between gap-1 rounded-md bg-destructive text-destructive-foreground px-2 hover:bg-destructive hover:opacity-90"
                style={{ height: barHeight, width: `${perdidosWidthPct}%`, minWidth: `min(100%, ${Math.round(220 * m)}px)` }}
                disabled={!onDrilldown}
                aria-label={`Perdidos: ${formatValueCompact(perdidosItem.value, formatting.type)}`}
                onClick={() => onDrilldown?.('Perdidos', 'lost')}
              >
                <span className="min-w-0 font-medium whitespace-normal text-left leading-tight" style={{ fontSize: Math.round(13 * m) }}>
                  ✖ {perdidosItem.name} (total)
                </span>
                <span className="font-bold shrink-0" style={{ fontSize: Math.round(13 * m) }}>
                  {formatValueCompact(perdidosItem.value, formatting.type)}
                </span>
              </Button>
              </div>
              <span className="text-xs font-semibold text-muted-foreground" style={{ fontSize: Math.round(11 * m) }}>
                {perdidosOverallPct}%
              </span>
            </div>
          </div>
        );
      })()}
      </div>
      </div>

    </div>
  );
});

ConfigurableFunnel.displayName = "ConfigurableFunnel";
