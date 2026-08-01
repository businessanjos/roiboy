import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { VisualConfig } from "../visual-builder/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { eachDayOfInterval, format, parseISO, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";

const WEEKDAY_INITIALS = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Linhas fixas (fora das etapas do funil). */
const WON_ROW = "__won__";
const LOST_ROW = "__lost__";
const REVENUE_ROW = "__revenue__";

interface DayCell {
  [dayKey: string]: number;
}

interface MetricRow {
  key: string;
  label: string;
  color: string;
  isCurrency?: boolean;
  /** Classe fixa de cor (Venda/Receita verde, Perdido vermelho). */
  valueClass?: string;
  days: DayCell;
  total: number;
  /** Negócios que chegaram nesta etapa e hoje estão perdidos (só etapas do funil). */
  lostCount?: number;
}

function formatCompactNumber(v: number, isCurrency: boolean) {
  if (!isCurrency) return String(v);
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1).replace(".", ",")}k`;
  return String(Math.round(v));
}

/** Verde >= 100%, âmbar 60-99%, vermelho < 60% da meta diária. */
function achievementClass(value: number, dailyGoal: number | null) {
  if (!dailyGoal || dailyGoal <= 0 || value <= 0) return "text-foreground";
  const pct = value / dailyGoal;
  if (pct >= 1) return "text-emerald-400";
  if (pct >= 0.6) return "text-amber-400";
  return "text-red-400";
}


export function DailyPerformanceTable({ config }: { config: VisualConfig }) {
  const { currentUser } = useCurrentUser();
  const [tab, setTab] = useState<"volume" | "conversion">("volume");

  const { filters } = useInsightsFilters();
  // Dashboards compartilhados leem a conta dona do painel.
  const accountId = filters.accountIdOverride || currentUser?.account_id;

  const dp = config.dailyPerformanceConfig || {};
  const pipelineId = dp.pipelineId || null;
  const userId = dp.userId && dp.userId !== "all" ? dp.userId : (filters.userId !== "all" ? filters.userId : null);

  const range = useMemo(() => {
    // Os filtros globais podem entregar ISO completo ("2026-01-01T00:00:00.000Z");
    // normalizamos para YYYY-MM-DD antes de montar os limites do período.
    const toDay = (v?: string) => (v ? String(v).slice(0, 10) : "");
    const start = toDay(config.fixedDateRange?.startDate || filters.startDate);
    const end = toDay(config.fixedDateRange?.endDate || filters.endDate);
    return { start, end };
  }, [config.fixedDateRange, filters.startDate, filters.endDate]);

  const days = useMemo(() => {
    try {
      return eachDayOfInterval({ start: parseISO(range.start), end: parseISO(range.end) });
    } catch {
      return [];
    }
  }, [range.start, range.end]);

  const businessDays = days.filter((d) => !isWeekend(d)).length || 1;

  // O período é inclusivo: sem o fim do dia, o último dia do intervalo some da tabela.
  const rangeStartIso = `${range.start}T00:00:00`;
  const rangeEndIso = `${range.end}T23:59:59.999`;


  const { data, isLoading } = useQuery({
    queryKey: ["daily-performance", accountId, pipelineId, userId, range.start, range.end],
    enabled: !!accountId && days.length > 0,
    // Etapas renomeadas/removidas no sistema precisam refletir rápido no visual.
    staleTime: 30000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    queryFn: async () => {

      // Etapas do funil selecionado (ou de todos, se nenhum)
      let stagesQuery = supabase
        .from("deal_stages")
        .select("id, name, color, display_order, pipeline_id")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("display_order");
      if (pipelineId) stagesQuery = stagesQuery.eq("pipeline_id", pipelineId);
      const { data: stages } = await stagesQuery;

      // O funil de Repescagem / Cadência recebe pessoas que já receberam proposta.
      // Quando o visual está filtrado por um funil, esses negócios entram junto e
      // são contabilizados na etapa de "Proposta enviada" do funil selecionado.
      let repescagemPipelineId: string | null = null;
      if (pipelineId) {
        const { data: pls } = await supabase
          .from("pipelines")
          .select("id, name")
          .eq("account_id", accountId);
        repescagemPipelineId =
          (pls || []).find((p: any) => /repescagem/i.test(p.name || ""))?.id || null;
        if (repescagemPipelineId === pipelineId) repescagemPipelineId = null;
      }

      // Negócios do funil (para filtrar movimentações e calcular ganhos/perdas).
      // Paginação obrigatória: o PostgREST corta em 1.000 linhas e os totais viriam menores.
      const PAGE = 1000;
      const deals: any[] = [];
      for (let page = 0; page < 50; page++) {
        let dealsQuery = supabase
          .from("deals")
          .select("id, value, status, won_at, lost_at, pipeline_id, responsible_user_id, stage_id")
          .eq("account_id", accountId)
          // Negócios excluídos (soft delete) nunca entram na auditoria.
          .is("deleted_at", null)
          .order("id")
          .range(page * PAGE, page * PAGE + PAGE - 1);
        if (pipelineId) {
          dealsQuery = repescagemPipelineId
            ? dealsQuery.in("pipeline_id", [pipelineId, repescagemPipelineId])
            : dealsQuery.eq("pipeline_id", pipelineId);
        }
        if (userId) dealsQuery = dealsQuery.eq("responsible_user_id", userId);
        const { data: chunk, error } = await dealsQuery;
        if (error) throw error;
        deals.push(...(chunk || []));
        if (!chunk || chunk.length < PAGE) break;
      }

      const dealIds = new Set(deals.map((d: any) => d.id));
      const repescagemDealIds = new Set(
        deals.filter((d: any) => repescagemPipelineId && d.pipeline_id === repescagemPipelineId).map((d: any) => d.id),
      );


      // Movimentações de etapa no período (também paginadas)
      const activities: any[] = [];
      for (let page = 0; page < 50; page++) {
        const { data: chunk, error } = await supabase
          .from("deal_activities")
          .select("deal_id, new_value, created_at, type, title")
          .eq("account_id", accountId)
          .eq("type", "stage_change")
          .gte("created_at", rangeStartIso)
          .lte("created_at", rangeEndIso)
          .order("created_at")
          .range(page * PAGE, page * PAGE + PAGE - 1);
        if (error) throw error;
        activities.push(...(chunk || []));
        if (!chunk || chunk.length < PAGE) break;
      }

      return { stages: stages || [], deals, activities, dealIds };
    },
  });


  const rows: MetricRow[] = useMemo(() => {
    if (!data) return [];
    const dayKeys = days.map((d) => format(d, "yyyy-MM-dd"));
    const emptyDays = () => Object.fromEntries(dayKeys.map((k) => [k, 0])) as DayCell;

    const stageRows = new Map<string, MetricRow>();
    for (const s of data.stages as any[]) {
      stageRows.set(s.name, {
        key: s.name,
        label: s.name,
        color: s.color || "hsl(var(--primary))",
        days: emptyDays(),
        total: 0,
      });
    }

    // Etapas removidas/renomeadas no sistema deixam histórico com o nome antigo.
    // Nesses casos, o movimento é atribuído à etapa atual do negócio (para onde
    // ele foi migrado), mantendo o funil coerente com a configuração vigente.
    const stageNameById = new Map<string, string>(
      (data.stages as any[]).map((s: any) => [s.id, s.name])
    );
    const currentStageByDeal = new Map<string, string>(
      (data.deals as any[])
        .filter((d: any) => d.stage_id && stageNameById.has(d.stage_id))
        .map((d: any) => [d.id, stageNameById.get(d.stage_id)!])
    );

    // Um negócio que volta para a mesma etapa no mesmo dia conta uma vez só:
    // a linha mede negócios que passaram pela etapa, não movimentações.
    const seen = new Set<string>();
    // Negócios únicos que passaram por cada etapa (base do total em formato funil).
    const stageDeals = new Map<string, Set<string>>();
    for (const act of data.activities as any[]) {
      if (act.title === "Transferência de responsável") continue;
      if (!data.dealIds.has(act.deal_id)) continue;
      const stageName =
        stageRows.has(act.new_value)
          ? act.new_value
          : currentStageByDeal.get(act.deal_id);
      const row = stageName ? stageRows.get(stageName) : undefined;
      if (!row) continue;
      const key = format(parseISO(act.created_at), "yyyy-MM-dd");
      if (!(key in row.days)) continue;
      const dedupeKey = `${act.deal_id}|${row.key}|${key}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      row.days[key] += 1;
      if (!stageDeals.has(row.key)) stageDeals.set(row.key, new Set());
      stageDeals.get(row.key)!.add(act.deal_id);
    }


    // Total em lógica de funil: cada etapa conta os negócios únicos que chegaram
    // nela OU em qualquer etapa posterior. Assim o total nunca cresce para baixo.
    const orderedStages = [...stageRows.values()];
    const lostDealIds = new Set<string>(
      (data.deals as any[]).filter((d) => d.status === "lost").map((d) => d.id),
    );
    for (let i = 0; i < orderedStages.length; i++) {
      const acc = new Set<string>();
      for (let j = i; j < orderedStages.length; j++) {
        for (const id of stageDeals.get(orderedStages[j].key) || []) acc.add(id);
      }
      orderedStages[i].total = acc.size;
      // Perdidos continuam contando no volume da etapa: aqui medimos quantos
      // desses negócios acabaram perdidos, sem tirá-los da base de conversão.
      let lostHere = 0;
      for (const id of acc) if (lostDealIds.has(id)) lostHere += 1;
      orderedStages[i].lostCount = lostHere;
    }

    const won: MetricRow = { key: WON_ROW, label: "Venda", color: "#22c55e", valueClass: "text-emerald-400", days: emptyDays(), total: 0 };
    const lost: MetricRow = { key: LOST_ROW, label: "Perdido", color: "#ef4444", valueClass: "text-red-400", days: emptyDays(), total: 0 };
    const revenue: MetricRow = { key: REVENUE_ROW, label: "Receita (R$)", color: "#10b981", valueClass: "text-emerald-400", isCurrency: true, days: emptyDays(), total: 0 };

    // O próprio mapa de dias delimita o período (inclusive o último dia).
    for (const d of data.deals as any[]) {
      // Um negócio reaberto e depois perdido mantém o `won_at` antigo:
      // só conta como Venda/Receita quem está de fato com status ganho.
      if (d.status === "won" && d.won_at) {
        const key = format(parseISO(d.won_at), "yyyy-MM-dd");
        if (key in won.days) {
          won.days[key] += 1;
          won.total += 1;
          revenue.days[key] += Number(d.value || 0);
          revenue.total += Number(d.value || 0);
        }
      }
      if (d.status === "lost" && d.lost_at) {
        const key = format(parseISO(d.lost_at), "yyyy-MM-dd");
        if (key in lost.days) {
          lost.days[key] += 1;
          lost.total += 1;
        }
      }
    }


    return [...orderedStages, won, lost, revenue];
  }, [data, days, range.start, range.end]);


  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0 || days.length === 0) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Sem dados para exibir</div>;
  }

  const goals = dp.goals || {};

  const fixedKeys = new Set([WON_ROW, LOST_ROW, REVENUE_ROW]);
  const stageOnlyRows = rows.filter((r) => !fixedKeys.has(r.key));
  const wonRow = rows.find((r) => r.key === WON_ROW);
  const conversionSteps = wonRow ? [...stageOnlyRows, wonRow] : stageOnlyRows;
  const topTotal = conversionSteps[0]?.total || 0;

  const tabs = (
    <div className="flex items-center gap-1 px-3 pt-2">
      {[
        { id: "volume" as const, label: "Volume" },
        { id: "conversion" as const, label: "Taxa de conversão" },
      ].map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTab(t.id)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
            tab === t.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  if (tab === "conversion") {
    return (
      <div className="h-full w-full overflow-auto">
        {tabs}
        <table className="w-full border-collapse text-xs tabular-nums">
          <thead>
            <tr className="text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium uppercase tracking-wide">Etapa</th>
              <th className="px-3 py-2 text-right font-medium uppercase">Negócios</th>
              <th className="px-3 py-2 text-right font-medium uppercase">Perdidos</th>
              <th className="px-3 py-2 text-right font-medium uppercase">Conv. etapa anterior</th>
              <th className="px-3 py-2 text-right font-medium uppercase">Conv. do topo</th>
            </tr>
          </thead>
          <tbody>
            {conversionSteps.map((row, i) => {
              const prev = i > 0 ? conversionSteps[i - 1].total : null;
              const stepPct = prev && prev > 0 ? (row.total / prev) * 100 : null;
              const topPct = topTotal > 0 ? (row.total / topTotal) * 100 : null;
              return (
                <tr key={row.key} className="border-t border-border/50">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                      <span className="truncate">{row.label}</span>
                    </span>
                  </td>
                  <td className={cn("px-3 py-2 text-right font-semibold", row.valueClass)}>{row.total}</td>
                  <td className="px-3 py-2 text-right text-red-400">
                    {row.lostCount === undefined || row.total === 0 ? (
                      <span className="text-muted-foreground/40">—</span>
                    ) : (
                      <>
                        {row.lostCount}
                        <span className="ml-1 text-[10px] text-red-400/70">
                          {((row.lostCount / row.total) * 100).toFixed(1).replace(".", ",")}%
                        </span>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {stepPct === null ? (
                      <span className="text-muted-foreground/40">—</span>
                    ) : (
                      `${stepPct.toFixed(1).replace(".", ",")}%`
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {topPct === null ? "—" : `${topPct.toFixed(1).replace(".", ",")}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-3 py-2 text-[11px] text-muted-foreground">
          Conversão calculada sobre negócios únicos que chegaram em cada etapa (ou em etapas posteriores) no período.
          Negócios perdidos permanecem na contagem da etapa — a coluna Perdidos mostra quantos deles acabaram perdidos, sem alterar as taxas de conversão.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto">
      {tabs}
      <table className="w-full border-collapse text-xs tabular-nums">

        <thead>
          <tr className="text-muted-foreground">
            <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium uppercase tracking-wide">
              Métrica
            </th>
            {days.map((d) => (
              <th key={d.toISOString()} className="px-1.5 py-2 text-center font-medium">
                <div className={cn("leading-none", isWeekend(d) && "opacity-40")}>{WEEKDAY_INITIALS[d.getDay()]}</div>
                <div className={cn("leading-tight", isWeekend(d) && "opacity-40")}>{format(d, "d")}</div>
              </th>
            ))}
            <th className="px-3 py-2 text-right font-semibold uppercase">Total</th>
            <th className="px-3 py-2 text-right font-semibold uppercase">Meta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const goal = Number(goals[row.key] || 0);
            const dailyGoal = goal > 0 ? goal / businessDays : null;
            const pct = goal > 0 ? Math.round((row.total / goal) * 100) : null;
            return (
              <tr key={row.key} className="border-t border-border/50">
                <td className="sticky left-0 z-10 bg-card px-3 py-2 whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                    <span className="truncate">{row.label}</span>
                  </span>
                </td>
                {days.map((d) => {
                  const key = format(d, "yyyy-MM-dd");
                  const v = row.days[key] || 0;
                  return (
                    <td key={key} className="px-1.5 py-2 text-center">
                      {v === 0 ? (
                        <span className="text-muted-foreground/40">—</span>
                      ) : (
                        <span className={row.valueClass || achievementClass(v, dailyGoal)}>
                          {formatCompactNumber(v, !!row.isCurrency)}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className={cn("px-3 py-2 text-right font-semibold", row.valueClass)}>
                  {row.total === 0 ? (
                    <span className="text-muted-foreground/40">—</span>
                  ) : (
                    formatCompactNumber(row.total, !!row.isCurrency)
                  )}
                </td>

                <td className={cn("px-3 py-2 text-right", pct === null ? "text-muted-foreground/40" : achievementClass(pct, 100))}>
                  {pct === null ? "—" : `${pct}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[11px] text-muted-foreground">
        Cores indicam atingimento da meta diária (meta total ÷ {businessDays} dias úteis do período).
        <span className="ml-2 text-emerald-400">● ≥ 100%</span>
        <span className="ml-2 text-amber-400">● 60–99%</span>
        <span className="ml-2 text-red-400">● &lt; 60%</span>
      </p>
    </div>
  );
}

export const DAILY_PERFORMANCE_FIXED_ROWS = [
  { key: WON_ROW, label: "Venda" },
  { key: LOST_ROW, label: "Perdido" },
  { key: REVENUE_ROW, label: "Receita (R$)" },
];
