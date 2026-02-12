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
import { ChartType, FormatType, AppearanceConfig, VisualConfig, COLOR_PALETTES, DEFAULT_APPEARANCE } from "../visual-builder/types";
import { ChartTooltip } from "./ChartTooltip";
import { ConfigurableScorecard } from "./ConfigurableScorecard";
import { ConfigurableRanking } from "./ConfigurableRanking";
import { ConfigurableCallCommercial } from "./ConfigurableCallCommercial";
import { formatValueCompact } from "@/lib/formula-evaluator";

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
  onDrilldown?: (groupName?: string) => void;
}

function getChartColors(palette: AppearanceConfig['colorPalette'] = 'professional'): string[] {
  return COLOR_PALETTES[palette] || COLOR_PALETTES.professional;
}

export function ConfigurableChart({ type, data, formatting, appearance, visualConfig, onDrilldown }: ConfigurableChartProps) {
  const config = appearance || DEFAULT_APPEARANCE;
  
  if (!data || data.length === 0) {
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
      return <ConfigurableRanking data={data} formatting={formatting} />;
    case 'call_commercial':
      return <ConfigurableCallCommercial data={data} formatting={formatting} hiddenUsers={visualConfig?.hiddenUsers} />;
    case 'bar':
      return <BarChartView data={data} formatting={formatting} appearance={config} onDrilldown={onDrilldown} />;
    case 'line':
      return <LineChartView data={data} formatting={formatting} appearance={config} onDrilldown={onDrilldown} />;
    case 'pie':
      return <PieChartView data={data} formatting={formatting} appearance={config} onDrilldown={onDrilldown} />;
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
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
          angle={-45}
          textAnchor="end"
          height={60}
          interval={0}
        />
        <YAxis
          tickFormatter={(value) => formatValueCompact(value, formatting.type)}
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
          width={60}
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
              formatter={(value: number) => formatValueCompact(value, formatting.type)}
              style={{ fontSize: 10, fill: 'hsl(var(--foreground))' }}
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
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
          angle={-45}
          textAnchor="end"
          height={60}
          interval={0}
        />
        <YAxis
          tickFormatter={(value) => formatValueCompact(value, formatting.type)}
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
          width={60}
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
              formatter={(value: number) => formatValueCompact(value, formatting.type)}
              style={{ fontSize: 10, fill: 'hsl(var(--foreground))' }}
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
          style={{ cursor: onDrilldown ? 'pointer' : 'default' }}
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
