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
    const below = i < regularData.length - 1 ? cumulativeCounts[i + 1] : 0;
    cumulativeCounts[i] = regularData[i].value + below;
  }

  const maxValue = cumulativeCounts[0] || 1;

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 h-full w-full px-4 py-2 overflow-hidden">
      {regularData.map((item, index) => {
        const cumValue = cumulativeCounts[index];
        const widthPct = Math.max((cumValue / maxValue) * 100, 15);
        const prevCum = index > 0 ? cumulativeCounts[index - 1] : cumValue;
        const conversionPct = index > 0 && prevCum > 0
          ? Math.round((cumValue / prevCum) * 100)
          : null;
        const bgColor = item.color || colors[index % colors.length];

        return (
          <div key={item.name} className="flex flex-col items-center w-full" style={{ gap: '2px' }}>
            <div
              className="h-10 rounded-md flex items-center justify-between px-4 transition-all"
              style={{
                width: `${widthPct}%`,
                minWidth: '180px',
                backgroundColor: bgColor,
              }}
            >
              <span className="text-sm font-medium text-white truncate" style={{ fontSize: Math.round(13 * m) }}>
                {item.name}
              </span>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <span className="text-sm font-bold text-white" style={{ fontSize: Math.round(13 * m) }}>
                  {formatValueCompact(cumValue, formatting.type)}
                </span>
                {conversionPct !== null && (
                  <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded text-white">
                    {conversionPct}%
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {ganhosItem && (
        <div className="flex flex-col items-center w-full" style={{ gap: '2px' }}>
          <div
            className="h-10 rounded-md flex items-center justify-between px-4 transition-all ring-2 ring-emerald-400 ring-offset-2"
            style={{
              width: `${Math.max((ganhosItem.value / maxValue) * 100, 15)}%`,
              minWidth: '180px',
              backgroundColor: '#10b981',
            }}
          >
            <span className="text-sm font-medium text-white flex items-center gap-1.5" style={{ fontSize: Math.round(13 * m) }}>
              🏆 {ganhosItem.name}
            </span>
            <div className="flex items-center gap-2 ml-2 shrink-0">
              <span className="text-sm font-bold text-white" style={{ fontSize: Math.round(13 * m) }}>
                {formatValueCompact(ganhosItem.value, formatting.type)}
              </span>
              {cumulativeCounts.length > 0 && cumulativeCounts[cumulativeCounts.length - 1] > 0 && (
                <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded text-white">
                  {Math.round((ganhosItem.value / cumulativeCounts[cumulativeCounts.length - 1]) * 100)}%
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
