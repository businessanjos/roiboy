import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LabelList,
} from "recharts";
import { FormatType, AppearanceConfig, COLOR_PALETTES, FONT_SCALE_MULTIPLIERS, DEFAULT_APPEARANCE } from "../visual-builder/types";
import { formatValueCompact } from "@/lib/formula-evaluator";
import { StackedDataPoint } from "@/hooks/useStackedVisualData";

interface StackedHorizontalBarChartProps {
  data: StackedDataPoint[];
  seriesKeys: string[];
  formatting: {
    type: FormatType;
    decimals: number;
  };
  appearance: AppearanceConfig;
  orientation?: 'horizontal' | 'vertical';
  seriesColors?: Record<string, string>;
}

function getChartColors(palette: AppearanceConfig['colorPalette'] = 'professional'): string[] {
  const extended = [
    ...(COLOR_PALETTES[palette] || COLOR_PALETTES.professional),
    '#f97316', '#06b6d4', '#8b5cf6', '#ec4899', '#84cc16',
    '#14b8a6', '#f43f5e', '#a855f7', '#eab308', '#6366f1',
  ];
  return extended;
}

const CustomTooltip = ({ active, payload, label, formatting, singleSeries }: any) => {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-1">{label}</p>
      {!singleSeries && payload.map((entry: any, index: number) => (
        entry.value > 0 && (
          <div key={index} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium">
              {formatValueCompact(entry.value, formatting.type)}
            </span>
          </div>
        )
      ))}
      <div className={`${singleSeries ? '' : 'border-t border-border mt-1 pt-1'} font-medium`}>
        {singleSeries ? '' : 'Total: '}{formatValueCompact(total, formatting.type)}
      </div>
    </div>
  );
};

const renderInsideLabel = (props: any, formatting: { type: FormatType }, fontMultiplier: number) => {
  const { x, y, width, height, value } = props;
  if (!value || value === 0 || height < 14) return null;

  const baseFontSize = Math.round(10 * fontMultiplier);
  const effectiveFontSize = Math.min(baseFontSize, height - 2);

  const formatted = formatValueCompact(value, formatting.type);
  const estimatedTextWidth = formatted.length * effectiveFontSize * 0.65;

  if (estimatedTextWidth + 8 > width) return null;

  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      fill="white"
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={effectiveFontSize}
      fontWeight={600}
    >
      {formatted}
    </text>
  );
};

export function StackedHorizontalBarChart({
  data,
  seriesKeys,
  formatting,
  appearance,
  orientation = 'horizontal',
  seriesColors,
}: StackedHorizontalBarChartProps) {
  const safeFormatting = formatting || { type: 'number' as FormatType, decimals: 0 };
  const safeAppearance = appearance || DEFAULT_APPEARANCE;
  const colors = getChartColors(safeAppearance.colorPalette);
  const getSeriesColor = (key: string, index: number) => seriesColors?.[key] || colors[index % colors.length];
  const m = FONT_SCALE_MULTIPLIERS[safeAppearance.fontScale || 'normal'];

  if (!data || data.length === 0 || seriesKeys.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  const isVertical = orientation === 'vertical';

  if (isVertical) {
    const tickFont = Math.round(11 * m);
    // Largura do eixo de valores baseada no maior rótulo (evita corte tipo "0.000")
    const totals = data.map((d) =>
      seriesKeys.reduce((sum, k) => sum + (Number((d as any)[k]) || 0), 0)
    );
    const maxTotal = Math.max(0, ...totals);
    const longestTick = formatValueCompact(maxTotal, safeFormatting.type);
    const yWidth = Math.round(Math.min(120, Math.max(48, longestTick.length * tickFont * 0.62 + 16)));
    const lastKey = seriesKeys[seriesKeys.length - 1];
    const showTotals = safeAppearance.showDataLabels && data.length <= 40;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 34, right: 12, left: 4, bottom: 4 }}
          barCategoryGap="18%"
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: tickFont, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            interval={0}
            tickMargin={6}
            height={24}
          />
          <YAxis
            tickFormatter={(value) => formatValueCompact(value, safeFormatting.type)}
            tick={{ fontSize: tickFont, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={yWidth}
          />
          <Tooltip cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.25 }} content={<CustomTooltip formatting={safeFormatting} singleSeries={seriesKeys.length <= 1} />} />
          {seriesKeys.length >= 1 && (
            <Legend
              verticalAlign="top"
              align="center"
              height={26}
              iconSize={9}
              wrapperStyle={{ fontSize: Math.round(11 * m), color: 'hsl(var(--muted-foreground))', paddingBottom: 6, textAlign: 'center' }}

            />
          )}
          {seriesKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="stack"
              fill={getSeriesColor(key, index)}
              radius={index === seriesKeys.length - 1 ? [4, 4, 0, 0] : undefined}
            >
              {showTotals && key === lastKey && (
                <LabelList
                  dataKey={key}
                  position="top"
                  offset={6}
                  content={(props: any) => {
                    const idx = props.index ?? 0;
                    const total = totals[idx] || 0;
                    if (!total) return null;

                    const text = formatValueCompact(total, safeFormatting.type);
                    const slot = (props.width || 0) / 0.82; // barCategoryGap 18%
                    let fs = Math.max(9, Math.round(10 * m));
                    // reduz a fonte até um mínimo legível para caber no slot
                    while (fs > 8 && text.length * fs * 0.58 > slot) fs -= 1;

                    // se ainda não couber, alterna a altura do rótulo (zigue-zague)
                    const fits = text.length * fs * 0.58 <= slot;
                    const hasNeighbor =
                      (totals[idx - 1] || 0) > 0 || (totals[idx + 1] || 0) > 0;
                    const stagger = !fits && hasNeighbor && idx % 2 === 1;

                    return (
                      <text
                        x={props.x + props.width / 2}
                        y={props.y - 6 - (stagger ? fs + 4 : 0)}
                        fill="hsl(var(--foreground))"
                        textAnchor="middle"
                        fontSize={fs}
                        fontWeight={600}
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {text}
                      </text>
                    );
                  }}
                />
              )}

            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }


  // Horizontal layout (original)
  const barHeight = 40;
  const minHeight = 300;
  const calculatedHeight = Math.max(minHeight, data.length * barHeight + 80);

  return (
    <ResponsiveContainer width="100%" height={calculatedHeight}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(value) => formatValueCompact(value, formatting.type)}
          tick={{ fontSize: Math.round(11 * m) }}
          className="text-muted-foreground"
        />
        <YAxis
          dataKey="name"
          type="category"
          tick={{ fontSize: Math.round(11 * m) }}
          className="text-muted-foreground"
          width={90}
          interval={0}
        />
        <Tooltip content={<CustomTooltip formatting={safeFormatting} singleSeries={seriesKeys.length <= 1} />} />
        {seriesKeys.length >= 1 && (
          <Legend
            verticalAlign="top"
            height={36}
            wrapperStyle={{ fontSize: Math.round(12 * m) }}
          />
        )}
        {seriesKeys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="stack"
            fill={getSeriesColor(key, index)}
            radius={index === seriesKeys.length - 1 ? [0, 4, 4, 0] : undefined}
          >
            {safeAppearance.showDataLabels && (
              <LabelList
                dataKey={key}
                content={(props: any) => renderInsideLabel(props, safeFormatting, m)}
              />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
