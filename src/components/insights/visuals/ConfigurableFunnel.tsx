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

  const maxValue = data[0]?.value || 1;

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 h-full w-full px-4 py-2 overflow-auto">
      {data.map((item, index) => {
        const widthPct = Math.max((item.value / maxValue) * 100, 15);
        const conversionPct = index > 0 && data[index - 1].value > 0
          ? Math.round((item.value / data[index - 1].value) * 100)
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
                  {formatValueCompact(item.value, formatting.type)}
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
    </div>
  );
}
