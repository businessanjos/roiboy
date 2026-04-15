import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingUp, DollarSign, Wallet, Trophy } from "lucide-react";
import { useQuotasIncentives } from "@/hooks/useQuotasIncentives";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const SALES_USER_IDS = [
  "de43a643-0109-4afb-ac35-be768dbf4090",
  "1232ec15-5f66-4b5f-9e74-f40d436f9d0f",
  "d20201f6-a9bd-4934-ae50-07ce7a47574b",
  "1d090543-1853-4cd0-bdb4-02e17a5df4d8",
  "1ac1c97c-bff6-4174-b48c-9b524b404ce6",
  "cefc44c7-d2e2-4937-94ac-069c1c94731b",
];

const fmt = (v: number) => `R$ ${(v / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export function CommissionSimulator() {
  const now = new Date();
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { activePlan, productRates, tiers, quotas, userOTEs } = useQuotasIncentives(year, month);
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

  const simulation = useMemo(() => {
    if (!selectedUserId || !activePlan) return null;

    const userQuotas = quotas.filter((q) => q.user_id === selectedUserId);
    const totalTargetValue = userQuotas.reduce((s, q) => s + Number(q.target_value), 0);
    const simulatedValue = (totalTargetValue * achievementPct) / 100;

    // Commission per product
    let totalCommission = 0;
    userQuotas.forEach((q) => {
      if (!q.product_id) return;
      const rate = productRates.find((r) => r.product_id === q.product_id);
      if (!rate) return;
      const qAchievedValue = (Number(q.target_value) * achievementPct) / 100;
      const commPct = Number(rate.commission_percent) / 100;
      const commFixed = Number(rate.fixed_amount);
      const qAchievedQty = Math.round((Number(q.target_quantity) * achievementPct) / 100);
      totalCommission += qAchievedValue * commPct + commFixed * qAchievedQty;
    });

    // Bonus from tiers
    const activeTier = [...tiers]
      .sort((a, b) => Number(b.min_achievement_percent) - Number(a.min_achievement_percent))
      .find((t) => achievementPct >= Number(t.min_achievement_percent) &&
        (t.max_achievement_percent == null || achievementPct < Number(t.max_achievement_percent)));

    const bonusBase = Number(activePlan.bonus_base_value);
    const multiplier = activeTier ? Number(activeTier.bonus_multiplier) : 0;
    const bonusValue = bonusBase * multiplier;

    // Quarterly bonus
    const quarterlyBonus = activePlan.quarterly_bonus_enabled && achievementPct >= 100
      ? Number(activePlan.quarterly_bonus_value) / 3 // pro-rate per month
      : 0;

    // OTE context
    const userOTE = userOTEs.find((o) => o.user_id === selectedUserId);
    const monthlyBase = userOTE ? Number(userOTE.base_salary_annual) / 12 : 0;

    const totalEarnings = monthlyBase + totalCommission + bonusValue + quarterlyBonus;

    return {
      totalTargetValue,
      simulatedValue,
      totalCommission,
      activeTier,
      bonusValue,
      multiplier,
      quarterlyBonus,
      monthlyBase,
      totalEarnings,
    };
  }, [selectedUserId, achievementPct, quotas, productRates, tiers, activePlan, userOTEs]);

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
              max={200}
              step={5}
              className="mt-2"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
              <span>150%</span>
              <span>200%</span>
            </div>
          </div>
        </div>

        {simulation && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" />
                Salário Base
              </div>
              <p className="font-bold text-sm">{simulation.monthlyBase > 0 ? fmt(simulation.monthlyBase) : "Não definido"}</p>
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
              <p className="font-bold text-sm">
                {fmt(simulation.bonusValue)}
                {simulation.activeTier && (
                  <Badge variant="outline" className="ml-2 text-[9px]">
                    {simulation.activeTier.label || `${simulation.multiplier}x`}
                  </Badge>
                )}
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-primary/10 border-primary/20 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Trophy className="h-3.5 w-3.5 text-primary" />
                Ganho Total Mensal
              </div>
              <p className="font-bold text-lg text-primary">{fmt(simulation.totalEarnings)}</p>
            </div>
          </div>
        )}

        {simulation && simulation.quarterlyBonus > 0 && (
          <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 p-2 rounded border border-amber-200 dark:border-amber-800">
            ⚡ Bônus trimestral proporcional: +{fmt(simulation.quarterlyBonus)}/mês ao atingir meta no trimestre
          </div>
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
