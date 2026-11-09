import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Crown, Eye, FileText, Heart, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface SocialProfileMetric {
  id: string;
  username: string;
  display_name: string | null;
  followers_count: number;
  period_posts_count: number;
  avg_likes: number;
  avg_comments: number;
  avg_engagement: number;
  total_reach: number;
}

type MetricKey = 'followers_count' | 'total_reach' | 'period_posts_count' | 'avg_engagement' | 'avg_likes' | 'avg_comments';

const METRICS: Array<{ key: MetricKey; label: string }> = [
  { key: 'total_reach', label: 'Alcance no período' },
  { key: 'followers_count', label: 'Seguidores' },
  { key: 'avg_engagement', label: 'Engajamento médio' },
  { key: 'period_posts_count', label: 'Posts no período' },
  { key: 'avg_likes', label: 'Média de curtidas' },
  { key: 'avg_comments', label: 'Média de comentários' },
];

const COLORS = [
  'hsl(var(--chart-1, var(--primary)))',
  'hsl(var(--chart-2, 173 58% 39%))',
  'hsl(var(--chart-3, 43 74% 49%))',
  'hsl(var(--chart-4, 340 75% 55%))',
];

const compact = (value: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const full = (value: number) => Math.round(value).toLocaleString('pt-BR');
const decimal = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

function ComparisonTooltip({ active, payload, metric, total }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const isPercent = metric.key === 'avg_engagement';
  const share = !isPercent && total > 0 ? (row.value / total) * 100 : null;
  return (
    <div className="min-w-[220px] rounded-xl border bg-popover p-3.5 text-popover-foreground shadow-lg">
      <div className="mb-2.5 flex items-center gap-2 border-b pb-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />
        <p className="text-xs font-semibold">{row.name}</p>
      </div>
      <div className="flex items-center justify-between gap-6 text-xs">
        <span className="text-muted-foreground">{metric.label}</span>
        <span className="text-sm font-semibold tabular-nums">{isPercent ? `${decimal(row.value)}%` : full(row.value)}</span>
      </div>
      {share !== null && (
        <div className="mt-2 flex items-center justify-between gap-6 text-xs">
          <span className="text-muted-foreground">Participação no total</span>
          <span className="font-medium tabular-nums">{decimal(share)}%</span>
        </div>
      )}
    </div>
  );
}

export function SocialProfileComparison({ profiles }: { profiles: SocialProfileMetric[] }) {
  const [metricKey, setMetricKey] = useState<MetricKey>('total_reach');
  const metric = METRICS.find((item) => item.key === metricKey)!;

  const data = useMemo(() => profiles
    .map((profile, index) => ({
      id: profile.id,
      name: `@${profile.username}`,
      value: Number(profile[metricKey] || 0),
      color: COLORS[index % COLORS.length],
    }))
    .sort((a, b) => b.value - a.value), [profiles, metricKey]);

  const total = data.reduce((sum, row) => sum + row.value, 0);
  const leader = data[0];
  const byReach = [...profiles].sort((a, b) => b.total_reach - a.total_reach)[0];
  const byEngagement = [...profiles].sort((a, b) => b.avg_engagement - a.avg_engagement)[0];
  const byPosts = [...profiles].sort((a, b) => b.period_posts_count - a.period_posts_count)[0];
  const highlights = [
    { label: 'Maior alcance', profile: byReach, value: compact(byReach?.total_reach || 0), icon: Eye },
    { label: 'Melhor engajamento', profile: byEngagement, value: `${decimal(byEngagement?.avg_engagement || 0)}%`, icon: Heart },
    { label: 'Mais publicações', profile: byPosts, value: full(byPosts?.period_posts_count || 0), icon: FileText },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Comparativo entre perfis</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Ranking visual para identificar quem lidera cada métrica.</p>
              </div>
            </div>
            <Select value={metricKey} onValueChange={(value) => setMetricKey(value as MetricKey)}>
              <SelectTrigger className="h-9 w-[210px] bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {METRICS.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div style={{ height: Math.max(250, profiles.length * 72 + 80) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 8, right: 70, bottom: 8, left: 8 }} barCategoryGap="28%">
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={compact} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={125} tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.35)' }} content={<ComparisonTooltip metric={metric} total={total} />} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={34} animationDuration={650}>
                  {data.map((row) => <Cell key={row.id} fill={row.color} />)}
                  <LabelList dataKey="value" position="right" formatter={(value: number) => metricKey === 'avg_engagement' ? `${decimal(value)}%` : compact(value)} style={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {leader && (
            <div className="mt-2 flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
              <Crown className="h-3.5 w-3.5 text-primary" />
              <span><strong className="font-semibold text-foreground">{leader.name}</strong> lidera em {metric.label.toLowerCase()}.</span>
              <Badge variant="secondary" className="ml-auto tabular-nums">{metricKey === 'avg_engagement' ? `${decimal(leader.value)}%` : full(leader.value)}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b bg-muted/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/10">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Leitura rápida</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Destaques do período</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {highlights.map(({ label, profile, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="truncate text-sm font-semibold">@{profile?.username || '—'}</p>
              </div>
              <span className="text-sm font-bold tabular-nums text-primary">{value}</span>
            </div>
          ))}
          <p className="p-4 text-xs leading-relaxed text-muted-foreground">
            Use o seletor do gráfico para alternar a métrica. A tabela abaixo mantém todos os números para uma análise detalhada.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
