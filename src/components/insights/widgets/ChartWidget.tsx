import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { WidgetType, MetricType, GroupByType } from "./types";

interface ChartWidgetProps {
  type: WidgetType;
  data: any[];
  metric: MetricType;
  groupBy: GroupByType;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7c43",
  "#a05195",
];

export function ChartWidget({ type, data, metric, groupBy }: ChartWidgetProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
        Sem dados para exibir
      </div>
    );
  }

  // Determine which field to use for the value based on the data structure
  const getValueKey = () => {
    const firstItem = data[0];
    if (firstItem.value !== undefined) return "value";
    if (firstItem.revenue !== undefined) return "revenue";
    if (firstItem.count !== undefined) return "count";
    if (firstItem.amount !== undefined) return "amount";
    if (firstItem.total !== undefined) return "total";
    return "value";
  };

  const getNameKey = () => {
    const firstItem = data[0];
    if (firstItem.name !== undefined) return "name";
    if (firstItem.month !== undefined) return "month";
    if (firstItem.stage !== undefined) return "stage";
    if (firstItem.user !== undefined) return "user";
    if (firstItem.product !== undefined) return "product";
    if (firstItem.reason !== undefined) return "reason";
    if (firstItem.label !== undefined) return "label";
    return "name";
  };

  const valueKey = getValueKey();
  const nameKey = getNameKey();

  const formatValue = (val: number) => {
    if (metric === "revenue" || metric === "avg_ticket") {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        notation: val >= 1000000 ? "compact" : "standard",
        maximumFractionDigits: 0,
      }).format(val);
    }
    if (metric === "conversion") {
      return `${val.toFixed(1)}%`;
    }
    return new Intl.NumberFormat("pt-BR").format(val);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3">
          <p className="font-medium">{label || payload[0].payload[nameKey]}</p>
          <p className="text-sm text-muted-foreground">
            {formatValue(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Bar Chart
  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey={nameKey}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="fill-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => formatValue(val)}
            className="fill-muted-foreground"
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey={valueKey}
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Line Chart
  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey={nameKey}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="fill-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => formatValue(val)}
            className="fill-muted-foreground"
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey={valueKey}
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: "hsl(var(--primary))", r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Pie Chart
  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius="40%"
            outerRadius="80%"
            paddingAngle={2}
            label={({ name, percent }) =>
              `${name}: ${(percent * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return null;
}
