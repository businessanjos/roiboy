import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";

interface LeadsByDay {
  date: string;
  label: string;
  count: number;
  sources: Record<string, number>;
}

interface LeadsByDayChartProps {
  data: LeadsByDay[];
  isLoading?: boolean;
}

const COLORS = {
  'WhatsApp': '#25D366',
  'Instagram': '#E1306C',
  'Facebook': '#1877F2',
  'Site': '#6366f1',
  'Indicação': '#F59E0B',
  'Outros': '#6B7280',
};

export function LeadsByDayChart({ data, isLoading }: LeadsByDayChartProps) {
  if (isLoading) {
    return (
      <Card className="col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Leads por Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  // Get all unique sources
  const allSources = new Set<string>();
  data.forEach(d => {
    Object.keys(d.sources).forEach(s => allSources.add(s));
  });

  const chartData = data.map(d => ({
    label: d.label,
    total: d.count,
    ...d.sources,
  }));

  const totalLeads = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Leads por Dia (Últimos 14 dias)</CardTitle>
        <span className="text-sm font-medium text-muted-foreground">
          Total: <span className="text-foreground font-bold">{totalLeads}</span>
        </span>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Line 
              type="monotone" 
              dataKey="total" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))', r: 3 }}
              name="Total"
            />
            {Array.from(allSources).slice(0, 5).map((source) => (
              <Line
                key={source}
                type="monotone"
                dataKey={source}
                stroke={COLORS[source as keyof typeof COLORS] || '#6B7280'}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
                name={source}
              />
            ))}
            <Legend />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
