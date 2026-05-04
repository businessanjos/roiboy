import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, X, Loader2, Trophy, Wand2 } from "lucide-react";
import {
  type ConsultantGoal,
  METRIC_LABELS,
  MONTH_LABELS,
} from "@/hooks/useConsultantGoals";
import {
  useBonusPayouts,
  calculateBonus,
  type BonusPayout,
} from "@/hooks/useBonusPayouts";
import { useComputedMetrics } from "@/hooks/useComputedConsultantMetrics";
import { toast } from "sonner";

interface Props {
  goals: ConsultantGoal[];
  userId: string;
  year: number;
  products: any[];
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

interface CellState {
  value: string;
  dirty: boolean;
}

export function ConsultantPayoutTable({ goals, userId, year, products }: Props) {
  const { payouts, isLoading, upsertPayout } = useBonusPayouts(year, userId);
  const { data: computed = {}, isFetching: computing, refetch: refetchComputed } =
    useComputedMetrics(goals, year);
  const [drafts, setDrafts] = useState<Record<string, CellState>>({});
  const [syncing, setSyncing] = useState(false);

  const syncRealValues = async (goal?: ConsultantGoal) => {
    const target = goal ? [goal] : goals;
    if (target.length === 0) return;
    setSyncing(true);
    try {
      const fresh = await refetchComputed();
      const data = fresh.data || {};
      let saved = 0;
      for (const g of target) {
        for (let month = 1; month <= 12; month++) {
          const v = data[`${g.id}:${month}`];
          if (v === undefined) continue;
          if (v === 0) continue; // skip months sem dados
          await upsertPayout.mutateAsync({ goal: g, month, actual_value: v });
          saved++;
        }
      }
      toast.success(
        saved > 0
          ? `${saved} apuração(ões) atualizada(s) com dados reais.`
          : "Nenhum dado real disponível no período."
      );
    } catch (e: any) {
      toast.error("Erro ao sincronizar: " + (e?.message ?? "desconhecido"));
    } finally {
      setSyncing(false);
    }
  };

  const payoutMap = useMemo(() => {
    const m = new Map<string, BonusPayout>();
    for (const p of payouts) m.set(`${p.goal_id}:${p.month}`, p);
    return m;
  }, [payouts]);

  const cellKey = (goalId: string, month: number) => `${goalId}:${month}`;

  const getCellValue = (goalId: string, month: number) => {
    const k = cellKey(goalId, month);
    if (drafts[k]) return drafts[k].value;
    const p = payoutMap.get(k);
    return p ? String(p.actual_value) : "";
  };

  const setCellValue = (goalId: string, month: number, value: string) => {
    setDrafts((d) => ({
      ...d,
      [cellKey(goalId, month)]: { value, dirty: true },
    }));
  };

  const saveCell = async (goal: ConsultantGoal, month: number) => {
    const k = cellKey(goal.id, month);
    const draft = drafts[k];
    if (!draft) return;
    const actual = Number(draft.value);
    if (Number.isNaN(actual)) return;
    await upsertPayout.mutateAsync({ goal, month, actual_value: actual });
    setDrafts((d) => {
      const copy = { ...d };
      delete copy[k];
      return copy;
    });
  };

  const totalEarned = payouts.reduce((s, p) => s + Number(p.bonus_paid || 0), 0);
  const totalAchieved = payouts.filter((p) => p.achieved).length;
  const maxPossible = goals.reduce(
    (s, g) => s + Number(g.bonus_amount || 0) * 12,
    0
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Configure metas na aba Metas antes de apurar resultados.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Gatilhos atingidos</div>
            <div className="text-xl font-bold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              {totalAchieved}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Bônus apurado</div>
            <div className="text-xl font-bold text-amber-500">
              {formatBRL(totalEarned)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Potencial máximo</div>
            <div className="text-xl font-bold text-muted-foreground">
              {formatBRL(maxPossible)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs">
              <tr>
                <th className="text-left p-2 sticky left-0 bg-muted/50 min-w-[220px]">
                  Meta
                </th>
                {MONTH_LABELS.map((m) => (
                  <th key={m} className="p-2 text-center min-w-[80px]">{m}</th>
                ))}
                <th className="p-2 text-right min-w-[110px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {goals.map((g) => {
                const product = products.find((p) => p.id === g.product_id);
                const unit = g.metric_type === "nps" ? "" : "%";
                const goalTotal = Array.from({ length: 12 }, (_, i) => i + 1)
                  .reduce((sum, m) => {
                    const p = payoutMap.get(cellKey(g.id, m));
                    return sum + (p ? Number(p.bonus_paid) : 0);
                  }, 0);

                return (
                  <tr key={g.id} className="border-t hover:bg-muted/20">
                    <td className="p-2 sticky left-0 bg-background">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-xs">
                          {METRIC_LABELS[g.metric_type]}
                        </span>
                        <Badge
                          className="self-start text-[10px]"
                          style={{
                            backgroundColor: product?.color || "#6b7280",
                            color: "#fff",
                          }}
                        >
                          {product?.name || "—"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatBRL(Number(g.bonus_amount))} / gatilho
                        </span>
                      </div>
                    </td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                      const k = cellKey(g.id, month);
                      const payout = payoutMap.get(k);
                      const draft = drafts[k];
                      const value = getCellValue(g.id, month);
                      const monthlyTarget = Number(
                        g.monthly_targets?.[String(month - 1)] ?? 0
                      );
                      const target = monthlyTarget > 0 ? monthlyTarget : Number(g.annual_target);
                      const previewActual = value === "" ? null : Number(value);
                      const preview =
                        previewActual === null
                          ? null
                          : calculateBonus(g, month, previewActual);
                      const achieved = preview ? preview.achieved : payout?.achieved ?? false;

                      return (
                        <td key={month} className="p-1 text-center">
                          <div className="flex flex-col gap-0.5 items-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Input
                                  className={
                                    "h-7 text-xs text-center w-[68px] " +
                                    (achieved && previewActual !== null
                                      ? "border-emerald-500"
                                      : previewActual !== null
                                      ? "border-rose-500"
                                      : "")
                                  }
                                  value={value}
                                  placeholder="–"
                                  onChange={(e) => setCellValue(g.id, month, e.target.value)}
                                  onBlur={() => draft?.dirty && saveCell(g, month)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Meta: {target}{unit}
                              </TooltipContent>
                            </Tooltip>
                            {previewActual !== null && (
                              <div className="flex items-center gap-1">
                                {achieved ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <X className="h-3 w-3 text-rose-500" />
                                )}
                                <span className="text-[10px] font-medium">
                                  {achieved
                                    ? formatBRL(Number(g.bonus_amount))
                                    : "—"}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-2 text-right font-semibold text-amber-500">
                      {formatBRL(goalTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Digite o resultado real do mês (% de renovação, % de churn ou score de NPS).
        O sistema calcula automaticamente se o gatilho foi atingido e o bônus em R$.
        Use Tab/Enter ou clique fora para salvar.
      </p>
    </div>
  );
}
