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
import { ChartType, FormatType, AppearanceConfig, VisualConfig, COLOR_PALETTES, DEFAULT_APPEARANCE, FONT_SCALE_MULTIPLIERS } from "../visual-builder/types";
import { ChartTooltip } from "./ChartTooltip";
import { ConfigurableScorecard } from "./ConfigurableScorecard";
import { ConfigurableRanking } from "./ConfigurableRanking";
import { ConfigurableCallCommercial } from "./ConfigurableCallCommercial";
import { GaugeFromConfig } from "./ConfigurableGauge";
import { IndicatorFromConfig } from "./ConfigurableIndicator";
import { StackedHorizontalBarChart } from "./StackedHorizontalBarChart";
import { ConfigurableBubbleMap } from "./ConfigurableBubbleMap";
import { ConfigurableFunnel } from "./ConfigurableFunnel";
import { formatValueCompact, formatValueWithScale } from "@/lib/formula-evaluator";
import { StackedDataPoint } from "@/hooks/useStackedVisualData";

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

export function ConfigurableChart({ type, data, formatting, appearance, visualConfig, stackedData, stackedSeriesKeys, onDrilldown }: ConfigurableChartProps) {
  const config = appearance || DEFAULT_APPEARANCE;
  
  if (type !== 'gauge' && type !== 'indicator' && type !== 'bar_stacked' && type !== 'bubble_map' && type !== 'funnel' && (!data || data.length === 0)) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  switch (type) {
    case 'number':
    case 'scorecard':
      return <ConfigurableScorecard data={data} formatting={formatting} config={visualConfig} />;
    case 'ranking':
      return <ConfigurableRanking data={data} formatting={formatting} appearance={config} />;
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
        />
      );
    case 'line':
      return <LineChartView data={data} formatting={formatting} appearance={config} onDrilldown={onDrilldown} />;
    case 'pie':
      return <PieChartView data={data} formatting={formatting} appearance={config} onDrilldown={onDrilldown} />;
    case 'funnel':
      return <ConfigurableFunnel data={data} formatting={formatting} appearance={config} />;
    default:
      return <BarChartView data={data} formatting={formatting} appearance={config} onDrilldown={onDrilldown} />;
  }
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
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 10, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: Math.round(10 * m) }}
          className="text-muted-foreground"
          angle={-35}
          textAnchor="end"
          height={100}
          interval={0}
        />
        <YAxis
          tickFormatter={(value) => formatValueCompact(value, formatting.type)}
          tick={{ fontSize: Math.round(11 * m) }}
          className="text-muted-foreground"
          width={Math.round(80 * m)}
        />
        <Tooltip content={<ChartTooltip formatting={formatting} showCount />} />
        <Bar 
          dataKey="value" 
          radius={[4, 4, 0, 0]}
          onClick={(data) => onDrilldown?.(data.name)}
          style={{ cursor: onDrilldown ? 'pointer' : 'default' }}
        >
          {appearance.showDataLabels && (
            <LabelList 
              dataKey="value" 
              position="top" 
              content={({ x, y, value, index, width: barWidth }) => {
                if (data.length > 10 && (typeof index !== 'number' || index % 2 !== 0)) return null;
                const centerX = (x as number) + (barWidth as number) / 2;
                return (
                  <text x={centerX} y={(y as number) - 12} textAnchor="middle"
                    style={{ fontSize: Math.round(10 * m), fill: 'hsl(var(--foreground))' }}>
                    {formatValueCompact(value as number, formatting.type)}
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
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart layout="vertical" data={data} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
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
          width={120}
          interval={0}
        />
        <Tooltip content={<ChartTooltip formatting={formatting} showCount />} />
        <Bar 
          dataKey="value" 
          radius={[0, 4, 4, 0]}
          onClick={(data) => onDrilldown?.(data.name)}
          style={{ cursor: onDrilldown ? 'pointer' : 'default' }}
        >
          {appearance.showDataLabels && (
            <LabelList 
              dataKey="value" 
              position="right" 
              formatter={(value: number) => formatValueCompact(value, formatting.type)}
              style={{ fontSize: Math.round(10 * m), fill: 'hsl(var(--foreground))' }}
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
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 20, right: 40, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: Math.round(11 * m) }}
          className="text-muted-foreground"
          angle={-45}
          textAnchor="end"
          height={60}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(value) => formatValueCompact(value, formatting.type)}
          tick={{ fontSize: Math.round(11 * m) }}
          className="text-muted-foreground"
          width={Math.round(80 * m)}
        />
        <Tooltip content={<ChartTooltip formatting={formatting} showCount />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={primaryColor}
          strokeWidth={2}
          dot={{ fill: primaryColor, strokeWidth: 2 }}
          activeDot={{ r: 6, fill: primaryColor, onClick: (_, e: any) => onDrilldown?.(e?.payload?.name) }}
        >
          {appearance.showDataLabels && (
            <LabelList 
              dataKey="value" 
              position="top" 
              content={({ x, y, value, index }) => {
                if (typeof index !== 'number' || index % 2 !== 0) return null;
                if (!value || value === 0) return null;
                return (
                  <text x={x} y={(y as number) - 8} textAnchor="middle"
                    style={{ fontSize: Math.round(10 * m), fill: 'hsl(var(--foreground))' }}>
                    {formatValueCompact(value as number, formatting.type)}
                  </text>
                );
              }}
            />
          )}
        </Line>
      </LineChart>
    </ResponsiveContainer>
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
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius="40%"
          outerRadius="70%"
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
          labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
          onClick={(data) => onDrilldown?.(data.name)}
          style={{ cursor: onDrilldown ? 'pointer' : 'default', fontSize: Math.round(12 * m) }}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color || colors[index % colors.length]}
            />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip formatting={formatting} showCount />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
