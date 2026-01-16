import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InstagramPost } from '@/hooks/useSocialMediaData';

interface ContentDistributionChartsProps {
  posts: InstagramPost[];
}

const FORMAT_COLORS: Record<string, string> = {
  reels: '#8B5CF6', // Violet - vibrant
  carousel: '#06B6D4', // Cyan - vibrant
  static: '#F59E0B', // Amber - vibrant
};

const OBJECTIVE_COLORS: Record<string, string> = {
  growth: '#10B981', // Emerald - vibrant
  connection: '#EC4899', // Pink - vibrant
  authority: '#6366F1', // Indigo - vibrant
  sales: '#F59E0B', // Amber - vibrant
};

const FORMAT_LABELS: Record<string, string> = {
  reels: 'Reels',
  carousel: 'Carrossel',
  static: 'Estático',
};

const OBJECTIVE_LABELS: Record<string, string> = {
  growth: 'Crescimento',
  connection: 'Conexão',
  authority: 'Autoridade',
  sales: 'Vendas',
};

export function ContentDistributionCharts({ posts }: ContentDistributionChartsProps) {
  const formatData = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((post) => {
      const format = post.post_type || 'static';
      counts[format] = (counts[format] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: FORMAT_LABELS[name] || name,
      value,
      fill: FORMAT_COLORS[name] || 'hsl(var(--muted))',
    }));
  }, [posts]);

  const objectiveData = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((post) => {
      const objective = post.ai_objective || 'growth';
      counts[objective] = (counts[objective] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: OBJECTIVE_LABELS[name] || name,
      value,
      fill: OBJECTIVE_COLORS[name] || 'hsl(var(--muted))',
    }));
  }, [posts]);

  if (posts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Nenhum post para exibir gráficos.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Por Formato</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={formatData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                  animationDuration={800}
                  label={({ name, percent, cx, cy, midAngle, outerRadius }) => {
                    const RADIAN = Math.PI / 180;
                    const radius = outerRadius + 28;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return (
                      <text
                        x={x}
                        y={y}
                        fill="hsl(var(--foreground))"
                        textAnchor={x > cx ? 'start' : 'end'}
                        dominantBaseline="central"
                        className="text-xs font-medium"
                      >
                        {`${name} ${(percent * 100).toFixed(0)}%`}
                      </text>
                    );
                  }}
                  labelLine={false}
                >
                  {formatData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.fill}
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value} posts`, 'Quantidade']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Por Objetivo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={objectiveData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                  animationDuration={800}
                  label={({ name, percent, cx, cy, midAngle, outerRadius }) => {
                    const RADIAN = Math.PI / 180;
                    const radius = outerRadius + 28;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return (
                      <text
                        x={x}
                        y={y}
                        fill="hsl(var(--foreground))"
                        textAnchor={x > cx ? 'start' : 'end'}
                        dominantBaseline="central"
                        className="text-xs font-medium"
                      >
                        {`${name} ${(percent * 100).toFixed(0)}%`}
                      </text>
                    );
                  }}
                  labelLine={false}
                >
                  {objectiveData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.fill}
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value} posts`, 'Quantidade']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
