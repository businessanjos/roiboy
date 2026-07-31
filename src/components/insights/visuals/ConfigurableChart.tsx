import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
} from "recharts";
import { ChartType, FormatType, AppearanceConfig, VisualConfig, COLOR_PALETTES, DEFAULT_APPEARANCE, FONT_SCALE_MULTIPLIERS, DATA_SOURCE_FIELDS, AGGREGATION_OPTIONS } from "../visual-builder/types";
import { ChartTooltip } from "./ChartTooltip";
import { ConfigurableScorecard } from "./ConfigurableScorecard";
import { DaysElapsedScorecard } from "./DaysElapsedScorecard";
import { SalesLeadsScorecard } from "./SalesLeadsScorecard";
import { ConfigurableRanking } from "./ConfigurableRanking";
import { ConfigurableCallCommercial } from "./ConfigurableCallCommercial";
import { GaugeFromConfig } from "./ConfigurableGauge";
import { IndicatorFromConfig } from "./ConfigurableIndicator";
import { StackedHorizontalBarChart } from "./StackedHorizontalBarChart";
import { ConfigurableBubbleMap } from "./ConfigurableBubbleMap";
import { ConfigurableFunnel } from "./ConfigurableFunnel";
import { ConfigurableTable } from "./ConfigurableTable";
import { formatValueCompact, formatValueWithScale } from "@/lib/formula-evaluator";
import { StackedDataPoint } from "@/hooks/useStackedVisualData";
import { useChartSize, approxTextWidth, truncateLabel } from "./useChartSize";

interface AggregatedDataPoint {
  name: string;
  value: number;
  count?: number;
  color?: string;
}

interface ConfigurableChartProps {
  type: ChartType;
  data: AggregatedDataPoint[];
  formatting: {
    type: FormatType;
    decimals: number;
  };
  appearance?: AppearanceConfig;
  visualConfig?: VisualConfig;
  stackedData?: StackedDataPoint[];
  stackedSeriesKeys?: string[];
  onDrilldown?: (groupName?: string) => void;
}

function getChartColors(palette: AppearanceConfig['colorPalette'] = 'professional'): string[] {
  return COLOR_PALETTES[palette] || COLOR_PALETTES.professional;
}

/** Header label for the grouping field ("Ver por") of the current visual. */
function getDimensionLabel(visualConfig?: VisualConfig): string | undefined {
  const ds = visualConfig?.dataSource as keyof typeof DATA_SOURCE_FIELDS | undefined;
  const field = visualConfig?.dimension?.field;
  if (!ds || !field || field === '_total') return undefined;
  if (visualConfig?.segmentBy && visualConfig.segmentBy.field === field) return visualConfig.segmentBy.label;
  return DATA_SOURCE_FIELDS[ds]?.dimension.find((f) => f.value === field)?.label || undefined;
}

/** Header label for the measure ("Medir por") of the current visual. */
function getMeasureLabel(visualConfig?: VisualConfig): string | undefined {
  const ds = visualConfig?.dataSource as keyof typeof DATA_SOURCE_FIELDS | undefined;
  const measure = visualConfig?.measure;
  if (!measure) return undefined;
  const aggLabel = AGGREGATION_OPTIONS.find((a) => a.value === measure.aggregation)?.label;
  if (measure.aggregation === 'count' || !measure.field) return aggLabel || undefined;
  const fieldLabel = ds ? DATA_SOURCE_FIELDS[ds]?.numeric.find((f) => f.value === measure.field)?.label : undefined;
  if (!fieldLabel) return aggLabel || undefined;
  return measure.aggregation === 'sum' ? fieldLabel : `${aggLabel} de ${fieldLabel}`;
}

export function ConfigurableChart({ type, data, formatting, appearance, visualConfig, stackedData, stackedSeriesKeys, onDrilldown }: ConfigurableChartProps) {
  const config = appearance || DEFAULT_APPEARANCE;
  
  if (type !== 'gauge' && type !== 'indicator' && type !== 'bar_stacked' && type !== 'bubble_map' && type !== 'funnel' && type !== 'data_table' && type !== 'scorecard' && type !== 'number' && (!data || data.length === 0)) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  switch (type) {
    case 'number':
    case 'scorecard':
      if (visualConfig?.gaugeConfig?.subType === 'days_elapsed') {
        return <DaysElapsedScorecard fontScale={visualConfig?.appearance?.fontScale} />;
      }
      if (visualConfig?.gaugeConfig?.subType === 'sales_leads') {
        return <SalesLeadsScorecard fontScale={visualConfig?.appearance?.fontScale} valueColor={visualConfig?.appearance?.valueColor} />;
      }
      return <ConfigurableScorecard data={data} formatting={formatting} config={visualConfig} />;
    case 'ranking':
      return (
        <ConfigurableRanking
          data={data}
          formatting={formatting}
          appearance={config}
          dimensionLabel={getDimensionLabel(visualConfig)}
          measureLabel={getMeasureLabel(visualConfig)}
        />
      );
    case 'call_commercial':
      return <ConfigurableCallCommercial data={data} formatting={formatting} hiddenUsers={visualConfig?.hiddenUsers} appearance={config} />;
    case 'gauge':
      return <GaugeFromConfig data={data} visualConfig={visualConfig} />;
    case 'bubble_map':
      return <ConfigurableBubbleMap data={(visualConfig as any)?._mapData || []} />;
    case 'indicator':
      return (
        <IndicatorFromConfig
          data={data}
          visualConfig={visualConfig}
          formatValue={(v) => formatValueWithScale(v, formatting.type, formatting.decimals, (visualConfig as any)?.formatting?.displayScale || 'auto')}
        />
      );
    case 'bar':
      return <BarChartView data={data} formatting={formatting} appearance={config} onDrilldown={onDrilldown} />;
    case 'bar_horizontal':
      return <HorizontalBarChartView data={data} formatting={formatting} appearance={config} onDrilldown={onDrilldown} />;
    case 'bar_stacked':
      return (
        <StackedHorizontalBarChart
          data={stackedData || []}
          seriesKeys={stackedSeriesKeys || []}
          formatting={formatting}
          appearance={config}
          orientation={visualConfig?.chartOrientation || 'horizontal'}
          seriesColors={visualConfig?.seriesColors}
        />
      );
    case 'line':
      return <LineChartView data={data} formatting={formatting} appearance={config} onDrilldown={onDrilldown} />;
    case 'pie':
      return <PieChartView data={data} formatting={formatting} appearance={config} onDrilldown={onDrilldown} />;
    case 'funnel':
      return <ConfigurableFunnel data={data} formatting={formatting} appearance={config} />;
    case 'data_table':
      return <ConfigurableTable config={visualConfig!} />;
    default:
      return <BarChartView data={data} formatting={formatting} appearance={config} onDrilldown={onDrilldown} />;
  }
}

const AXIS_TICK = { fill: 'hsl(var(--muted-foreground))' };

/** Largura do eixo de valores calculada pelo maior rótulo formatado (evita corte). */
function yAxisWidth(
  data: AggregatedDataPoint[],
  formatting: ConfigurableChartProps['formatting'],
  fontSize: number
) {
  const longest = data.reduce((acc, d) => {
    const t = formatValueCompact(d.value, formatting.type);
    return t.length > acc.length ? t : acc;
  }, '0');
  return Math.round(Math.min(120, Math.max(44, approxTextWidth(longest, fontSize) + 16)));
}

function BarChartView({ 
  data, 
  formatting, 
  appearance,
  onDrilldown 
}: { 
  data: AggregatedDataPoint[]; 
  formatting: ConfigurableChartProps['formatting']; 
  appearance: AppearanceConfig;
  onDrilldown?: (groupName?: string) => void;
}) {
  const colors = getChartColors(appearance.colorPalette);
  const m = FONT_SCALE_MULTIPLIERS[appearance.fontScale || 'normal'];
  const { ref, width, height } = useChartSize();

  const tickFont = Math.round(10 * m);
  const longest = data.reduce((a, d) => Math.max(a, String(d.name ?? '').length), 0);

  // Espaço por categoria: define se os rótulos cabem na horizontal
  const slot = data.length ? Math.max(width - 100, 80) / data.length : 80;
  const flat = approxTextWidth('x'.repeat(longest), tickFont) <= slot - 6;
  const maxChars = flat
    ? longest
    : Math.max(6, Math.floor(Math.min(120, (height || 240) * 0.42) / (tickFont * 0.62)));

  const axisHeight = flat
    ? Math.round(tickFont * 2.2)
    : Math.min(112, Math.round(approxTextWidth('x'.repeat(maxChars), tickFont) * 0.72) + 12);

  // Evita rótulos de eixo colados quando há muitas categorias
  const tickInterval = flat ? 0 : Math.max(0, Math.ceil((data.length * (tickFont + 6)) / Math.max(width - 100, 1)) - 1);
  const barSlot = data.length ? Math.max(width - 100, 1) / data.length : 0;
  const labelStep = Math.max(1, Math.ceil(48 / Math.max(barSlot, 1)));
  const yWidth = yAxisWidth(data, formatting, Math.round(11 * m));

  return (
    <div ref={ref} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 12, left: 4, bottom: 4 }} barCategoryGap="18%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: tickFont, ...AXIS_TICK }}
            tickFormatter={(v: string) => truncateLabel(String(v ?? ''), maxChars)}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            angle={flat ? 0 : -35}
            textAnchor={flat ? 'middle' : 'end'}
            height={axisHeight}
            interval={tickInterval}
            tickMargin={6}
          />
          <YAxis
            tickFormatter={(value) => formatValueCompact(value, formatting.type)}
            tick={{ fontSize: Math.round(11 * m), ...AXIS_TICK }}
            tickLine={false}
            axisLine={false}
            width={yWidth}
          />
          <Tooltip cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.35 }} content={<ChartTooltip formatting={formatting} showCount />} />
          <Bar 
            dataKey="value" 
            radius={[6, 6, 0, 0]}
            maxBarSize={64}
            onClick={(data) => onDrilldown?.(data.name)}
            style={{ cursor: onDrilldown ? 'pointer' : 'default' }}
          >
            {appearance.showDataLabels && (
              <LabelList 
                dataKey="value" 
                position="top" 
                content={({ x, y, value, index, width: barWidth }) => {
                  if (typeof index !== 'number' || index % labelStep !== 0) return null;
                  const text = formatValueCompact(value as number, formatting.type);
                  if (approxTextWidth(text, tickFont) > barSlot * labelStep) return null;
                  const centerX = (x as number) + (barWidth as number) / 2;
                  return (
                    <text x={centerX} y={Math.max((y as number) - 8, 10)} textAnchor="middle"
                      style={{ fontSize: tickFont, fill: 'hsl(var(--foreground))', fontVariantNumeric: 'tabular-nums' }}>
                      {text}
                    </text>
                  );
                }}
              />
            )}
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || colors[index % colors.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function HorizontalBarChartView({ 
  data, 
  formatting, 
  appearance,
  onDrilldown 
}: { 
  data: AggregatedDataPoint[]; 
  formatting: ConfigurableChartProps['formatting']; 
  appearance: AppearanceConfig;
  onDrilldown?: (groupName?: string) => void;
}) {
  const colors = getChartColors(appearance.colorPalette);
  const m = FONT_SCALE_MULTIPLIERS[appearance.fontScale || 'normal'];
  const { ref, width, height } = useChartSize();

  const tickFont = Math.round(11 * m);
  const rowHeight = Math.max(26, Math.round(26 * m));
  const axisArea = 34;

  // Altura mínima por barra: se não couber, o card rola verticalmente
  const needed = data.length * rowHeight + axisArea;
  const scroll = height > 0 && needed > height;
  const chartHeight = scroll ? needed : '100%';

  const longest = data.reduce((a, d) => Math.max(a, String(d.name ?? '').length), 0);
  const maxLabelWidth = Math.max(70, Math.min(width * 0.34, 200));
  const maxChars = Math.max(6, Math.floor(maxLabelWidth / (tickFont * 0.58)));
  const yWidth = Math.min(maxLabelWidth, approxTextWidth('x'.repeat(Math.min(longest, maxChars)), tickFont) + 12);

  const maxValueText = data.reduce(
    (a, d) => Math.max(a, formatValueCompact(d.value, formatting.type).length),
    0
  );
  const rightMargin = appearance.showDataLabels
    ? Math.min(140, Math.round(maxValueText * tickFont * 0.62) + 16)
    : 16;

  return (
    <div ref={ref} className={`h-full w-full ${scroll ? 'overflow-y-auto overflow-x-hidden' : ''}`}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart layout="vertical" data={data} margin={{ top: 8, right: rightMargin, left: 4, bottom: 8 }} barCategoryGap="22%">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
          <XAxis
            type="number"
            tickFormatter={(value) => formatValueCompact(value, formatting.type)}
            tick={{ fontSize: tickFont, ...AXIS_TICK }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fontSize: tickFont, ...AXIS_TICK }}
            tickFormatter={(v: string) => truncateLabel(String(v ?? ''), maxChars)}
            tickLine={false}
            axisLine={false}
            width={Math.round(yWidth)}
            interval={0}
          />
          <Tooltip cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.35 }} content={<ChartTooltip formatting={formatting} showCount />} />
          <Bar 
            dataKey="value" 
            radius={[0, 6, 6, 0]}
            maxBarSize={28}
            onClick={(data) => onDrilldown?.(data.name)}
            style={{ cursor: onDrilldown ? 'pointer' : 'default' }}
          >
            {appearance.showDataLabels && (
              <LabelList 
                dataKey="value" 
                position="right" 
                formatter={(value: number) => formatValueCompact(value, formatting.type)}
                style={{ fontSize: tickFont, fill: 'hsl(var(--foreground))', fontVariantNumeric: 'tabular-nums' }}
              />
            )}
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || colors[index % colors.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LineChartView({
  data, 
  formatting, 
  appearance,
  onDrilldown 
}: { 
  data: AggregatedDataPoint[]; 
  formatting: ConfigurableChartProps['formatting']; 
  appearance: AppearanceConfig;
  onDrilldown?: (groupName?: string) => void;
}) {
  const colors = getChartColors(appearance.colorPalette);
  const primaryColor = colors[0];
  const m = FONT_SCALE_MULTIPLIERS[appearance.fontScale || 'normal'];
  const { ref, width } = useChartSize();

  const tickFont = Math.round(10 * m);
  const longest = data.reduce((a, d) => Math.max(a, String(d.name ?? '').length), 0);
  const slot = data.length ? Math.max(width - 90, 60) / data.length : 60;
  const flat = approxTextWidth('x'.repeat(longest), tickFont) <= slot - 4;
  const maxChars = flat ? longest : Math.max(5, Math.floor(52 / (tickFont * 0.62)));
  const tickInterval = flat ? 0 : 'preserveStartEnd';
  const labelStep = Math.max(1, Math.ceil(52 / Math.max(slot, 1)));
  const yWidth = yAxisWidth(data, formatting, Math.round(11 * m));

  return (
    <div ref={ref} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 24, right: 24, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="lineFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primaryColor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={primaryColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: tickFont, ...AXIS_TICK }}
            tickFormatter={(v: string) => truncateLabel(String(v ?? ''), maxChars)}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            angle={flat ? 0 : -35}
            textAnchor={flat ? 'middle' : 'end'}
            height={flat ? Math.round(tickFont * 2.2) : 56}
            interval={tickInterval as any}
            tickMargin={6}
          />
          <YAxis
            tickFormatter={(value) => formatValueCompact(value, formatting.type)}
            tick={{ fontSize: Math.round(11 * m), ...AXIS_TICK }}
            tickLine={false}
            axisLine={false}
            width={yWidth}
          />
          <Tooltip cursor={{ stroke: 'hsl(var(--border))' }} content={<ChartTooltip formatting={formatting} showCount />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={primaryColor}
            strokeWidth={2.5}
            dot={data.length > 40 ? false : { r: 3, fill: primaryColor, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: primaryColor, onClick: (_, e: any) => onDrilldown?.(e?.payload?.name) }}
          >
            {appearance.showDataLabels && (
              <LabelList 
                dataKey="value" 
                position="top" 
                content={({ x, y, value, index }) => {
                  if (typeof index !== 'number' || index % labelStep !== 0) return null;
                  if (!value || value === 0) return null;
                  const text = formatValueCompact(value as number, formatting.type);
                  const half = approxTextWidth(text, tickFont) / 2;
                  const cx = Math.min(Math.max((x as number), half + 4), Math.max(width - half - 4, half + 4));
                  return (
                    <text x={cx} y={Math.max((y as number) - 10, 10)} textAnchor="middle"
                      style={{ fontSize: tickFont, fill: 'hsl(var(--foreground))', fontVariantNumeric: 'tabular-nums' }}>
                      {text}
                    </text>
                  );
                }}
              />
            )}
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function PieChartView({ 
  data, 
  formatting, 
  appearance,
  onDrilldown 
}: { 
  data: AggregatedDataPoint[]; 
  formatting: ConfigurableChartProps['formatting']; 
  appearance: AppearanceConfig;
  onDrilldown?: (groupName?: string) => void;
}) {
  const colors = getChartColors(appearance.colorPalette);
  const m = FONT_SCALE_MULTIPLIERS[appearance.fontScale || 'normal'];
  const { ref, width, height } = useChartSize();

  const compact = width > 0 && (width < 320 || height < 240 || data.length > 6);
  const labelFont = Math.round(11 * m);

  return (
    <div ref={ref} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="45%"
            outerRadius={compact ? '72%' : '68%'}
            paddingAngle={2}
            dataKey="value"
            label={
              compact
                ? ({ percent }) => (percent >= 0.05 ? `${(percent * 100).toFixed(0)}%` : '')
                : ({ name, percent }) =>
                    percent >= 0.03 ? `${truncateLabel(String(name ?? ''), 14)} ${(percent * 100).toFixed(0)}%` : ''
            }
            labelLine={compact ? false : { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
            onClick={(data) => onDrilldown?.(data.name)}
            style={{ cursor: onDrilldown ? 'pointer' : 'default', fontSize: labelFont }}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || colors[index % colors.length]}
                stroke="hsl(var(--card))"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip formatting={formatting} showCount />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

