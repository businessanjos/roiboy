import { AppearanceConfig, COLOR_PALETTES, DEFAULT_APPEARANCE, FONT_SCALE_MULTIPLIERS } from "../visual-builder/types";
import { formatValueCompact } from "@/lib/formula-evaluator";

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

export function ConfigurableFunnel({ data, formatting, appearance }: ConfigurableFunnelProps) {
  const config = appearance || DEFAULT_APPEARANCE;
  const colors = COLOR_PALETTES[config.colorPalette] || COLOR_PALETTES.professional;
  const m = FONT_SCALE_MULTIPLIERS[config.fontScale || 'normal'];

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  // Separate "Ganhos" from regular stages
  const isGanhos = (name: string) => name === 'Ganhos';
  const regularData = data.filter(d => !isGanhos(d.name));
  const ganhosItem = data.find(d => isGanhos(d.name));

  // Build cumulative counts from bottom to top (excluding Ganhos)
  const cumulativeCounts: number[] = new Array(regularData.length);
  for (let i = regularData.length - 1; i >= 0; i--) {
    const below = i < regularData.length - 1 ? cumulativeCounts[i + 1] : (ganhosItem?.value || 0);
    cumulativeCounts[i] = regularData[i].value + below;
  }

  const maxValue = cumulativeCounts[0] || 1;

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 h-full w-full px-4 py-2 overflow-hidden">
      {regularData.map((item, index) => {
        const cumValue = cumulativeCounts[index];
        const widthPct = Math.max((cumValue / maxValue) * 100, 10);
        const prevCum = index > 0 ? cumulativeCounts[index - 1] : cumValue;
        const conversionPct = index > 0 && prevCum > 0
          ? Math.round((cumValue / prevCum) * 100)
          : null;
        const bgColor = item.color || colors[index % colors.length];

        const overallPct = Math.round((cumValue / maxValue) * 100);
        const stagePct = conversionPct !== null ? conversionPct : 100;

        return (
          <div key={item.name} className="w-full flex justify-center items-center">
            <div className="flex items-center gap-1.5" style={{ width: `${widthPct}%`, minWidth: '180px' }}>
              <span className="text-xs font-semibold text-muted-foreground w-10 text-right shrink-0" style={{ fontSize: Math.round(11 * m) }}>
                {stagePct}%
              </span>
              <div
                className="h-10 rounded-md flex items-center justify-between px-4 transition-all flex-1 min-w-0 overflow-hidden"
                style={{ backgroundColor: bgColor }}
              >
                <span className="text-sm font-medium text-white truncate whitespace-nowrap" style={{ fontSize: Math.round(13 * m) }}>
                  {item.name}
                </span>
                <span className="text-sm font-bold text-white ml-2 shrink-0" style={{ fontSize: Math.round(13 * m) }}>
                  {formatValueCompact(cumValue, formatting.type)}
                </span>
              </div>
              <span className="text-xs font-semibold text-muted-foreground w-10 shrink-0" style={{ fontSize: Math.round(11 * m) }}>
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
        const ganhosWidthPct = Math.max((ganhosItem.value / maxValue) * 100, 15);
        return (
          <div className="w-full flex justify-center items-center">
            <div className="flex items-center gap-1.5" style={{ width: `${ganhosWidthPct}%`, minWidth: '180px' }}>
              <span className="text-xs font-semibold text-muted-foreground w-10 text-right shrink-0" style={{ fontSize: Math.round(11 * m) }}>
                {ganhosStagePct}%
              </span>
              <div
                className="h-10 rounded-md flex items-center justify-between px-4 transition-all ring-2 ring-emerald-400 ring-offset-2 flex-1 min-w-0 overflow-hidden"
                style={{ backgroundColor: '#10b981' }}
              >
                <span className="text-sm font-medium text-white flex items-center gap-1.5 truncate whitespace-nowrap" style={{ fontSize: Math.round(13 * m) }}>
                  🏆 {ganhosItem.name}
                </span>
                <span className="text-sm font-bold text-white ml-2 shrink-0" style={{ fontSize: Math.round(13 * m) }}>
                  {formatValueCompact(ganhosItem.value, formatting.type)}
                </span>
              </div>
              <span className="text-xs font-semibold text-muted-foreground w-10 shrink-0" style={{ fontSize: Math.round(11 * m) }}>
                {ganhosOverallPct}%
              </span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
