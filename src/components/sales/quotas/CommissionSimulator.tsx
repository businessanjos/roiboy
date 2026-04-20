import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
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

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CommissionSimulator() {
  const now = new Date();
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { plans, productRates, tiers, quotas, userOTEs } = useQuotasIncentives(year, month);
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

  // Busca cargos comerciais para resolver o plano correto
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
  const salesPositionIds = (salesPositionsQuery.data ?? []).map((p) => p.id);

  const simulation = useMemo(() => {
    if (!selectedUserId) return null;

    // Resolve plano: o plano ativo cujo cargo pertença a um departamento comercial
    const plan = plans.find((p) => p.is_active && p.position_id && salesPositionIds.includes(p.position_id)) ?? null;
    if (!plan) return { noPlan: true } as any;

    const userQuotas = quotas.filter((q) => q.user_id === selectedUserId);
    const totalTargetValue = userQuotas.reduce((s, q) => s + Number(q.target_value), 0);
    const totalTargetQty = userQuotas.reduce((s, q) => s + Number(q.target_quantity), 0);
    const simulatedValue = (totalTargetValue * achievementPct) / 100;
    const simulatedQty = (totalTargetQty * achievementPct) / 100;

    // Ticket médio ponderado pelas quotas
    const avgTicket = totalTargetQty > 0 ? totalTargetValue / totalTargetQty : 0;

    // Comissão por produto: usa preço × quantidade simulada (consistente com vendas reais)
    let totalCommission = 0;
    userQuotas.forEach((q) => {
      if (!q.product_id) return;
      const rate = productRates.find((r) => r.product_id === q.product_id && r.plan_id === plan.id);
      if (!rate) return;
      const product = products.find((p) => p.id === q.product_id);
      const unitPrice = product ? Number(product.price) : (Number(q.target_value) / Math.max(Number(q.target_quantity), 1));
      const qSimulatedQty = (Number(q.target_quantity) * achievementPct) / 100;
      const qSimulatedValue = unitPrice * qSimulatedQty;
      const commPct = Number(rate.commission_percent) / 100;
      const commFixed = Number(rate.fixed_amount);
      totalCommission += qSimulatedValue * commPct + commFixed * qSimulatedQty;
    });

    // Bônus de faixa
    const planTiers = tiers.filter((t) => t.plan_id === plan.id);
    const activeTier = [...planTiers]
      .sort((a, b) => Number(b.min_achievement_percent) - Number(a.min_achievement_percent))
      .find((t) => achievementPct >= Number(t.min_achievement_percent) &&
        (t.max_achievement_percent == null || achievementPct < Number(t.max_achievement_percent)));

    const bonusBase = Number(plan.bonus_base_value);
    const multiplier = activeTier ? Number(activeTier.bonus_multiplier) : 0;
    const bonusValue = bonusBase * multiplier;

    // Bônus Adicional sem teto (acima do threshold)
    const uncappedEnabled = (plan as any).uncapped_bonus_enabled;
    const uncappedThreshold = Number((plan as any).uncapped_threshold_percent || 0);
    const uncappedPerSale = Number((plan as any).uncapped_bonus_per_sale || 0);
    const uncappedType = (plan as any).uncapped_bonus_type || "fixed";

    let uncappedBonus = 0;
    let extraSales = 0;
    let salesAtThreshold = 0;
    if (uncappedEnabled && achievementPct > uncappedThreshold && avgTicket > 0) {
      salesAtThreshold = (totalTargetQty * uncappedThreshold) / 100;
      extraSales = Math.max(0, simulatedQty - salesAtThreshold);
      if (uncappedType === "fixed") {
        uncappedBonus = extraSales * uncappedPerSale;
      } else {
        // percent: aplica % sobre o valor das vendas extras
        const extraValue = extraSales * avgTicket;
        uncappedBonus = (extraValue * uncappedPerSale) / 100;
      }
    }

    // Bônus trimestral/anual: mostrados como info (não somam no mensal por padrão)
    const quarterlyBonus = plan.quarterly_bonus_enabled && achievementPct >= 100
      ? Number(plan.quarterly_bonus_value) : 0;
    const annualBonus = (plan as any).annual_bonus_enabled && achievementPct >= 100
      ? Number((plan as any).annual_bonus_value) : 0;

    // OTE
    const userOTE = userOTEs.find((o) => o.user_id === selectedUserId);
    const monthlyBase = userOTE ? Number(userOTE.base_salary_annual) / 12 : 0;

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
  }, [selectedUserId, achievementPct, quotas, productRates, tiers, plans, userOTEs, products, users]);

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
                <p className="text-[10px] text-muted-foreground">{simulation.totalTargetQty} vendas</p>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <p className="text-muted-foreground">Simulado ({achievementPct}%)</p>
                <p className="font-semibold">{fmt(simulation.simulatedValue)}</p>
                <p className="text-[10px] text-muted-foreground">≈ {simulation.simulatedQty.toFixed(1)} vendas</p>
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" />
                  Salário Base
                </div>
                <p className="font-bold text-sm">{simulation.monthlyBase > 0 ? fmt(simulation.monthlyBase) : "—"}</p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5" />
                  Comissão Produtos
                </div>
                <p className="font-bold text-sm">{fmt(simulation.totalCommission)}</p>
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
                    {simulation.extraSales.toFixed(1)} venda(s) extra
                  </p>
                )}
              </div>
              <div className="p-3 rounded-lg border bg-primary/10 border-primary/30 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <Trophy className="h-3.5 w-3.5 text-primary" />
                  Ganho Mensal
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
                {achievementPct > simulation.uncappedThreshold ? (
                  <p className="text-muted-foreground">
                    Limite ≈ {simulation.salesAtThreshold.toFixed(1)} vendas. Acima disso, cada venda extra paga{" "}
                    {simulation.uncappedType === "fixed"
                      ? <strong>{fmt(simulation.uncappedPerSale)}</strong>
                      : <strong>{simulation.uncappedPerSale}% do valor</strong>}
                    . {simulation.extraSales.toFixed(1)} vendas extras × {simulation.uncappedType === "fixed" ? fmt(simulation.uncappedPerSale) : `${simulation.uncappedPerSale}%`} = <strong>{fmt(simulation.uncappedBonus)}</strong>
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Aumente o atingimento acima de {simulation.uncappedThreshold}% para ativar este bônus.
                  </p>
                )}
              </div>
            )}

            {/* Bônus trimestral/anual (informativo) */}
            {(simulation.quarterlyBonus > 0 || simulation.annualBonus > 0) && (
              <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded border space-y-1">
                <p className="font-medium text-foreground">Bônus complementares (não somados ao mensal):</p>
                {simulation.quarterlyBonus > 0 && (
                  <p>⚡ Trimestral: {fmt(simulation.quarterlyBonus)} (pago no fechamento do trimestre se atingir 100%)</p>
                )}
                {simulation.annualBonus > 0 && (
                  <p>🏆 Anual: {fmt(simulation.annualBonus)} (pago no fechamento do ano se atingir 100%)</p>
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
