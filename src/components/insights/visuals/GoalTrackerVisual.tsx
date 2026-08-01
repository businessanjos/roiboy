import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { VisualConfig } from "../visual-builder/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Target, CircleDollarSign } from "lucide-react";

import {
  ComposedChart,
  Bar,
  Line,
  LabelList,

  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  addDays,
  addMonths,
  format,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useInsightsGoal, isCurrencyMetric, InsightsGoal } from "@/hooks/useInsightsGoals";
import { COLOR_PALETTES } from "../visual-builder/types";


interface Bucket {
  key: string;
  label: string;
  start: string;
  end: string;
}

function buildBuckets(goal: InsightsGoal): Bucket[] {
  const start = parseISO(goal.period_start);
  const end = parseISO(goal.period_end);
  const buckets: Bucket[] = [];
  let cursor =
    goal.frequency === "weekly"
      ? startOfWeek(start, { weekStartsOn: 1 })
      : goal.frequency === "monthly"
        ? startOfMonth(start)
        : goal.frequency === "quarterly"
          ? startOfQuarter(start)
          : startOfYear(start);

  let guard = 0;
  while (cursor <= end && guard < 400) {
    guard += 1;
    const next =
      goal.frequency === "weekly"
        ? addDays(cursor, 7)
        : goal.frequency === "monthly"
          ? addMonths(cursor, 1)
          : goal.frequency === "quarterly"
            ? addMonths(cursor, 3)
            : addMonths(cursor, 12);
    const bucketEnd = addDays(next, -1);
    buckets.push({
      key: format(cursor, "yyyy-MM-dd"),
      label:
        goal.frequency === "weekly"
          ? `${format(cursor, "dd/MM", { locale: ptBR })}`
          : goal.frequency === "monthly"
            ? format(cursor, "MMM/yy", { locale: ptBR })
            : goal.frequency === "quarterly"
              ? `T${Math.floor(cursor.getMonth() / 3) + 1}/${format(cursor, "yy")}`
              : format(cursor, "yyyy"),
      start: format(cursor, "yyyy-MM-dd"),
      end: format(bucketEnd, "yyyy-MM-dd"),
    });
    cursor = next;
  }
  return buckets;
}

function bucketOf(buckets: Bucket[], iso: string) {
  const day = iso.slice(0, 10);
  for (const b of buckets) if (day >= b.start && day <= b.end) return b.key;
  return null;
}

function fmt(value: number, currency: boolean) {
  if (currency) {
    if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")} mi`;
    if (Math.abs(value) >= 1000) return `R$ ${(value / 1000).toFixed(1).replace(".", ",")} mil`;
    return `R$ ${value.toFixed(0)}`;
  }
  return String(Math.round(value));
}

const PAGE = 1000;

export function GoalTrackerVisual({ config }: { config: VisualConfig }) {
  const { currentUser } = useCurrentUser();
  const { filters } = useInsightsFilters();
  const accountId = filters.accountIdOverride || currentUser?.account_id || null;
  const goalId = config.goalConfig?.goalId || null;

  const { data: goal, isLoading: loadingGoal } = useInsightsGoal(goalId, accountId);

  const buckets = useMemo(() => (goal ? buildBuckets(goal) : []), [goal]);

  const { data: actuals, isLoading } = useQuery({
    queryKey: ["goal-tracker", goal?.id, accountId, goal?.updated_at],
    enabled: !!goal && !!accountId,
    staleTime: 30_000,
    queryFn: async () => {
      const g = goal!;
      const totals: Record<string, number> = {};
      const openTotals: Record<string, number> = {};

      const pushRows = async (build: (from: number) => any) => {
        const rows: any[] = [];
        for (let from = 0; from < 20000; from += PAGE) {
          const { data, error } = await build(from);
          if (error) throw error;
          rows.push(...(data || []));
          if (!data || data.length < PAGE) break;
        }
        return rows;
      };

      if (g.entity === "activity") {
        const rows = await pushRows((from) => {
          let q = supabase
            .from("internal_tasks")
            .select("id, completed_at, assigned_to, activity_type_id")
            .eq("account_id", accountId!)
            .not("completed_at", "is", null)
            .gte("completed_at", g.period_start)
            .lte("completed_at", `${g.period_end}T23:59:59`)
            .range(from, from + PAGE - 1);
          if (g.scope_type === "user" && g.scope_id) q = q.eq("assigned_to", g.scope_id);
          if (g.activity_type_id) q = q.eq("activity_type_id", g.activity_type_id);
          return q;
        });
        for (const r of rows) {
          const b = bucketOf(buckets, r.completed_at);
          if (b) totals[b] = (totals[b] || 0) + 1;
        }
        return { totals, openTotals };
      }

      // Negócios / previsão
      const dateField = g.entity === "forecast" ? "expected_close_date" : "won_at";
      const rows = await pushRows((from) => {
        let q = supabase
          .from("deals")
          .select("id, value, status, won_at, expected_close_date, responsible_user_id, pipeline_id, stage_id")
          .eq("account_id", accountId!)
          .is("deleted_at", null)
          .not(dateField, "is", null)
          .gte(dateField, g.period_start)
          .lte(dateField, `${g.period_end}T23:59:59`)
          .range(from, from + PAGE - 1);
        if (g.entity === "forecast") q = q.eq("status", "open");
        else q = q.eq("status", "won");
        if (g.scope_type === "user" && g.scope_id) q = q.eq("responsible_user_id", g.scope_id);
        if (g.pipeline_id) q = q.eq("pipeline_id", g.pipeline_id);
        if (g.scope_type === "pipeline" && g.scope_id) q = q.eq("pipeline_id", g.scope_id);
        return q;
      });

      // Escopo por produto: o produto do negócio vive no campo personalizado "Item da venda".
      let scopedRows = rows;
      if (g.scope_type === "product" && g.scope_id) {
        const targetId = normalizeProductId(g.scope_id);
        const ids = rows.map((r: any) => r.id);
        const allowed = new Set<string>();
        for (let i = 0; i < ids.length; i += 500) {
          const batch = ids.slice(i, i + 500);
          if (batch.length === 0) break;
          const { data: fv } = await (supabase as any)
            .from("deal_field_values")
            .select("deal_id, value_text")
            .eq("field_id", ITEM_VENDA_FIELD_ID)
            .eq("account_id", accountId!)
            .in("deal_id", batch);
          for (const row of fv || []) {
            if (resolveRawToProductId(row.value_text) === targetId) allowed.add(row.deal_id);
          }
        }
        scopedRows = rows.filter((r: any) => allowed.has(r.id));
      }

      let probabilities: Record<string, number> = {};
      if (g.entity === "forecast") {
        const { data: stages } = await supabase
          .from("deal_stages")
          .select("id, probability")
          .eq("account_id", accountId!);
        probabilities = Object.fromEntries((stages || []).map((s: any) => [s.id, Number(s.probability) || 0]));
      }


      for (const r of rows) {
        const iso = (g.entity === "forecast" ? r.expected_close_date : r.won_at) as string;
        const b = bucketOf(buckets, iso);
        if (!b) continue;
        if (g.metric === "deal_count") totals[b] = (totals[b] || 0) + 1;
        else if (g.metric === "forecast_revenue") {
          const p = (probabilities[r.stage_id] ?? 100) / 100;
          totals[b] = (totals[b] || 0) + Number(r.value || 0) * p;
        } else totals[b] = (totals[b] || 0) + Number(r.value || 0);
      }

      return { totals, openTotals };
    },
  });

  if (loadingGoal || isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  if (!goal) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Selecione uma meta na configuração do visual.
      </div>
    );
  }

  const currency = isCurrencyMetric(goal.metric);
  const palette =
    COLOR_PALETTES[(config.appearance?.colorPalette as keyof typeof COLOR_PALETTES) || "professional"] ||
    COLOR_PALETTES.professional;
  const colorRealizado = palette[0];
  const colorAcumulado = palette[2] || palette[1];
  const colorMetaPeriodo = palette[4] || palette[1];
  const colorMetaAnual = palette[1];
  const target = Number(goal.target_value) || 0;

  let cumulative = 0;
  let cumulativeTarget = 0;
  const chartData = buckets.map((b) => {
    const value = actuals?.totals[b.key] || 0;
    cumulative += value;
    cumulativeTarget += target;
    return {
      name: b.label,
      Realizado: value,
      Acumulado: cumulative,
      Meta: target,
      MetaAcumulada: cumulativeTarget,
    };
  });

  const totalRealizado = cumulative;
  const totalMeta = target * buckets.length;
  const diff = totalRealizado - totalMeta;
  const pct = totalMeta > 0 ? (totalRealizado / totalMeta) * 100 : 0;

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
        <div>
          <span className="text-muted-foreground">Meta: </span>
          <span className="font-semibold">{fmt(totalMeta, currency)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Realizado: </span>
          <span className="font-semibold text-emerald-400">{fmt(totalRealizado, currency)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Diferença: </span>
          <span className={cn("font-semibold", diff >= 0 ? "text-emerald-400" : "text-red-400")}>
            {diff >= 0 ? "+" : "-"}
            {fmt(Math.abs(diff), currency)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Atingimento: </span>
          <span
            className={cn(
              "font-semibold",
              pct >= 100 ? "text-emerald-400" : pct >= 60 ? "text-amber-400" : "text-red-400",
            )}
          >
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 16, right: 16, left: 4, bottom: 8 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickFormatter={(v) => fmt(Number(v), currency)}
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.15 }}
              content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload || {};
                const realizado = Number(row.Realizado || 0);
                const metaPeriodo = Number(row.Meta || 0);
                const acumulado = Number(row.Acumulado || 0);
                const metaAcum = Number(row.MetaAcumulada || 0);
                const dif = realizado - metaPeriodo;
                return (
                  <div className="min-w-[240px] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg">
                    <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {label}
                    </div>
                    <div className="flex items-center justify-between gap-6 text-sm">
                      <span className="flex items-center gap-2 font-semibold">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        Meta
                      </span>
                      <span className="font-semibold">{fmt(metaPeriodo, currency)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-6 text-sm">
                      <span className="flex items-center gap-2 font-semibold">
                        <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                        Total
                      </span>
                      <span className="font-semibold">{fmt(realizado, currency)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-6 pl-6 text-xs text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: colorRealizado }}
                        />
                        Realizado
                      </span>
                      <span>{fmt(realizado, currency)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-6 pl-6 text-xs text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: colorAcumulado }}
                        />
                        Acumulado
                      </span>
                      <span>{fmt(acumulado, currency)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-6 pl-6 text-xs text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: colorMetaAnual }}
                        />
                        Meta acumulada
                      </span>
                      <span>{fmt(metaAcum, currency)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-6 border-t border-border pt-2 text-sm">
                      <span className="font-semibold">Diferença</span>
                      <span className={cn("font-semibold", dif >= 0 ? "text-emerald-500" : "text-red-500")}>
                        {dif >= 0 ? "+" : "-"}
                        {fmt(Math.abs(dif), currency)}
                      </span>
                    </div>
                  </div>
                );
              }}
            />

            <Legend
              verticalAlign="top"
              align="right"
              iconType="square"
              wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
            />
            <Bar dataKey="Realizado" fill={colorRealizado} radius={[3, 3, 0, 0]} maxBarSize={46}>
              <LabelList
                dataKey="Realizado"
                position="top"
                offset={6}
                formatter={(v: any) => fmt(Number(v), currency)}
                style={{ fill: "hsl(var(--foreground))", fontSize: 10, fontWeight: 600 }}
              />
            </Bar>
            <Line
              type="linear"
              dataKey="Acumulado"
              stroke={colorAcumulado}
              strokeWidth={2}
              dot={{ r: 3, fill: colorAcumulado, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="linear"
              dataKey="MetaAcumulada"
              name={`Meta anual acumulada (${fmt(totalMeta, currency)})`}
              stroke={colorMetaAnual}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
