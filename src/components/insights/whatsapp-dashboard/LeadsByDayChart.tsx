import { Card, CardContent } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";

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

  if (isLoading) {
    return (
      <CollapsibleSection
        title="Leads Novos por Dia"
        icon={<TrendingUp className="h-5 w-5 text-primary" />}
      >
        <Card>
          <CardContent className="pt-4">
            <div className="h-[280px] animate-pulse bg-muted rounded" />
          </CardContent>
        </Card>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      title="Leads Novos por Dia"
      icon={<TrendingUp className="h-5 w-5 text-primary" />}
      rightContent={
        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="hidden md:flex items-center gap-3 text-xs">
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
      }
    >
      <Card>
        <CardContent className="pt-4">
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
    </CollapsibleSection>
  );
}
