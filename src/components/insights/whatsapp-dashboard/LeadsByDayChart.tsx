import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { TrendingUp } from "lucide-react";

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

const SOURCE_COLORS: Record<string, string> = {
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
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Leads Novos por Dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] animate-pulse bg-muted rounded" />
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
    ...d.sources,
  }));

  const totalLeads = data.reduce((sum, d) => sum + d.count, 0);
  const sourcesArray = Array.from(allSources);

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Leads Novos por Dia
            </CardTitle>
          </div>
          <div className="flex items-center gap-4">
            {/* Legend */}
            <div className="flex items-center gap-3 text-xs">
              {sourcesArray.slice(0, 5).map((source) => (
                <div key={source} className="flex items-center gap-1">
                  <div 
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: SOURCE_COLORS[source] || '#6B7280' }}
                  />
                  <span className="text-muted-foreground">{source}</span>
                </div>
              ))}
            </div>
            {/* Total */}
            <div className="text-right">
              <span className="text-2xl font-bold text-primary">{totalLeads}</span>
              <p className="text-xs text-muted-foreground">Total 14 dias</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
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
            {sourcesArray.slice(0, 5).map((source) => (
              <Bar
                key={source}
                dataKey={source}
                stackId="sources"
                fill={SOURCE_COLORS[source] || '#6B7280'}
                radius={[0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
