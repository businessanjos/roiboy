import { useState, useMemo, useEffect } from "react";
import { computeRouletteBasis } from "./rouletteBasis";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calculator, TrendingUp, DollarSign, Wallet, Trophy, Zap, Target, Gift } from "lucide-react";
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

const VANESSA_USER_ID = "1ac1c97c-bff6-4174-b48c-9b524b404ce6";

export function CommissionSimulator({ presentationMode = false }: { presentationMode?: boolean } = {}) {
  const now = new Date();
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { plans, productRates, tiers, quotas, spiffs } = useQuotasIncentives(year, month);

  type PayMix = { id: string; qty: number; parcelas: number; entryPercent: number };
  const STORAGE_KEY = "commission-simulator-presentation-state";
  const persisted = (() => {
    if (!presentationMode) return null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  const [selectedUserId, setSelectedUserId] = useState(persisted?.selectedUserId ?? (presentationMode ? VANESSA_USER_ID : ""));
  const [simMode, setSimMode] = useState<"percent" | "sales">(persisted?.simMode ?? "percent");
  const [achievementPct, setAchievementPct] = useState<number>(persisted?.achievementPct ?? 100);
  const [salesCount, setSalesCount] = useState<number>(persisted?.salesCount ?? 7);
  const [spiffOverrides, setSpiffOverrides] = useState<Record<string, { included: boolean; estimate: number | null }>>(persisted?.spiffOverrides ?? {});
  const [paymentMix, setPaymentMix] = useState<PayMix[]>(persisted?.paymentMix ?? [
    { id: "row-1", qty: 7, parcelas: 1, entryPercent: 100 },
  ]);

  useEffect(() => {
    if (!presentationMode) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        selectedUserId, simMode, achievementPct, salesCount, spiffOverrides, paymentMix,
      }));
    } catch {}
  }, [presentationMode, selectedUserId, simMode, achievementPct, salesCount, spiffOverrides, paymentMix]);

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

    // Em modo "sales", o atingimento é derivado do nº de vendas informado
    const effectiveAchievementPct = simMode === "sales" && totalTargetQty > 0
      ? (salesCount / totalTargetQty) * 100
      : achievementPct;

    const simulatedValue = (totalTargetValue * effectiveAchievementPct) / 100;
    const simulatedQty = simMode === "sales" ? salesCount : simulatedValue / avgTicket;
    const wholeSalesCount = Math.floor(simulatedQty);
    const commissionableValue = wholeSalesCount * avgTicket;

    // ── Mix de Pagamento (à vista / cartão Nx) ──
    // Normaliza: usa o que o usuário configurou, mas se a soma != wholeSalesCount,
    // ainda assim calcula com o que foi declarado (não força).
    const mixRows = paymentMix.filter((r) => r.qty > 0);
    const mixTotalQty = mixRows.reduce((s, r) => s + r.qty, 0);
    const mixEntryCaptured = mixRows.reduce((s, r) => {
      const pct = r.parcelas === 1 ? 100 : Math.max(0, Math.min(100, r.entryPercent));
      return s + r.qty * avgTicket * (pct / 100);
    }, 0);

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
      .find((t) => effectiveAchievementPct >= Number(t.min_achievement_percent) &&
        (t.max_achievement_percent == null || effectiveAchievementPct <= Number(t.max_achievement_percent)));

    // Fallback: acima do maior tier conhecido → mantém o último
    const topTier = planTiers[planTiers.length - 1];
    if (!activeTier && topTier && effectiveAchievementPct > Number(topTier.max_achievement_percent ?? topTier.min_achievement_percent)) {
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
    const quarterlyBonus = plan.quarterly_bonus_enabled && effectiveAchievementPct >= QUARTERLY_BONUS_THRESHOLD
      ? Number(plan.quarterly_bonus_value) : 0;
    const annualBonus = (plan as any).annual_bonus_enabled && effectiveAchievementPct >= ANNUAL_BONUS_THRESHOLD
      ? Number((plan as any).annual_bonus_value) : 0;

    // ── Salário Base: vem do RH (hr_collaborators.salary) ──
    const collab = collaborators.find((c) => c.user_id === selectedUserId);
    const monthlyBase = collab ? Number(collab.salary) : 0;

    // ── SPIFFs: estimativa de prêmios pagos ao vendedor pelas vendas simuladas ──
    // Considera apenas SPIFFs ativos cujo período cobre o mês simulado e que se aplicam
    // ao produto da simulação (Rykas Mentoring) ou a "Todos" (product_id null).
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const applicableSpiffs = (spiffs ?? []).filter((s: any) => {
      if (!s.is_active) return false;
      const sd = s.start_date ? new Date(s.start_date) : null;
      const ed = s.end_date ? new Date(s.end_date) : null;
      if (sd && sd > monthEnd) return false;
      if (ed && ed < monthStart) return false;
      if (s.product_id && mentoringProduct?.id && s.product_id !== mentoringProduct.id) return false;
      return true;
    });

    const spiffBreakdown: Array<{ id: string; name: string; estimate: number; computed: number; detail: string; included: boolean; overridden: boolean }> = [];
    let spiffTotal = 0;
    for (const s of applicableSpiffs as any[]) {
      const prizeType = s.prize_type || "fixed";
      let computed = 0;
      let detail = "";

      if (prizeType === "roulette") {
        const r = computeRouletteBasis({
          mixRowsCount: mixRows.length,
          mixEntryCaptured,
          commissionableValue,
          triggerPerValue: Number(s.trigger_per_value || 0),
          rouletteMinPrize: Number(s.roulette_min_prize || 0),
          rouletteMaxPrize: Number(s.roulette_max_prize || 0),
        });
        computed = r.estimate;
        detail = `${r.spins} giro(s) × ~${fmt(r.avgPrize)} (cada ${fmt(Number(s.trigger_per_value || 0))} de ${r.basisLabel})`;
      } else if (prizeType === "custom") {
        const target = Number(s.trigger_sales_count || 0);
        const times = target > 0 ? Math.floor(wholeSalesCount / target) : 0;
        computed = 0;
        detail = times > 0
          ? `${times}× — ${s.custom_prize_description || "prêmio personalizado"}`
          : `Precisa de ${target} venda(s)`;
      } else if (prizeType === "payment_method") {
        // Calcula bônus aplicando cada faixa às linhas do Mix de Pagamento
        const tiers = Array.isArray(s.payment_tiers) ? s.payment_tiers : [];
        let bonusSum = 0;
        let matched = 0;
        for (const row of mixRows) {
          for (const t of tiers as any[]) {
            const min = Number(t.min_parcelas || 1);
            const max = Number(t.max_parcelas || min);
            const isCash = row.parcelas === 1;
            const matchesParcelas = row.parcelas >= min && row.parcelas <= max;
            const matchesCash = isCash && t.includes_cash;
            if (matchesParcelas || matchesCash) {
              bonusSum += row.qty * Number(t.bonus || 0);
              matched += row.qty;
              break;
            }
          }
        }
        computed = bonusSum;
        detail = matched > 0
          ? `${matched} venda(s) elegível(eis) em ${tiers.length} faixa(s)`
          : `${tiers.length} faixa(s) — nenhuma venda do mix se enquadrou`;
      } else {
        const target = Number(s.target_quantity || 0);
        const times = target > 0 ? Math.floor(wholeSalesCount / target) : 0;
        if (s.bonus_type === "fixed") {
          computed = times * Number(s.bonus_amount || 0);
          detail = `${times}× ${fmt(Number(s.bonus_amount || 0))} (cada ${target} unid.)`;
        } else {
          computed = (times * target * avgTicket * Number(s.bonus_amount || 0)) / 100;
          detail = `${times}× ${s.bonus_amount}% sobre ${target} unid.`;
        }
      }

      const ov = spiffOverrides[s.id];
      const included = ov?.included ?? true;
      const overridden = ov?.estimate != null;
      const estimate = overridden ? Number(ov!.estimate) : computed;

      if (included) spiffTotal += estimate;
      spiffBreakdown.push({ id: s.id, name: s.name, estimate, computed, detail, included, overridden });
    }

    const totalEarnings = monthlyBase + totalCommission + bonusValue + uncappedBonus + spiffTotal;

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
      spiffTotal,
      spiffBreakdown,
      mixRows,
      mixTotalQty,
      mixEntryCaptured,
      totalEarnings,
      effectiveAchievementPct,
    };
  }, [selectedUserId, simMode, achievementPct, salesCount, spiffOverrides, paymentMix, quotas, productRates, tiers, plans, spiffs, collaborators, products, salesPositionIds]);

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
        <div className={`grid grid-cols-1 ${presentationMode ? "" : "md:grid-cols-2"} gap-4`}>
          {!presentationMode && (
            <div className="space-y-2">
              <Label>Vendedor</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                {simMode === "percent" ? (
                  <>Atingimento da Meta: <span className="font-bold text-primary">{achievementPct}%</span></>
                ) : (
                  <>Nº de Vendas: <span className="font-bold text-primary">{salesCount}</span>
                    {simulation && !simulation.noPlan && (
                      <span className="text-muted-foreground font-normal"> ({Math.round(simulation.effectiveAchievementPct)}% da meta)</span>
                    )}
                  </>
                )}
              </Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={simMode === "percent" ? "default" : "outline"}
                  className="h-6 px-2 text-[10px]"
                  onClick={() => {
                    // Ao voltar para %, deriva do nº de vendas atual se possível
                    if (simulation && !simulation.noPlan && simMode === "sales") {
                      setAchievementPct(Math.round(simulation.effectiveAchievementPct));
                    }
                    setSimMode("percent");
                  }}
                >
                  % Meta
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={simMode === "sales" ? "default" : "outline"}
                  className="h-6 px-2 text-[10px]"
                  onClick={() => {
                    // Ao ir para Nº Vendas, deriva do % atual
                    if (simulation && !simulation.noPlan && simMode === "percent") {
                      setSalesCount(Math.floor(simulation.simulatedQty));
                    }
                    setSimMode("sales");
                  }}
                >
                  Nº Vendas
                </Button>
              </div>
            </div>
            {simMode === "percent" ? (
              <>
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
              </>
            ) : (
              <Input
                type="number"
                min={0}
                step={1}
                value={salesCount === 0 ? "" : salesCount}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") { setSalesCount(0); return; }
                  setSalesCount(Math.max(0, Number(v) || 0));
                }}
                placeholder="Ex: 7"
              />
            )}
          </div>
        </div>

        {simulation?.noPlan && (
          <div className="text-sm text-center text-muted-foreground py-4 border rounded-lg bg-muted/30">
            ⚠️ Este vendedor não possui plano de incentivo vinculado ao seu cargo.
          </div>
        )}

        {simulation && !simulation.noPlan && (
          <>
            {/* Mix de Pagamento — composição das vendas simuladas */}
            <div className="text-xs p-3 rounded-lg border bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-purple-600" />
                  Mix de Pagamento
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant={simulation.mixTotalQty > simulation.wholeSalesCount ? "secondary" : "default"} className="text-[10px]">
                    {simulation.mixTotalQty} / {simulation.wholeSalesCount} c/ spiff
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[10px] gap-1"
                    onClick={() => setPaymentMix((prev) => [...prev, { id: `row-${Date.now()}`, qty: 1, parcelas: 1, entryPercent: 100 }])}
                  >
                    + linha
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                {paymentMix.map((row) => (
                  <div key={row.id} className="grid grid-cols-12 gap-1.5 items-center">
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min={0}
                        value={row.qty || ""}
                        placeholder="Qtd"
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value) || 0);
                          setPaymentMix((prev) => prev.map((r) => r.id === row.id ? { ...r, qty: v } : r));
                        }}
                        className="h-7 text-xs text-center"
                      />
                    </div>
                    <div className="col-span-3">
                      <Select
                        value={String(row.parcelas)}
                        onValueChange={(v) => setPaymentMix((prev) => prev.map((r) => r.id === row.id ? { ...r, parcelas: Number(v), entryPercent: Number(v) === 1 ? 100 : r.entryPercent } : r))}
                      >
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">À vista / Pix</SelectItem>
                          {[2,3,4,5,6,7,8,9,10,11,12].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}x cartão</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          disabled={row.parcelas === 1}
                          value={row.parcelas === 1 ? 100 : row.entryPercent}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                            setPaymentMix((prev) => prev.map((r) => r.id === row.id ? { ...r, entryPercent: v } : r));
                          }}
                          className="h-7 text-xs text-right"
                        />
                        <span className="text-[10px] text-muted-foreground">% entrada</span>
                      </div>
                    </div>
                    <div className="col-span-3 text-right text-muted-foreground">
                      Entrada: <strong className="text-foreground">{fmt(row.qty * simulation.avgTicket * ((row.parcelas === 1 ? 100 : row.entryPercent) / 100))}</strong>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setPaymentMix((prev) => prev.filter((r) => r.id !== row.id))}
                        title="Remover"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-1.5 border-t border-purple-200/50 dark:border-purple-900/50 space-y-0.5">
                <p className="text-foreground">
                  <strong>{simulation.mixTotalQty} vendas</strong>
                  {(() => {
                    const grouped: Record<string, number> = {};
                    for (const r of simulation.mixRows) {
                      const key = r.parcelas === 1 ? "à vista / Pix" : `${r.parcelas}x cartão`;
                      grouped[key] = (grouped[key] || 0) + r.qty;
                    }
                    const parts = Object.entries(grouped).map(([k, v]) => `${v} ${k}`);
                    return parts.length > 0 ? `, sendo ${parts.join(" + ")}` : "";
                  })()}
                </p>
                <p className="text-foreground">
                  Captação de entrada: <strong className="text-purple-700 dark:text-purple-400">{fmt(simulation.mixEntryCaptured)}</strong>
                  <span className="text-muted-foreground"> {" "}· Volume total: {fmt(simulation.mixTotalQty * simulation.avgTicket)}</span>
                </p>
                {simulation.mixTotalQty > simulation.wholeSalesCount && (
                  <p className="text-[10px] text-amber-700 dark:text-amber-400">
                    ⚠ A soma do mix ({simulation.mixTotalQty}) excede o nº de vendas simuladas ({simulation.wholeSalesCount}).
                  </p>
                )}
                {simulation.mixTotalQty < simulation.wholeSalesCount && (
                  <p className="text-[10px] text-muted-foreground">
                    {simulation.wholeSalesCount - simulation.mixTotalQty} venda(s) em formas sem spiff (cheque, transferência mensal, etc.) — não geram bônus de forma de pagamento.
                  </p>
                )}
              </div>
            </div>

            {/* Detalhamento de Spiffs */}
            {simulation.spiffBreakdown.length > 0 && (
              <div className="text-xs p-3 rounded-lg border bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-900 space-y-1.5">
                <p className="font-medium flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5 text-pink-600" />
                  Spiffs estimados ({fmt(simulation.spiffTotal)})
                </p>
                <ul className="space-y-1.5">
                  {simulation.spiffBreakdown.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-muted-foreground">
                      <Checkbox
                        checked={s.included}
                        onCheckedChange={(checked) =>
                          setSpiffOverrides((prev) => ({
                            ...prev,
                            [s.id]: { included: !!checked, estimate: prev[s.id]?.estimate ?? null },
                          }))
                        }
                        className="h-3.5 w-3.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate">
                          <strong className="text-foreground">{s.name}</strong>
                          {" "}<span className="text-[10px]">— {s.detail}</span>
                        </p>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={s.estimate || ""}
                        placeholder={fmt(s.computed)}
                        disabled={!s.included}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSpiffOverrides((prev) => ({
                            ...prev,
                            [s.id]: {
                              included: prev[s.id]?.included ?? true,
                              estimate: v === "" ? null : Math.max(0, Number(v) || 0),
                            },
                          }));
                        }}
                        className="h-7 w-28 text-xs text-right"
                      />
                      {s.overridden && (
                        <button
                          type="button"
                          className="text-[10px] text-primary hover:underline"
                          onClick={() =>
                            setSpiffOverrides((prev) => ({
                              ...prev,
                              [s.id]: { included: prev[s.id]?.included ?? true, estimate: null },
                            }))
                          }
                          title="Restaurar valor calculado"
                        >
                          ↺
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] italic text-muted-foreground pt-1">
                  Edite o valor ou desmarque para excluir do total. Roleta usa média entre prêmio mín. e máx.; prêmios não monetários ficam zerados (ajuste manualmente se quiser somar).
                </p>
              </div>
            )}

            {/* Contexto da simulação */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-2 rounded border bg-muted/20">
                <p className="text-muted-foreground">Meta total</p>
                <p className="font-semibold">{fmt(simulation.totalTargetValue)}</p>
                <p className="text-[10px] text-muted-foreground">= {Math.round(simulation.totalTargetQty)} vendas (ticket {fmt(simulation.avgTicket)})</p>
              </div>
              <div className="p-2 rounded border bg-muted/20">
                <p className="text-muted-foreground">Simulado ({Math.round(simulation.effectiveAchievementPct)}%)</p>
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
              <div className="p-3 rounded-lg border bg-pink-500/10 border-pink-500/30 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-pink-700 dark:text-pink-400">
                  <Gift className="h-3.5 w-3.5" />
                  Spiffs (estimado)
                </div>
                <p className="font-bold text-sm">{fmt(simulation.spiffTotal)}</p>
                {simulation.spiffBreakdown.length > 0 ? (
                  <p className="text-[10px] text-muted-foreground">
                    {simulation.spiffBreakdown.length} campanha(s) ativa(s)
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">Nenhum SPIFF aplicável</p>
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
