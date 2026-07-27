import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart as LineChartIcon, TrendingDown, TrendingUp } from "lucide-react";
import { useAdSpendTrend } from "@/hooks/useAdSpendTrend";

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function DeltaBadge({ current, previous, invert }: { current: number; previous: number; invert?: boolean }) {
  if (!previous) return null;
  const delta = ((current - previous) / previous) * 100;
  const good = invert ? delta <= 0 : delta >= 0;
  const Icon = delta >= 0 ? TrendingUp : TrendingDown;
  return (
    <Badge variant="outline" className={good ? "text-emerald-600 border-emerald-600/40" : "text-destructive border-destructive/40"}>
      <Icon className="h-3 w-3 mr-1" />
      {delta > 0 ? "+" : ""}
      {delta.toFixed(1)}%
    </Badge>
  );
}

export function AdSpendTrendCharts({ range }: { range?: { startDate: Date; endDate: Date } }) {
  const { data, isLoading } = useAdSpendTrend(range);
  const [mode, setMode] = useState<"daily" | "monthly">("daily");

  const series = mode === "daily" ? data?.daily ?? [] : data?.monthly ?? [];

  const summary = useMemo(() => {
    const withData = (data?.monthly ?? []).filter((m) => m.spend > 0);
    const last = withData[withData.length - 1];
    const prev = withData[withData.length - 2];
    return { last, prev };
  }, [data]);

  if (isLoading) {
    return <Skeleton className="h-[380px] w-full" />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <LineChartIcon className="h-4 w-4 text-muted-foreground" />
            Tendência de investimento
          </CardTitle>
          <CardDescription>
            Gasto, leads e CPL em série histórica — base para decisão de verba
          </CardDescription>
          {summary.last && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
              <span>
                Último mês com dados: <strong className="text-foreground">{summary.last.label}</strong> ·{" "}
                {formatBRL(summary.last.spend)} · {summary.last.leads} leads · CPL {formatBRL(summary.last.cpl)}
              </span>
              {summary.prev && (
                <>
                  <DeltaBadge current={summary.last.spend} previous={summary.prev.spend} />
                  <DeltaBadge current={summary.last.cpl} previous={summary.prev.cpl} invert />
                </>
              )}
            </div>
          )}
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "daily" | "monthly")}>
          <TabsList>
            <TabsTrigger value="daily">Diário</TabsTrigger>
            <TabsTrigger value="monthly">Mensal (12m)</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {!data?.hasData || series.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground text-center px-6">
            Ainda não há snapshots diários do Meta Ads neste período. Rode uma sincronização em
            Marketing → Tráfego Pago para popular o histórico.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v) => formatBRL(Number(v))}
                width={72}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  color: "hsl(var(--popover-foreground))",
                  fontSize: 12,
                }}
                formatter={(value: any, name: string) =>
                  name === "Leads" ? [value, name] : [formatBRL(Number(value)), name]
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                yAxisId="left"
                dataKey="spend"
                name="Investimento"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="leads"
                name="Leads"
                stroke="hsl(var(--chart-2, var(--muted-foreground)))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="cpl"
                name="CPL"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
