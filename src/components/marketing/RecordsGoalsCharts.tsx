import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export const METRICS = [
  { key: 'views', label: 'Visualizações' },
  { key: 'reach', label: 'Contas alcançadas' },
  { key: 'interactions', label: 'Interações' },
  { key: 'followers', label: 'Seguidores' },
  { key: 'profile_visits', label: 'Visitas ao perfil' },
  { key: 'link_clicks', label: 'Cliques no link externo' },
] as const;

export type MetricKey = (typeof METRICS)[number]['key'];

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export type WeeklyRow = { year: number; month: number; week: number } & Record<MetricKey, number>;
export type GoalRow = { year: number; month: number } & Record<MetricKey, number>;

type Period = 'today' | '7d' | '30d' | 'month' | 'quarter' | 'year';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'month', label: 'Este mês' },
  { value: 'quarter', label: 'Este trimestre' },
  { value: 'year', label: 'Este ano' },
];

const fmt = (n: number) => n.toLocaleString('pt-BR');

/** Semana do mês (1-5) para uma data */
const weekOfMonth = (d: Date) => Math.min(5, Math.floor((d.getDate() - 1) / 7) + 1);

interface Props {
  weekly: WeeklyRow[];
  goals: GoalRow[];
  year: number;
  month: number;
}

export function RecordsGoalsCharts({ weekly, goals, year, month }: Props) {
  const [metric, setMetric] = useState<MetricKey>('views');
  const [period, setPeriod] = useState<Period>('month');

  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const currentWeek = isCurrentMonth ? weekOfMonth(now) : 5;

  const sumWeek = (m: number, w: number) =>
    weekly.filter((r) => r.month === m && r.week === w).reduce((s, r) => s + (Number(r[metric]) || 0), 0);
  const sumMonth = (m: number) =>
    weekly.filter((r) => r.month === m).reduce((s, r) => s + (Number(r[metric]) || 0), 0);
  const goalMonth = (m: number) => {
    const g = goals.find((x) => x.month === m);
    return g ? Number(g[metric]) || 0 : 0;
  };

  const { data, goalLabel, current, previous, goalTotal } = useMemo(() => {
    // Semanal (períodos curtos e mensais)
    if (period === 'today' || period === '7d' || period === '30d' || period === 'month') {
      const weeks = period === 'today' || period === '7d' ? [Math.max(1, currentWeek - 1), currentWeek] : [1, 2, 3, 4, 5];
      const weeklyGoal = goalMonth(month) / 5;
      const rows = weeks.map((w) => ({
        name: `Sem ${w}`,
        valor: sumWeek(month, w),
        meta: Math.round(weeklyGoal),
      }));
      const cur = rows.length ? rows[rows.length - 1].valor : 0;
      const prev = rows.length > 1 ? rows[rows.length - 2].valor : 0;
      const total = period === 'today' || period === '7d' ? Math.round(weeklyGoal) : goalMonth(month);
      const realized = period === 'today' || period === '7d' ? cur : sumMonth(month);
      return {
        data: rows,
        goalLabel: 'Meta semanal',
        current: realized,
        previous: prev,
        goalTotal: total,
      };
    }

    // Mensal (trimestre / ano)
    const months =
      period === 'quarter'
        ? (() => {
            const start = Math.floor((month - 1) / 3) * 3 + 1;
            return [start, start + 1, start + 2];
          })()
        : Array.from({ length: 12 }, (_, i) => i + 1);

    const rows = months.map((m) => ({
      name: MONTHS_SHORT[m - 1],
      valor: sumMonth(m),
      meta: goalMonth(m),
    }));
    const realized = rows.reduce((s, r) => s + r.valor, 0);
    const total = rows.reduce((s, r) => s + r.meta, 0);
    const idx = months.indexOf(month);
    return {
      data: rows,
      goalLabel: 'Meta mensal',
      current: realized,
      previous: idx > 0 ? rows[idx - 1].valor : 0,
      goalTotal: total,
    };
  }, [period, metric, weekly, goals, month, currentWeek]);

  const pct = goalTotal > 0 ? Math.round((current / goalTotal) * 100) : 0;
  const growth = previous > 0 ? ((current - previous) / previous) * 100 : null;
  const metricLabel = METRICS.find((m) => m.key === metric)?.label ?? '';

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Comparativo de crescimento</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRICS.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ToggleGroup
              type="single"
              size="sm"
              value={period}
              onValueChange={(v) => v && setPeriod(v as Period)}
              className="flex-wrap"
            >
              {PERIODS.map((p) => (
                <ToggleGroupItem key={p.value} value={p.value} className="px-3">
                  {p.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{metricLabel} no período</p>
            <p className="text-2xl font-semibold">{fmt(current)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Meta do período</p>
            <p className="text-2xl font-semibold">{fmt(goalTotal)}</p>
            <Progress value={Math.min(100, pct)} className="mt-2 h-1.5" />
            <p className="mt-1 text-xs text-muted-foreground">{pct}% da meta</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Crescimento vs. período anterior</p>
            {growth === null ? (
              <p className="text-2xl font-semibold text-muted-foreground">—</p>
            ) : (
              <Badge
                variant="outline"
                className={`mt-1 gap-1 text-base ${growth >= 0 ? 'text-emerald-600 border-emerald-600/40' : 'text-destructive border-destructive/40'}`}
              >
                {growth >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {growth >= 0 ? '+' : ''}
                {growth.toFixed(1)}%
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              />
              <Tooltip
                formatter={(v: number, name: string) => [fmt(Number(v)), name === 'valor' ? metricLabel : goalLabel]}
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  color: 'hsl(var(--popover-foreground))',
                }}
              />
              <Legend formatter={(v) => (v === 'valor' ? metricLabel : goalLabel)} />
              <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.meta > 0 && d.valor >= d.meta ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.45)'}
                  />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="meta"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
