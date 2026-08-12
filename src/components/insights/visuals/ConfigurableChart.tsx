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
  Legend,
} from "recharts";
import { ChartType, FormatType, AppearanceConfig, VisualConfig, COLOR_PALETTES, DEFAULT_APPEARANCE, FONT_SCALE_MULTIPLIERS, DATA_SOURCE_FIELDS, AGGREGATION_OPTIONS } from "../visual-builder/types";
import { ChartTooltip } from "./ChartTooltip";
import { ChartLegendContent } from "./ChartLegendContent";
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
import { GoalTrackerVisual } from './GoalTrackerVisual';
import { DailyPerformanceTable } from "./DailyPerformanceTable";
import { formatValueCompact, formatValueWithScale } from "@/lib/formula-evaluator";
import { StackedDataPoint } from "@/hooks/useStackedVisualData";
import { useChartSize, approxTextWidth, truncateLabel } from "./useChartSize";
import { extendPalette } from "@/lib/insights/paletteColors";
import { useTvMode } from "../TvModeContext";


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
  // Extensão harmônica para nunca repetir a mesma cor em séries longas.
  return extendPalette(COLOR_PALETTES[palette] || COLOR_PALETTES.professional, 20);
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

/** Categorias demais viram ruído na TV: mantém o topo e agrupa o resto em "Outros". */
function capCategories(data: AggregatedDataPoint[], max: number): AggregatedDataPoint[] {
  if (!data || max <= 0 || data.length <= max) return data;
  const sorted = [...data].sort((a, b) => (b.value || 0) - (a.value || 0));
  const top = sorted.slice(0, max - 1);
  const rest = sorted.slice(max - 1);
  const others = rest.reduce(
    (acc, d) => ({ ...acc, value: acc.value + (d.value || 0), count: (acc.count || 0) + (d.count || 0) }),
    { name: 'Outros', value: 0, count: 0 } as AggregatedDataPoint
  );
  return [...top, others];
}

export function ConfigurableChart({ type, data: rawData, formatting, appearance, visualConfig, stackedData, stackedSeriesKeys, onDrilldown }: ConfigurableChartProps) {
  const tv = useTvMode();
  const baseConfig = appearance || DEFAULT_APPEARANCE;
  // Na TV o gráfico é lido de longe: rótulos de valor sempre visíveis.
  const config: AppearanceConfig = tv.tv ? { ...baseConfig, showDataLabels: true } : baseConfig;

  const isDateDimension = !!(visualConfig?.dimension as any)?.granularity;
  const cappable = type === 'bar' || type === 'bar_horizontal' || type === 'pie';
  const data =
    tv.tv && cappable && !isDateDimension ? capCategories(rawData, tv.maxCategories) : rawData;


  
  if (type !== 'gauge' && type !== 'indicator' && type !== 'bar_stacked' && type !== 'bubble_map' && type !== 'funnel' && type !== 'data_table' && type !== 'daily_performance' && type !== 'goal_tracker' && type !== 'scorecard' && type !== 'number' && (!data || data.length === 0)) {
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
        return <SalesLeadsScorecard fontScale={visualConfig?.appearance?.fontScale} valueColor={visualConfig?.appearance?.valueColor} config={visualConfig} />;
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
          seriesColors={config.paletteLocked ? undefined : visualConfig?.seriesColors}
          onDrilldown={onDrilldown}
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
    case 'daily_performance':
      return <DailyPerformanceTable config={visualConfig!} />;
    case 'goal_tracker':
      return <GoalTrackerVisual config={visualConfig!} />;
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
  const tv = useTvMode();
  const m = FONT_SCALE_MULTIPLIERS[appearance.fontScale || 'normal'] * tv.scale;
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
            maxBarSize={tv.tv ? 120 : 64}
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
                fill={(!appearance.paletteLocked && entry.color) || colors[index % colors.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function HorizontalBarChartView({ 
  data: allData, 
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
  const tv = useTvMode();
  const m = FONT_SCALE_MULTIPLIERS[appearance.fontScale || 'normal'] * tv.scale;
  const { ref, width, height } = useChartSize();

  const tickFont = Math.round(11 * m);
  const rowHeight = Math.max(26, Math.round(26 * m));
  const axisArea = 34;

  // Na TV não há rolagem: mostramos apenas as linhas que cabem na altura do card.
  const maxRows = tv.tv && height > 0 ? Math.max(3, Math.floor((height - axisArea) / rowHeight)) : Infinity;
  const rows = allData.length > maxRows ? allData.slice(0, maxRows) : allData;

  // Altura mínima por barra: se não couber, o card rola verticalmente (fora da TV)
  const needed = rows.length * rowHeight + axisArea;
  const scroll = !tv.tv && height > 0 && needed > height;
  const chartHeight = scroll ? needed : '100%';

  const longest = rows.reduce((a, d) => Math.max(a, String(d.name ?? '').length), 0);
  const maxLabelWidth = Math.max(70, Math.min(width * (tv.tv ? 0.3 : 0.34), tv.tv ? 300 : 200));
  const maxChars = Math.max(6, Math.floor(maxLabelWidth / (tickFont * 0.58)));
  const yWidth = Math.min(maxLabelWidth, approxTextWidth('x'.repeat(Math.min(longest, maxChars)), tickFont) + 12);

  const maxValueText = rows.reduce(
    (a, d) => Math.max(a, formatValueCompact(d.value, formatting.type).length),
    0
  );
  const rightMargin = appearance.showDataLabels
    ? Math.min(200, Math.round(maxValueText * tickFont * 0.62) + 16)
    : 16;

  return (
    <div ref={ref} className={`h-full w-full ${scroll ? 'overflow-y-auto overflow-x-hidden' : ''}`}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart layout="vertical" data={rows} margin={{ top: 8, right: rightMargin, left: 4, bottom: 8 }} barCategoryGap="22%">

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
            tick={(props: any) => {
              const { x, y, payload } = props;
              return (
                <text
                  x={x}
                  y={y}
                  dy={4}
                  textAnchor="end"
                  style={{ fontSize: tickFont, fill: 'hsl(var(--muted-foreground))' }}
                >
                  {truncateLabel(String(payload?.value ?? ''), maxChars)}
                </text>
              );
            }}
            tickLine={false}
            axisLine={false}
            width={Math.round(yWidth)}
            interval={0}
          />

          <Tooltip cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.35 }} content={<ChartTooltip formatting={formatting} showCount />} />
          <Bar 
            dataKey="value" 
            radius={[0, 6, 6, 0]}
            maxBarSize={tv.tv ? 46 : 28}
            onClick={(data) => onDrilldown?.(data.name)}
            style={{ cursor: onDrilldown ? 'pointer' : 'default' }}
          >
            {appearance.showDataLabels && (
              <LabelList
                dataKey="value"
                content={(props: any) => {
                  const { x, y, width: w, height: h, value } = props;
                  if (value === undefined || value === null) return null;
                  return (
                    <text
                      x={Number(x) + Number(w) + 8}
                      y={Number(y) + Number(h) / 2}
                      dominantBaseline="central"
                      textAnchor="start"
                      style={{ fontSize: tickFont, fill: 'hsl(var(--foreground))', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatValueCompact(Number(value), formatting.type)}
                    </text>
                  );
                }}
              />
            )}

            {rows.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={(!appearance.paletteLocked && entry.color) || colors[index % colors.length]}
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
  const tv = useTvMode();
  const m = FONT_SCALE_MULTIPLIERS[appearance.fontScale || 'normal'] * tv.scale;
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
            strokeWidth={tv.tv ? 4 : 2.5}
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
  const tv = useTvMode();
  const m = FONT_SCALE_MULTIPLIERS[appearance.fontScale || 'normal'] * tv.scale;
  const { ref, width, height } = useChartSize();

  const sideLegend = width >= 480 && data.length > 1;
  // Com legenda lateral não há espaço para rótulos externos: só a porcentagem.
  const compact = width > 0 && (sideLegend || width < 320 || height < 240 || data.length > 6);
  const labelFont = Math.round(11 * m);
  const legendWidth = Math.min(Math.max(width * 0.28, 130), 240);

  const legendItems = data.map((entry, index) => ({
    name: String(entry.name ?? ''),
    color: (!appearance.paletteLocked && entry.color) || colors[index % colors.length],
  }));

  return (
    <div ref={ref} className={`h-full w-full ${sideLegend ? 'flex items-center gap-2' : ''}`}>
      <div className={sideLegend ? 'h-full min-w-0 flex-1' : 'h-full w-full'}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="45%"
              outerRadius={compact ? '78%' : '68%'}
              paddingAngle={2}
              dataKey="value"
              label={renderPiePercentLabel(labelFont)}
              labelLine={false}
              onClick={(data) => onDrilldown?.(data.name)}
              style={{ cursor: onDrilldown ? 'pointer' : 'default', fontSize: labelFont }}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={(!appearance.paletteLocked && entry.color) || colors[index % colors.length]}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip formatting={formatting} showCount />} />
            {!sideLegend && data.length > 1 && (
              <Legend
                verticalAlign="bottom"
                content={<ChartLegendContent fontSize={labelFont} align="center" />}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>

      {sideLegend && (
        <div
          className="flex shrink-0 flex-col justify-center gap-1.5 overflow-hidden pr-1"
          style={{ width: legendWidth, fontSize: labelFont }}
        >
          {legendItems.map((item) => (
            <span key={item.name} className="flex items-center gap-1.5 leading-tight">
              <span
                aria-hidden
                className="inline-block shrink-0 rounded-[3px]"
                style={{
                  width: Math.round(labelFont * 0.78),
                  height: Math.round(labelFont * 0.78),
                  backgroundColor: item.color,
                }}
              />
              <span className="truncate font-medium tracking-tight text-muted-foreground" title={item.name}>
                {item.name}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

