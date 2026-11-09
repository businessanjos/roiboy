import { useId, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Crown, Target, UsersRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { supabase } from '@/integrations/supabase/client';
import { METRICS, type MetricKey } from './RecordsGoalsCharts';
import { calculateCompareAnalytics } from './recordsCompareAnalytics';

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');
const compact = (n: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const truncate = (value: string, length = 24) => value.length > length ? `${value.slice(0, length - 1)}…` : value;

/** Cores por posição — usam tokens do design system */
const SERIES_COLORS = [
  'hsl(var(--chart-1, var(--primary)))',
  'hsl(var(--chart-2, 173 58% 39%))',
  'hsl(var(--chart-3, 43 74% 49%))',
  'hsl(var(--chart-4, 340 75% 55%))',
];

export interface CompareProfile {
  id: string;
  username: string;
  display_name?: string | null;
}

interface Props {
  profiles: CompareProfile[];
  year: number;
  month: number;
}

type Scope = 'month' | 'year';

function CompareTooltip({ active, payload, label: periodLabel, metricLabel, scope, total, leaderId, leaderValue, profiles }: any) {
  if (!active || !payload?.length) return null;

  if (scope === 'month') {
    const row = payload[0].payload;
    const share = total > 0 ? (row.value / total) * 100 : 0;
    const difference = Math.max(0, leaderValue - row.value);
    return (
      <div className="min-w-[230px] rounded-xl border bg-popover p-3.5 text-popover-foreground shadow-lg">
        <div className="mb-3 flex items-center gap-2 border-b pb-2.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />
          <p className="text-xs font-semibold">{row.name}</p>
        </div>
        <div className="flex items-center justify-between gap-6 text-xs">
          <span className="text-muted-foreground">{metricLabel}</span>
          <span className="text-sm font-semibold tabular-nums">{fmt(row.value)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-6 text-xs">
          <span className="text-muted-foreground">Participação no total</span>
          <span className="font-medium tabular-nums">{share.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
        </div>
        {row.goal > 0 && (
          <div className="mt-2 flex items-center justify-between gap-6 text-xs">
            <span className="text-muted-foreground">Atingimento da meta</span>
            <span className="font-medium tabular-nums">{Math.round((row.value / row.goal) * 100)}%</span>
          </div>
        )}
        {row.id !== leaderId && leaderValue > 0 && (
          <p className="mt-3 border-t pt-2.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{fmt(difference)}</span> atrás da liderança
          </p>
        )}
      </div>
    );
  }

  const periodTotal = payload.reduce((sum: number, entry: any) => sum + Number(entry.value ?? 0), 0);
  return (
    <div className="min-w-[250px] rounded-xl border bg-popover p-3.5 text-popover-foreground shadow-lg">
      <div className="mb-3 flex items-center justify-between gap-5 border-b pb-2.5">
        <p className="text-xs font-semibold">{periodLabel}</p>
        <p className="text-xs text-muted-foreground">Total: <span className="font-semibold text-foreground tabular-nums">{fmt(periodTotal)}</span></p>
      </div>
      <div className="space-y-2.5">
        {payload.map((entry: any) => {
          const profile = profiles.find((item: CompareProfile) => item.id === entry.dataKey);
          const value = Number(entry.value ?? 0);
          const share = periodTotal > 0 ? (value / periodTotal) * 100 : 0;
          return (
            <div key={entry.dataKey} className="grid grid-cols-[1fr_auto] items-center gap-x-5 gap-y-0.5 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.color }} />
                <span className="truncate">{profile?.display_name || `@${profile?.username ?? ''}`}</span>
              </span>
              <span className="font-semibold tabular-nums">{fmt(value)}</span>
              <span />
              <span className="text-[11px] text-muted-foreground tabular-nums">{share.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do mês</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RecordsCompareView({ profiles, year, month }: Props) {
  const [metric, setMetric] = useState<MetricKey>('views');
  const [scope, setScope] = useState<Scope>('month');
  const chartId = useId().replace(/:/g, '');

  const ids = profiles.map((p) => p.id);
  const idKey = [...ids].sort().join(',');

  const { data, isLoading } = useQuery({
    queryKey: ['records-compare', idKey, year],
    enabled: ids.length > 0,
    queryFn: async () => {
      const [weekly, goals] = await Promise.all([
        supabase
          .from('social_manual_weekly_metrics')
          .select('*')
          .in('profile_id', ids)
          .eq('year', year),
        supabase
          .from('social_manual_monthly_goals')
          .select('*')
          .in('profile_id', ids)
          .eq('year', year),
      ]);
      if (weekly.error) throw weekly.error;
      if (goals.error) throw goals.error;
      return { weekly: weekly.data ?? [], goals: goals.data ?? [] };
    },
  });

  /** total por perfil x métrica no escopo selecionado */
  const totals = useMemo(() => {
    const map: Record<string, Record<MetricKey, number>> = {};
    profiles.forEach((p) => {
      map[p.id] = METRICS.reduce((acc, m) => ({ ...acc, [m.key]: 0 }), {} as Record<MetricKey, number>);
    });
    (data?.weekly ?? []).forEach((r: any) => {
      if (!map[r.profile_id]) return;
      if (scope === 'month' && r.month !== month) return;
      METRICS.forEach((m) => {
        map[r.profile_id][m.key] += Number(r[m.key] ?? 0);
      });
    });
    return map;
  }, [data, profiles, scope, month]);

  const goalTotals = useMemo(() => {
    const map: Record<string, Record<MetricKey, number>> = {};
    profiles.forEach((p) => {
      map[p.id] = METRICS.reduce((acc, m) => ({ ...acc, [m.key]: 0 }), {} as Record<MetricKey, number>);
    });
    (data?.goals ?? []).forEach((r: any) => {
      if (!map[r.profile_id]) return;
      if (scope === 'month' && r.month !== month) return;
      METRICS.forEach((m) => {
        map[r.profile_id][m.key] += Number(r[m.key] ?? 0);
      });
    });
    return map;
  }, [data, profiles, scope, month]);

  /** melhor perfil por métrica */
  const leaders = useMemo(() => {
    const out: Record<string, string | null> = {};
    METRICS.forEach((m) => {
      let best: string | null = null;
      let bestVal = 0;
      profiles.forEach((p) => {
        const v = totals[p.id]?.[m.key] ?? 0;
        if (v > bestVal) {
          best = p.id;
          bestVal = v;
        }
      });
      out[m.key] = bestVal > 0 ? best : null;
    });
    return out;
  }, [totals, profiles]);

  /** série mensal da métrica selecionada */
  const chartData = useMemo(() => {
    const months = scope === 'month' ? [month] : Array.from({ length: 12 }, (_, i) => i + 1);
    return months.map((mo) => {
      const row: any = { name: MONTHS_SHORT[mo - 1] };
      profiles.forEach((p) => {
        row[p.id] = 0;
      });
      (data?.weekly ?? []).forEach((r: any) => {
        if (r.month !== mo || !(r.profile_id in row)) return;
        row[r.profile_id] += Number(r[metric] ?? 0);
      });
      return row;
    });
  }, [data, profiles, metric, scope, month]);

  const label = (p: CompareProfile) => p.display_name || `@${p.username}`;
  const metricLabel = METRICS.find((m) => m.key === metric)?.label ?? '';
  const analytics = calculateCompareAnalytics(profiles.map((p) => ({ id: p.id, value: totals[p.id]?.[metric] ?? 0 })));
  const leader = profiles.find((p) => p.id === analytics.leaderId);
  const rankedChartData = profiles
    .map((p, index) => ({
      id: p.id,
      name: label(p),
      value: totals[p.id]?.[metric] ?? 0,
      goal: goalTotals[p.id]?.[metric] ?? 0,
      color: SERIES_COLORS[index % SERIES_COLORS.length],
      colorIndex: index,
    }))
    .sort((a, b) => b.value - a.value);

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const gridCols =
    profiles.length === 2 ? 'md:grid-cols-2' : profiles.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-4';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup type="single" value={scope} onValueChange={(v) => v && setScope(v as Scope)} variant="outline">
          <ToggleGroupItem value="month">Este mês</ToggleGroupItem>
          <ToggleGroupItem value="year">Ano todo</ToggleGroupItem>
        </ToggleGroup>

        <Select value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {METRICS.map((m) => (
              <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cards resumo por perfil */}
      <div className={`grid grid-cols-1 gap-4 ${gridCols}`}>
        {profiles.map((p, i) => {
          const total = totals[p.id]?.[metric] ?? 0;
          const goal = goalTotals[p.id]?.[metric] ?? 0;
          const pct = goal > 0 ? Math.round((total / goal) * 100) : null;
          const isLeader = leaders[metric] === p.id;
          return (
            <Card key={p.id} className={isLeader ? 'border-primary/60 shadow-sm' : undefined}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                  <span className="truncate">{label(p)}</span>
                  {isLeader && <Crown className="h-4 w-4 shrink-0 text-primary" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold tabular-nums">{fmt(total)}</div>
                <p className="text-xs text-muted-foreground">{metricLabel}</p>
                {goal > 0 ? (
                  <>
                    <Progress value={Math.min(100, pct ?? 0)} className="h-1.5" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Target className="h-3 w-3" /> {fmt(goal)}
                      </span>
                      <Badge variant={pct! >= 100 ? 'default' : pct! < 80 ? 'destructive' : 'secondary'}>{pct}%</Badge>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Sem meta definida</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabela comparativa completa */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="w-[200px] p-3 text-left font-medium">Métrica</th>
                {profiles.map((p, i) => (
                  <th key={p.id} className="whitespace-nowrap p-3 text-left font-medium">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                      {label(p)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.key} className="border-b last:border-0">
                  <td className="whitespace-nowrap p-3 font-medium text-muted-foreground">{m.label}</td>
                  {profiles.map((p) => {
                    const total = totals[p.id]?.[m.key] ?? 0;
                    const goal = goalTotals[p.id]?.[m.key] ?? 0;
                    const pct = goal > 0 ? Math.round((total / goal) * 100) : null;
                    const isLeader = leaders[m.key] === p.id;
                    return (
                      <td key={p.id} className={`p-3 ${isLeader ? 'bg-primary/5' : ''}`}>
                        <div className={`font-semibold tabular-nums ${isLeader ? 'text-primary' : ''}`}>{fmt(total)}</div>
                        <div
                          className={`text-xs ${
                            pct === null
                              ? 'text-muted-foreground'
                              : pct >= 100
                                ? 'text-success'
                                : pct < 80
                                  ? 'text-destructive'
                                  : 'text-warning'
                          }`}
                        >
                          {pct === null ? 'sem meta' : `${pct}% da meta`}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Gráfico comparativo */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Análise comparativa</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {metricLabel} · {scope === 'month' ? `${MONTHS_SHORT[month - 1]} de ${year}` : `Evolução mensal de ${year}`}
                </p>
              </div>
            </div>
            {leader && (
              <Badge variant="outline" className="max-w-full gap-1.5 border-primary/25 bg-primary/5 px-3 py-1.5 text-primary">
                <Crown className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Líder: {label(leader)}</span>
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><BarChart3 className="h-3.5 w-3.5" />Total combinado</div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{fmt(analytics.total)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Soma dos {profiles.length} perfis no recorte</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><UsersRound className="h-3.5 w-3.5" />Média por perfil</div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{fmt(analytics.average)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Referência para avaliar o desempenho</p>
            </div>
            <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Crown className="h-3.5 w-3.5 text-primary" />Vantagem da liderança</div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{leader ? fmt(analytics.advantage) : '—'}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {!leader ? 'Ainda não há resultados no recorte' : analytics.advantagePct === null ? 'Demais perfis ainda sem resultado' : `${analytics.advantagePct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% acima da 2ª posição`}
              </p>
            </div>
          </div>

          {analytics.total > 0 ? (
            <div className="overflow-x-auto">
              <div
                className={scope === 'month' ? 'min-w-[560px]' : 'min-w-[720px]'}
                style={{ height: scope === 'month' ? Math.max(250, rankedChartData.length * 72 + 70) : 360 }}
                role="img"
                aria-label={`Comparativo de ${metricLabel}: ${profiles.map((p) => `${label(p)}: ${fmt(totals[p.id]?.[metric] ?? 0)}`).join(', ')}`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  {scope === 'month' ? (
                    <BarChart data={rankedChartData} layout="vertical" margin={{ top: 18, right: 110, left: 4, bottom: 8 }} barCategoryGap="30%">
                      <defs>
                        {profiles.map((p, index) => (
                          <linearGradient key={p.id} id={`${chartId}-profile-${index}`} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={SERIES_COLORS[index % SERIES_COLORS.length]} stopOpacity={0.78} />
                            <stop offset="100%" stopColor={SERIES_COLORS[index % SERIES_COLORS.length]} stopOpacity={1} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 5" strokeOpacity={0.7} />
                      <XAxis type="number" tickFormatter={compact} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickMargin={10} />
                      <YAxis type="category" dataKey="name" width={170} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }} tickFormatter={(value) => truncate(value, 22)} />
                      <Tooltip cursor={{ fill: 'hsl(var(--primary) / 0.045)' }} content={<CompareTooltip scope={scope} metricLabel={metricLabel} total={analytics.total} leaderId={analytics.leaderId} leaderValue={analytics.leaderValue} profiles={profiles} />} />
                      <ReferenceLine x={analytics.average} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.75} label={{ value: 'Média', position: 'top', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={38} animationDuration={650}>
                        {rankedChartData.map((row) => <Cell key={row.id} fill={`url(#${chartId}-profile-${row.colorIndex})`} />)}
                        <LabelList dataKey="value" position="right" offset={12} fill="hsl(var(--foreground))" fontSize={12} fontWeight={600} formatter={(value: number) => fmt(value)} />
                      </Bar>
                    </BarChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 16, right: 12, left: 0, bottom: 4 }} barGap={5} barCategoryGap="24%">
                      <defs>
                        {profiles.map((p, index) => (
                          <linearGradient key={p.id} id={`${chartId}-profile-${index}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={SERIES_COLORS[index % SERIES_COLORS.length]} stopOpacity={1} />
                            <stop offset="100%" stopColor={SERIES_COLORS[index % SERIES_COLORS.length]} stopOpacity={0.72} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 5" strokeOpacity={0.7} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickMargin={12} />
                      <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={64} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <Tooltip cursor={{ fill: 'hsl(var(--primary) / 0.045)' }} content={<CompareTooltip scope={scope} metricLabel={metricLabel} profiles={profiles} />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 18, fontSize: 12 }} formatter={(key: any) => truncate(label(profiles.find((p) => p.id === key)!), 28)} />
                      {profiles.map((p, i) => (
                        <Bar key={p.id} dataKey={p.id} fill={`url(#${chartId}-profile-${i})`} radius={[5, 5, 0, 0]} maxBarSize={34} animationDuration={650} />
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="flex h-[250px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center">
              <BarChart3 className="h-7 w-7 text-muted-foreground/40" />
              <p className="text-sm font-medium">Ainda não há números para comparar</p>
              <p className="text-xs text-muted-foreground">Preencha a métrica selecionada para visualizar a análise.</p>
            </div>
          )}
          {scope === 'month' && analytics.total > 0 && (
            <p className="mt-3 text-center text-[11px] text-muted-foreground">A linha tracejada indica a média dos perfis. Passe o mouse sobre as barras para ver participação e distância da liderança.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
