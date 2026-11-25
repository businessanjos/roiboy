import { productShortName } from "@/lib/insights/productShortName";
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
  Rectangle,
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


function getChartColors(palette: AppearanceConfig['colorPalette'] = 'ryka'): string[] {
  // Extensão harmônica: variações da própria paleta, sem cores fora do tema.
  return extendPalette(COLOR_PALETTES[palette] || COLOR_PALETTES.ryka, 20);
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

const renderInsideLabel = (props: any, formatting: { type: FormatType }, fontMultiplier: number, seriesName?: string, vertical = false) => {
  const { x, y, width, height, value, fill } = props;
  if (!value || value === 0 || height < 14) return null;

  const formatted = formatValueCompact(value, formatting.type);
  const short = seriesName ? productShortName(seriesName) : '';
  // Tenta "EM · 45"; se não couber, só o número; diminui a fonte até 8px.
  const candidates = short ? [`${short} · ${formatted}`, formatted] : [formatted];
  const base = vertical
    ? Math.min(Math.round(12 * fontMultiplier), height - 4, 16)
    : Math.min(Math.round(10 * fontMultiplier), height - 2);
  for (const text of candidates) {
    let fs = base;
    while (fs > 8 && text.length * fs * 0.6 + 4 > width) fs -= 1;
    if (text.length * fs * 0.6 + 4 <= width) {
      return (
        <text x={x + width / 2} y={y + height / 2} fill={readableTextOn(fill)} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fontWeight={600} style={vertical ? { fill: readableTextOn(fill), fontSize: fs, letterSpacing: 0, pointerEvents: 'none' } : undefined}>
          {text}
        </text>
      );
    }
  }
  return null;
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
  const { ref: sizeRef, width: containerWidth, height: containerHeight } = useChartSize();

  if (!data || data.length === 0 || seriesKeys.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  const isVertical = orientation === 'vertical';

  if (isVertical) {
    const width = sizeRef.current?.clientWidth || containerWidth || 0;
    const narrow = width > 0 && width < 520;
    // Rótulos de eixo (datas, siglas) não precisam crescer tanto quanto os
    // números: no modo TV limitamos para sobrar altura útil às barras.
    const tickFont = Math.min(Math.round((narrow ? 11 : 12) * m), tvMode.tv ? 16 : 999);
    const legendFont = Math.min(Math.round(12 * m), tvMode.tv ? 15 : 999);
    // Largura do eixo de valores baseada no maior rótulo (evita corte tipo "0.000")
    const totals = data.map((d) =>
      seriesKeys.reduce((sum, k) => sum + (Number((d as any)[k]) || 0), 0)
    );
    const maxTotal = Math.max(0, ...totals);
    const longestTick = formatValueCompact(maxTotal, safeFormatting.type);
    const yWidth = Math.round(Math.min(120, Math.max(narrow ? 40 : 48, longestTick.length * tickFont * 0.62 + 12)));
    const lastKey = seriesKeys[seriesKeys.length - 1];

    // Eixo X: gira e reduz a densidade de rótulos quando o espaço por categoria é pequeno.
    const plotWidth = Math.max(width - yWidth - 24, 1);
    const slot = data.length ? plotWidth / data.length : plotWidth;
    const showTotals = safeAppearance.showDataLabels && data.length <= 40 && slot >= 48;
    const longestName = data.reduce((max, d) => Math.max(max, String(d.name ?? '').length), 0);
    const nameWidth = longestName * tickFont * 0.6;
    // Rótulos curtos (datas 01/09, siglas) ficam sempre na horizontal: girar o
    // texto rouba metade da altura útil do gráfico. Em vez disso, pulamos rótulos.
    const wrapNames = data.length <= 8 && nameWidth > slot - 12;
    const fitsFlat = wrapNames || longestName <= 8 || nameWidth <= slot - 4;
    const xInterval = wrapNames ? 0 : Math.max(
      0,
      Math.ceil((data.length * (fitsFlat ? nameWidth + 14 : tickFont + 6)) / plotWidth) - 1
    );
    const xAxisCap = Math.max(26, Math.round((containerHeight || 240) * 0.24));
    const xHeight = wrapNames ? Math.round(tickFont * 3.4) : fitsFlat
      ? Math.round(tickFont * 2.2)
      : Math.min(xAxisCap, Math.round(longestName * tickFont * 0.5) + 14);

    return (
      <div ref={sizeRef} className="stacked-vertical-chart flex h-full w-full min-h-0 flex-col">
      <div className="shrink-0 pb-3 pt-1" aria-label="Legenda do gráfico">
        <ChartLegendContent
          payload={seriesKeys.map((key, index) => ({ value: key, color: getSeriesColor(key, index) }))}
          fontSize={legendFont}
          align="left"
        />
      </div>
      <div className="min-h-0 flex-1" data-stacked-plot>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: showTotals ? 26 : 10, right: 12, left: 4, bottom: 4 }}
          barCategoryGap="28%"
          maxBarSize={tvMode.tv ? 160 : 128}
        >
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
          <XAxis
            dataKey="name"
            tick={(props: any) => {
              const name = String(props.payload?.value ?? '');
              const words = name.split(/\s+/);
              const split = Math.ceil(words.length / 2);
              const lines = wrapNames && words.length > 1 ? [words.slice(0, split).join(' '), words.slice(split).join(' ')] : [name];
              return <text x={props.x} y={props.y} textAnchor={fitsFlat ? 'middle' : 'end'} transform={!fitsFlat ? `rotate(-35, ${props.x}, ${props.y})` : undefined} style={{ fontSize: tickFont, fill: 'hsl(var(--muted-foreground))', letterSpacing: 0 }}><title>{name}</title>{lines.map((line, index) => <tspan key={index} x={props.x} dy={index === 0 ? tickFont : tickFont * 1.2}>{line}</tspan>)}</text>;
            }}
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
            tick={{ style: { fontSize: tickFont, fill: 'hsl(var(--muted-foreground))', letterSpacing: 0 } }}
            tickLine={false}
            axisLine={false}
            width={yWidth}
          />
          <Tooltip cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.25 }} content={<CustomTooltip formatting={safeFormatting} singleSeries={seriesKeys.length <= 1} />} />
          {seriesKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="stack"
              fill={getSeriesColor(key, index)}
              shape={(props: any) => {
                const topKey = [...seriesKeys].reverse().find(series => Number(props.payload?.[series]) > 0);
                return <Rectangle {...props} radius={key === topKey ? [5, 5, 0, 0] : 0} />;
              }}
              onClick={(payload: any) => onDrilldown?.(payload?.name ?? payload?.payload?.name)}
              style={{ cursor: onDrilldown ? 'pointer' : 'default' }}
            >
              {/* Valor de cada fatia dentro do próprio bloco (azul, dourado...). */}
              {safeAppearance.showDataLabels && <LabelList
                dataKey={key}
                content={(props: any) => renderInsideLabel({ ...props, fill: getSeriesColor(key, index) }, safeFormatting, m, key, true)}
              />}

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
                    let fs = Math.min(17, Math.max(11, Math.round(13 * m)));
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
                        style={{ fill: 'hsl(var(--foreground))', fontSize: fs, fontVariantNumeric: 'tabular-nums', letterSpacing: 0, pointerEvents: 'none' }}
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
                    content={(props: any) => renderInsideLabel(props, safeFormatting, m, key)}
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

