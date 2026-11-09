import { useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  Bar,
  CartesianGrid,
  LabelList,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Target, TrendingDown, TrendingUp } from 'lucide-react';
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
const compact = (n: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

function RecordsTooltip({ active, payload, label, metricLabel, goalLabel }: {
  active?: boolean;
  payload?: { payload: { valor: number; meta: number } }[];
  label?: string | number;
  metricLabel: string;
  goalLabel: string;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="min-w-[200px] rounded-lg border bg-popover p-3 text-popover-foreground shadow-md">
      <p className="mb-3 border-b pb-2 text-xs font-semibold">{label}</p>
      <div className="flex items-center justify-between gap-5 text-xs">
        <span className="flex items-center gap-2 text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-primary" />{metricLabel}</span>
        <span className="font-semibold tabular-nums">{fmt(row.valor)}</span>
      </div>
      {row.meta > 0 && (
        <>
          <div className="mt-2 flex items-center justify-between gap-5 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground"><span className="w-2 border-t-2 border-dashed border-accent" />{goalLabel}</span>
            <span className="font-semibold tabular-nums">{fmt(row.meta)}</span>
          </div>
          <p className="mt-3 border-t pt-2 text-xs font-medium text-accent">{Math.round(row.valor / row.meta * 100)}% da meta</p>
        </>
      )}
    </div>
  );
}

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
  const reducedMotion = useReducedMotion();

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
  const hasGoal = data.some((row) => row.meta > 0);

  return (
    <Card className="min-w-0 overflow-hidden rounded-lg">
      <CardHeader className="gap-5 pb-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Comparativo de crescimento</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
              <SelectTrigger aria-label="Métrica do gráfico" className="h-9 w-[210px] max-w-full bg-background">
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
              className="flex-wrap justify-start gap-1"
            >
              {PERIODS.map((p) => (
                <ToggleGroupItem key={p.value} value={p.value} className="h-8 rounded-md px-2.5 text-xs data-[state=on]:bg-primary/15 data-[state=on]:text-foreground">
                  {p.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <div className="grid gap-4 border-y py-4 sm:grid-cols-3 sm:gap-6">
          <div className="min-w-0 sm:border-r sm:pr-6">
            <p className="text-xs text-muted-foreground">{metricLabel} no período</p>
            <p className="mt-1.5 text-3xl font-semibold tabular-nums">{fmt(current)}</p>
          </div>
          <div className="min-w-0 sm:border-r sm:pr-6">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Target className="h-3.5 w-3.5" />Meta do período</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums">{goalTotal > 0 ? fmt(goalTotal) : '—'}</p>
            {goalTotal > 0 ? (
              <div className="mt-2 flex items-center gap-2">
                <Progress value={Math.min(100, pct)} className="h-1.5 flex-1" />
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{pct}%</span>
              </div>
            ) : <p className="mt-1 text-xs text-muted-foreground">Sem meta definida</p>}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Crescimento vs. período anterior</p>
            {growth === null ? (
              <><p className="mt-1.5 text-2xl font-semibold text-muted-foreground">—</p><p className="mt-1 text-xs text-muted-foreground">Sem base de comparação</p></>
            ) : (
              <Badge
                variant="outline"
                className={`mt-2 gap-1 text-base tabular-nums ${growth >= 0 ? 'text-success border-success/40 bg-success/5' : 'text-destructive border-destructive/40 bg-destructive/5'}`}
              >
                {growth >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {growth >= 0 ? '+' : ''}
                {growth.toFixed(1)}%
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{MONTHS_SHORT[month - 1]} {year}</span>
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" />{metricLabel}</span>
            {hasGoal && <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-accent" />{goalLabel}</span>}
          </div>
        </div>
        <div className="h-[280px] w-full sm:h-[300px]" role="img" aria-label={`${metricLabel} por ${period === 'quarter' || period === 'year' ? 'mês' : 'semana'}: ${data.map((row) => `${row.name}: ${fmt(row.valor)}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart accessibilityLayer data={data} barCategoryGap="28%" margin={{ top: 26, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 5" strokeOpacity={0.65} vertical={false} />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickMargin={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                width={64}
                tickMargin={8}
                tickCount={5}
                domain={[0, 'auto']}
                tickLine={false}
                axisLine={false}
                tickFormatter={compact}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--primary) / 0.06)', radius: 6 }}
                content={<RecordsTooltip metricLabel={metricLabel} goalLabel={goalLabel} />}
              />
              <Bar dataKey="valor" name={metricLabel} fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} maxBarSize={64} isAnimationActive={!reducedMotion} animationDuration={550}>
                <LabelList dataKey="valor" position="top" offset={10} fill="hsl(var(--foreground))" fontSize={11} fontWeight={600} formatter={(value: number) => value > 0 ? compact(value) : ''} />
              </Bar>
              {hasGoal && <Line
                type="monotone"
                dataKey="meta"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 4, fill: 'hsl(var(--accent))', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                isAnimationActive={!reducedMotion}
              />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
