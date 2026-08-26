import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Crown, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { supabase } from '@/integrations/supabase/client';
import { METRICS, type MetricKey } from './RecordsGoalsCharts';

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const fmt = (n: number) => n.toLocaleString('pt-BR');

/** Cores por posição — usam tokens do design system */
const SERIES_COLORS = [
  'hsl(var(--primary))',
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

export function RecordsCompareView({ profiles, year, month }: Props) {
  const [metric, setMetric] = useState<MetricKey>('views');
  const [scope, setScope] = useState<Scope>('month');

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
          bestVal = v;
          best = p.id;
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
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES_COLORS[i % 4] }} />
                  <span className="truncate">{label(p)}</span>
                  {isLeader && <Crown className="h-4 w-4 text-primary shrink-0" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold">{fmt(total)}</div>
                <p className="text-xs text-muted-foreground">{metricLabel}</p>
                {goal > 0 ? (
                  <>
                    <Progress value={Math.min(100, pct ?? 0)} className="h-1.5" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground inline-flex items-center gap-1">
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
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left font-medium p-3 w-[200px]">Métrica</th>
                {profiles.map((p, i) => (
                  <th key={p.id} className="text-left font-medium p-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES_COLORS[i % 4] }} />
                      {label(p)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.key} className="border-b last:border-0">
                  <td className="p-3 font-medium text-muted-foreground whitespace-nowrap">{m.label}</td>
                  {profiles.map((p) => {
                    const total = totals[p.id]?.[m.key] ?? 0;
                    const goal = goalTotals[p.id]?.[m.key] ?? 0;
                    const pct = goal > 0 ? Math.round((total / goal) * 100) : null;
                    const isLeader = leaders[m.key] === p.id;
                    return (
                      <td key={p.id} className={`p-3 ${isLeader ? 'bg-primary/5' : ''}`}>
                        <div className={`font-semibold ${isLeader ? 'text-primary' : ''}`}>{fmt(total)}</div>
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {metricLabel} — {scope === 'month' ? MONTHS_SHORT[month - 1] : year}
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid className="stroke-muted" vertical={false} stroke="hsl(var(--hairline))" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-xs" />
              <YAxis tickFormatter={(v) => fmt(Number(v))} tickLine={false} axisLine={false} width={70} className="text-xs" />
              <Tooltip
                formatter={(v: any, key: any) => [fmt(Number(v)), label(profiles.find((p) => p.id === key)!)]}
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
              />
              <Legend formatter={(key: any) => label(profiles.find((p) => p.id === key)!)} />
              {profiles.map((p, i) => (
                <Bar key={p.id} dataKey={p.id} fill={SERIES_COLORS[i % 4]} radius={[4, 4, 0, 0]} maxBarSize={48} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
