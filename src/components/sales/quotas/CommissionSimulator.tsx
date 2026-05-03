import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calculator, TrendingUp, DollarSign, Wallet, Trophy, Zap, Target } from "lucide-react";
import { useQuotasIncentives } from "@/hooks/useQuotasIncentives";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// Apenas Closers/Executivos Comerciais ativos (Darlan e Vanessa).
const SALES_USER_IDS = [
  "1d090543-1853-4cd0-bdb4-02e17a5df4d8", // Darlan Ferreira
  "1ac1c97c-bff6-4174-b48c-9b524b404ce6", // Vanessa Minelli
];

const ANNUAL_BONUS_THRESHOLD = 90;     // % de atingimento para o bônus anual
const QUARTERLY_BONUS_THRESHOLD = 100; // % de atingimento para o bônus trimestral

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CommissionSimulator() {
  const now = new Date();
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { plans, productRates, tiers, quotas } = useQuotasIncentives(year, month);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [achievementPct, setAchievementPct] = useState(100);

  const usersQuery = useQuery({
    queryKey: ["sales-team-users", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name")
        .eq("account_id", accountId!)
        .in("id", SALES_USER_IDS)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  // Busca salário CLT real dos vendedores (RH)
  const collaboratorsQuery = useQuery({
    queryKey: ["sales-collaborators-salary", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_collaborators")
        .select("user_id, salary")
        .eq("account_id", accountId!)
        .in("user_id", SALES_USER_IDS);
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  // Cargos comerciais para resolver o plano correto
  const salesPositionsQuery = useQuery({
    queryKey: ["sales-positions", accountId],
    queryFn: async () => {
      const { data: depts } = await supabase
        .from("hr_departments")
        .select("id, name")
        .eq("account_id", accountId!);
      const salesDeptIds = (depts ?? [])
        .filter((d) => /comercial|vendas|sales/i.test(d.name))
        .map((d) => d.id);
      if (salesDeptIds.length === 0) return [];
      const { data, error } = await supabase
        .from("hr_positions")
        .select("id, title, department_id")
        .in("department_id", salesDeptIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!accountId,
  });

  const productsQuery = useQuery({
    queryKey: ["active-products", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("account_id", accountId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const users = usersQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const collaborators = collaboratorsQuery.data ?? [];
  const salesPositionIds = (salesPositionsQuery.data ?? []).map((p) => p.id);

  const simulation = useMemo(() => {
    if (!selectedUserId) return null;

    // Plano ativo cujo cargo pertence ao departamento comercial
    const plan = plans.find((p) => p.is_active && p.position_id && salesPositionIds.includes(p.position_id)) ?? null;
    if (!plan) return { noPlan: true } as any;

    // ── Meta da simulação: prioriza goal_value (meta operacional configurada); fallback em quota_value ──
    const totalTargetValue = Number(plan.goal_value) || Number(plan.quota_value) || 0;

    // Produto vendido no simulador: Rykas Mentoring
    const planProductRates = productRates.filter((r) => r.plan_id === plan.id);
    const mentoringProduct = products.find((p) => p.name.trim().toLowerCase() === "rykas mentoring")
      ?? products.find((p) => p.name.toLowerCase().includes("rykas mentoring"));

    // Ticket fixo Rykas Mentoring: R$ 70.800 até abril/2026, R$ 80.000 a partir de maio/2026
    const isAfterMay2026 = year > 2026 || (year === 2026 && month >= 5);
    const avgTicket = isAfterMay2026 ? 80000 : 70800;

    const totalTargetQty = totalTargetValue / avgTicket;
    const simulatedValue = (totalTargetValue * achievementPct) / 100;
    const simulatedQty = simulatedValue / avgTicket;
    const wholeSalesCount = Math.floor(simulatedQty);
    const commissionableValue = wholeSalesCount * avgTicket;

    // Comissão percentual por produto NÃO faz mais parte do plano.
    // O plano vigente remunera via Bônus de Faixa + Bônus sem teto (por venda acima do limite).
    const appliedRate = null as any;
    const commissionPercent = 0;
    const fixedCommissionPerSale = 0;
    const totalCommission = 0;

    // ── Bônus de faixa: acima do tier máximo, mantém o multiplicador do último ──
    const planTiers = [...tiers.filter((t) => t.plan_id === plan.id)]
      .sort((a, b) => Number(a.min_achievement_percent) - Number(b.min_achievement_percent));

    let activeTier = planTiers
      .slice()
      .reverse()
      .find((t) => achievementPct >= Number(t.min_achievement_percent) &&
        (t.max_achievement_percent == null || achievementPct <= Number(t.max_achievement_percent)));

    // Fallback: acima do maior tier conhecido → mantém o último
    const topTier = planTiers[planTiers.length - 1];
    if (!activeTier && topTier && achievementPct > Number(topTier.max_achievement_percent ?? topTier.min_achievement_percent)) {
      activeTier = topTier;
    }

    const bonusBase = Number(plan.bonus_base_value);
    const multiplier = activeTier ? Number(activeTier.bonus_multiplier) : 0;
    const bonusValue = bonusBase * multiplier;

    // ── Bônus Adicional sem teto: R$ X por VENDA INTEIRA acima do limite ──
    const uncappedEnabled = (plan as any).uncapped_bonus_enabled;
    const uncappedThreshold = Number((plan as any).uncapped_threshold_percent || 0);
    const uncappedPerSale = Number((plan as any).uncapped_bonus_per_sale || 0);
    const uncappedType = (plan as any).uncapped_bonus_type || "fixed";

    let uncappedBonus = 0;
    let extraSales = 0;
    // Limite em vendas inteiras: arredonda p/ baixo (ex: 142,86% × 7 = 9,999 → 10 vendas)
    let salesAtThreshold = Math.round((totalTargetQty * uncappedThreshold) / 100);
    if (uncappedEnabled && avgTicket > 0) {
      // Apenas vendas INTEIRAS acima do limite contam
      extraSales = Math.max(0, Math.floor(simulatedQty) - salesAtThreshold);
      if (uncappedType === "fixed") {
        uncappedBonus = extraSales * uncappedPerSale;
      } else {
        const extraValue = extraSales * avgTicket;
        uncappedBonus = (extraValue * uncappedPerSale) / 100;
      }
    }

    // ── Bônus complementares ──
    const quarterlyBonus = plan.quarterly_bonus_enabled && achievementPct >= QUARTERLY_BONUS_THRESHOLD
      ? Number(plan.quarterly_bonus_value) : 0;
    const annualBonus = (plan as any).annual_bonus_enabled && achievementPct >= ANNUAL_BONUS_THRESHOLD
      ? Number((plan as any).annual_bonus_value) : 0;

    // ── Salário Base: vem do RH (hr_collaborators.salary) ──
    const collab = collaborators.find((c) => c.user_id === selectedUserId);
    const monthlyBase = collab ? Number(collab.salary) : 0;

    const totalEarnings = monthlyBase + totalCommission + bonusValue + uncappedBonus;

    return {
      noPlan: false,
      plan,
      totalTargetValue,
      totalTargetQty,
      simulatedValue,
      simulatedQty,
      avgTicket,
      totalCommission,
      commissionableValue,
      commissionPercent,
      fixedCommissionPerSale,
      wholeSalesCount,
      appliedRateName: mentoringProduct?.name ?? "Rykas Mentoring",
      activeTier,
      bonusValue,
      multiplier,
      uncappedEnabled,
      uncappedThreshold,
      uncappedPerSale,
      uncappedType,
      uncappedBonus,
      extraSales,
      salesAtThreshold,
      quarterlyBonus,
      annualBonus,
      monthlyBase,
      totalEarnings,
    };
  }, [selectedUserId, achievementPct, quotas, productRates, tiers, plans, collaborators, products, salesPositionIds]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Simulador de Comissão
        </CardTitle>
        <CardDescription>Simule os ganhos mensais de um vendedor conforme o % de atingimento da meta</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Vendedor</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Atingimento da Meta: <span className="font-bold text-primary">{achievementPct}%</span></Label>
            <Slider
              value={[achievementPct]}
              onValueChange={([v]) => setAchievementPct(v)}
              min={0}
              max={300}
              step={5}
              className="mt-2"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0%</span>
              <span>100%</span>
              <span>200%</span>
              <span>300%</span>
            </div>
          </div>
        </div>

        {simulation?.noPlan && (
          <div className="text-sm text-center text-muted-foreground py-4 border rounded-lg bg-muted/30">
            ⚠️ Este vendedor não possui plano de incentivo vinculado ao seu cargo.
          </div>
        )}

        {simulation && !simulation.noPlan && (
          <>
            {/* Contexto da simulação */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-2 rounded border bg-muted/20">
                <p className="text-muted-foreground">Meta total</p>
                <p className="font-semibold">{fmt(simulation.totalTargetValue)}</p>
                <p className="text-[10px] text-muted-foreground">= {Math.round(simulation.totalTargetQty)} vendas (ticket {fmt(simulation.avgTicket)})</p>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <p className="text-muted-foreground">Simulado ({achievementPct}%)</p>
                <p className="font-semibold">{fmt(simulation.simulatedValue)}</p>
                <p className="text-[10px] text-muted-foreground">= {Math.floor(simulation.simulatedQty)} vendas</p>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <p className="text-muted-foreground">Ticket médio</p>
                <p className="font-semibold">{fmt(simulation.avgTicket)}</p>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <p className="text-muted-foreground">Plano</p>
                <p className="font-semibold truncate">{simulation.plan.name}</p>
              </div>
            </div>

            {/* Componentes do ganho */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" />
                  Salário Base
                </div>
                <p className="font-bold text-sm">{simulation.monthlyBase > 0 ? fmt(simulation.monthlyBase) : "—"}</p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Bônus Faixa
                </div>
                <p className="font-bold text-sm flex items-center gap-1.5">
                  {fmt(simulation.bonusValue)}
                  {simulation.activeTier && (
                    <Badge variant="outline" className="text-[9px]">
                      {simulation.activeTier.label || `${simulation.multiplier}x`}
                    </Badge>
                  )}
                </p>
              </div>
              <div className="p-3 rounded-lg border bg-amber-500/10 border-amber-500/30 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <Zap className="h-3.5 w-3.5" />
                  Bônus sem teto
                </div>
                <p className="font-bold text-sm">{fmt(simulation.uncappedBonus)}</p>
                {simulation.uncappedEnabled && simulation.extraSales > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    +{simulation.extraSales} venda(s) acima de {simulation.salesAtThreshold}
                  </p>
                )}
              </div>
              <div className="p-3 rounded-lg border bg-primary/10 border-primary/30 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <Trophy className="h-3.5 w-3.5 text-primary" />
                  Ganho Mensal Bruto
                </div>
                <p className="font-bold text-lg text-primary">{fmt(simulation.totalEarnings)}</p>
              </div>
            </div>

            {/* Explicação do bônus sem teto */}
            {simulation.uncappedEnabled && (
              <div className="text-xs p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 space-y-1">
                <p className="font-medium flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" />
                  Bônus sem teto: ativo a partir de {simulation.uncappedThreshold}% de atingimento
                </p>
                {simulation.extraSales > 0 ? (
                  <p className="text-muted-foreground">
                    Limite = {simulation.salesAtThreshold} vendas. Cada venda inteira acima paga{" "}
                    {simulation.uncappedType === "fixed"
                      ? <strong>{fmt(simulation.uncappedPerSale)}</strong>
                      : <strong>{simulation.uncappedPerSale}% do valor</strong>}
                    . {simulation.extraSales} × {simulation.uncappedType === "fixed" ? fmt(simulation.uncappedPerSale) : `${simulation.uncappedPerSale}%`} = <strong>{fmt(simulation.uncappedBonus)}</strong>
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Aumente o atingimento acima de {simulation.uncappedThreshold}% para ativar este bônus.
                  </p>
                )}
              </div>
            )}

            {/* Bônus trimestral/anual (informativo) */}
            {(simulation.plan.quarterly_bonus_enabled || (simulation.plan as any).annual_bonus_enabled) && (
              <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded border space-y-1">
                <p className="font-medium text-foreground">Bônus complementares (não somados ao mensal):</p>
                {simulation.plan.quarterly_bonus_enabled && (
                  <p>
                    ⚡ Trimestral: {fmt(Number(simulation.plan.quarterly_bonus_value))} — pago no fechamento do trimestre se atingir {QUARTERLY_BONUS_THRESHOLD}%
                    {achievementPct >= QUARTERLY_BONUS_THRESHOLD ? " ✅" : ""}
                  </p>
                )}
                {(simulation.plan as any).annual_bonus_enabled && (
                  <p>
                    🏆 Anual: {fmt(Number((simulation.plan as any).annual_bonus_value))} — pago no fechamento do ano se atingir {ANNUAL_BONUS_THRESHOLD}%
                    {achievementPct >= ANNUAL_BONUS_THRESHOLD ? " ✅" : ""}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {!selectedUserId && (
          <p className="text-center text-muted-foreground py-4 text-sm">
            Selecione um vendedor para simular os ganhos
          </p>
        )}
      </CardContent>
    </Card>
  );
}
