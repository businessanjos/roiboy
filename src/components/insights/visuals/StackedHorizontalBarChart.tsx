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
import { ChartLegendContent } from './ChartLegendContent';
import { useChartSize } from './useChartSize';

import { FormatType, AppearanceConfig, COLOR_PALETTES, FONT_SCALE_MULTIPLIERS, DEFAULT_APPEARANCE } from "../visual-builder/types";
import { useTvMode } from "../TvModeContext";
import { formatValueCompact } from "@/lib/formula-evaluator";
import { StackedDataPoint } from "@/hooks/useStackedVisualData";
import { extendPalette, readableTextOn } from "@/lib/insights/paletteColors";

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
  onDrilldown?: (groupName?: string) => void;
}


function getChartColors(palette: AppearanceConfig['colorPalette'] = 'professional'): string[] {
  // Extensão harmônica: variações da própria paleta, sem cores fora do tema.
  return extendPalette(COLOR_PALETTES[palette] || COLOR_PALETTES.professional, 20);
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
  const { x, y, width, height, value, fill } = props;
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
      fill={readableTextOn(fill)}
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
  onDrilldown,
}: StackedHorizontalBarChartProps) {

  const safeFormatting = formatting || { type: 'number' as FormatType, decimals: 0 };
  const safeAppearance = appearance || DEFAULT_APPEARANCE;
  const colors = getChartColors(safeAppearance.colorPalette);
  const getSeriesColor = (key: string, index: number) =>
    (!safeAppearance.paletteLocked && seriesColors?.[key]) || colors[index % colors.length];
  const tvMode = useTvMode();
  const m = FONT_SCALE_MULTIPLIERS[safeAppearance.fontScale || 'normal'] * tvMode.scale;
  // Largura real do container: permite adaptar eixos/legenda em telas estreitas (mobile).
  const { ref: sizeRef, width: containerWidth } = useChartSize();


  if (!data || data.length === 0 || seriesKeys.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  const isVertical = orientation === 'vertical';

  if (isVertical) {
    const width = containerWidth || 0;
    const narrow = width > 0 && width < 520;
    const tickFont = Math.round((narrow ? 9 : 11) * m);
    // Largura do eixo de valores baseada no maior rótulo (evita corte tipo "0.000")
    const totals = data.map((d) =>
      seriesKeys.reduce((sum, k) => sum + (Number((d as any)[k]) || 0), 0)
    );
    const maxTotal = Math.max(0, ...totals);
    const longestTick = formatValueCompact(maxTotal, safeFormatting.type);
    const yWidth = Math.round(Math.min(120, Math.max(narrow ? 40 : 48, longestTick.length * tickFont * 0.62 + 12)));
    const lastKey = seriesKeys[seriesKeys.length - 1];
    // Em telas estreitas os rótulos de total colidem — mantemos só o tooltip.
    const showTotals = safeAppearance.showDataLabels && data.length <= 40 && !narrow;

    // Eixo X: gira e reduz a densidade de rótulos quando o espaço por categoria é pequeno.
    const plotWidth = Math.max(width - yWidth - 24, 1);
    const slot = data.length ? plotWidth / data.length : plotWidth;
    const longestName = data.reduce((max, d) => Math.max(max, String(d.name ?? '').length), 0);
    const fitsFlat = longestName * tickFont * 0.6 <= slot - 4;
    const xInterval = fitsFlat ? 0 : Math.max(0, Math.ceil((data.length * (tickFont + 6)) / plotWidth) - 1);
    const xHeight = fitsFlat ? 24 : Math.min(78, Math.round(longestName * tickFont * 0.5) + 14);

    // Legenda multi-linha: reserva altura suficiente para não invadir o gráfico.
    const legendChars = seriesKeys.reduce((s, k) => s + k.length + 6, 0);
    const legendLines = Math.max(1, Math.ceil((legendChars * tickFont * 0.55) / Math.max(width - 16, 200)));
    const legendHeight = Math.round(legendLines * (tickFont + 9) + 8);

    return (
      <div ref={sizeRef} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: showTotals ? 34 : 12, right: 12, left: 4, bottom: 4 }}
          barCategoryGap="18%"
        >
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: tickFont, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            interval={xInterval}
            angle={fitsFlat ? 0 : -35}
            textAnchor={fitsFlat ? 'middle' : 'end'}
            tickMargin={6}
            height={xHeight}
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
              height={legendHeight}
              wrapperStyle={{ paddingBottom: 6 }}
              content={(props: any) => (
                <ChartLegendContent payload={props?.payload} fontSize={tickFont} />
              )}
            />
          )}

          {seriesKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="stack"
              fill={getSeriesColor(key, index)}
              radius={index === seriesKeys.length - 1 ? [4, 4, 0, 0] : undefined}
              onClick={(payload: any) => onDrilldown?.(payload?.name ?? payload?.payload?.name)}
              style={{ cursor: onDrilldown ? 'pointer' : 'default' }}
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
      </div>
    );

  }


  // Horizontal layout
  const tickFont = Math.round(11 * m);
  const barHeight = Math.round(30 * m);
  const longestLabel = data.reduce((max, d) => Math.max(max, String(d.name ?? '').length), 0);
  const yWidth = Math.round(Math.min(180, Math.max(70, longestLabel * tickFont * 0.58 + 12)));
  // legenda pode quebrar em várias linhas: reserva altura por linha estimada
  const legendChars = seriesKeys.reduce((s, k) => s + k.length + 6, 0);
  const legendLines = Math.max(1, Math.ceil((legendChars * tickFont * 0.55) / 520));
  const legendHeight = seriesKeys.length > 1 ? legendLines * Math.round(20 * m) + 8 : 0;
  const chartHeight = data.length * barHeight + legendHeight + Math.round(48 * m);

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden">
      <div style={{ height: chartHeight, minHeight: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 4, right: 28, left: 0, bottom: 4 }}
            barCategoryGap="22%"
          >
            <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(value) => formatValueCompact(value, safeFormatting.type)}
              tick={{ fontSize: tickFont, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              height={22}
            />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: tickFont, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={yWidth}
              interval={0}
            />
            <Tooltip cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.25 }} content={<CustomTooltip formatting={safeFormatting} singleSeries={seriesKeys.length <= 1} />} />
            {seriesKeys.length > 1 && (
              <Legend
                verticalAlign="top"
                align="center"
                height={legendHeight}
                wrapperStyle={{ paddingBottom: 6 }}
                content={(props: any) => (
                  <ChartLegendContent payload={props?.payload} fontSize={tickFont} />
                )}
              />
            )}
            {seriesKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="stack"
                fill={getSeriesColor(key, index)}
                radius={index === seriesKeys.length - 1 ? [0, 4, 4, 0] : undefined}
                onClick={(payload: any) => onDrilldown?.(payload?.name ?? payload?.payload?.name)}
                style={{ cursor: onDrilldown ? 'pointer' : 'default' }}
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
      </div>
    </div>
  );
}

