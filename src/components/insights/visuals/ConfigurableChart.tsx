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
  Legend,
} from "recharts";
import { ChartType, FormatType } from "../visual-builder/types";
import { ChartTooltip } from "./ChartTooltip";
import { ConfigurableScorecard } from "./ConfigurableScorecard";
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
  onDrilldown?: (groupName?: string) => void;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
  '#00C49F',
];

export function ConfigurableChart({ type, data, formatting, onDrilldown }: ConfigurableChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  switch (type) {
    case 'number':
      return <ConfigurableScorecard data={data} formatting={formatting} />;
    case 'bar':
      return <BarChartView data={data} formatting={formatting} onDrilldown={onDrilldown} />;
    case 'line':
      return <LineChartView data={data} formatting={formatting} onDrilldown={onDrilldown} />;
    case 'pie':
      return <PieChartView data={data} formatting={formatting} onDrilldown={onDrilldown} />;
    default:
      return <BarChartView data={data} formatting={formatting} onDrilldown={onDrilldown} />;
  }
}

function BarChartView({ data, formatting, onDrilldown }: { data: AggregatedDataPoint[]; formatting: ConfigurableChartProps['formatting']; onDrilldown?: (groupName?: string) => void }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
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
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartView({ data, formatting, onDrilldown }: { data: AggregatedDataPoint[]; formatting: ConfigurableChartProps['formatting']; onDrilldown?: (groupName?: string) => void }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
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
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
          activeDot={{ r: 6, fill: 'hsl(var(--primary))', onClick: (_, e: any) => onDrilldown?.(e?.payload?.name) }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PieChartView({ data, formatting, onDrilldown }: { data: AggregatedDataPoint[]; formatting: ConfigurableChartProps['formatting']; onDrilldown?: (groupName?: string) => void }) {
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
              fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip formatting={formatting} showCount />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
