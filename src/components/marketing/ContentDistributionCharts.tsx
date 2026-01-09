import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InstagramPost } from '@/hooks/useSocialMediaData';

interface ContentDistributionChartsProps {
  posts: InstagramPost[];
}

const FORMAT_COLORS: Record<string, string> = {
  reels: '#f97316', // orange-500
  carousel: '#3b82f6', // blue-500
  static: '#a855f7', // purple-500
};

const OBJECTIVE_COLORS: Record<string, string> = {
  growth: '#22c55e', // green-500
  connection: '#ec4899', // pink-500
  authority: '#6366f1', // indigo-500
  sales: '#eab308', // yellow-500
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
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {formatData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value} posts`, 'Quantidade']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
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
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {objectiveData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value} posts`, 'Quantidade']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
