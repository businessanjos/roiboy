import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Plus, Trash2, Gift, Percent, DollarSign, ShieldAlert, Zap, TrendingUp, TrendingDown, CheckCircle2, Loader2, Briefcase, Target, Trophy } from "lucide-react";
import { useQuotasIncentives, IncentivePlan } from "@/hooks/useQuotasIncentives";
import { useHRPositions } from "@/hooks/useHRPositions";
import { useHRDepartments } from "@/hooks/useHRDepartments";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SpiffsSection } from "./SpiffsSection";
import { OTESection } from "./OTESection";
import { CommissionSimulator } from "./CommissionSimulator";

export function IncentivePlanSection() {
  const now = new Date();
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { plans, productRates, tiers, loading, savePlan, saveProductRate, saveTiers } = useQuotasIncentives(now.getFullYear(), now.getMonth() + 1);
  const { positions: allPositions, loading: positionsLoading } = useHRPositions();
  const { departments } = useHRDepartments();

  // Only show sales-related positions (Comercial department)
  const salesDeptIds = departments
    .filter((d) => /comercial|vendas|sales/i.test(d.name))
    .map((d) => d.id);
  const positions = allPositions.filter((p) => p.department_id && salesDeptIds.includes(p.department_id));

  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);

  // Derive active plan for selected position
  const activePlan: IncentivePlan | null = plans.find(
    (p) => p.is_active && p.position_id === selectedPositionId
  ) ?? null;

  // Derive product rates and tiers for this plan
  const planProductRates = activePlan
    ? productRates.filter((r) => r.plan_id === activePlan.id)
    : [];
  const planTiers = activePlan
    ? tiers.filter((t) => t.plan_id === activePlan.id)
    : [];

  const [planName, setPlanName] = useState("");
  const [planDesc, setPlanDesc] = useState("");
  const [bonusBase, setBonusBase] = useState(0);
  const [quotaValue, setQuotaValue] = useState(0);
  const [goalValue, setGoalValue] = useState(0);
  const [minimumAchievement, setMinimumAchievement] = useState(40);
  const [clawbackEnabled, setClawbackEnabled] = useState(false);
  const [clawbackDays, setClawbackDays] = useState(90);
  const [clawbackPercent, setClawbackPercent] = useState(100);
  const [quarterlyBonusEnabled, setQuarterlyBonusEnabled] = useState(false);
  const [quarterlyBonusValue, setQuarterlyBonusValue] = useState(0);
  const [quarterlyBonusRules, setQuarterlyBonusRules] = useState("");
  const [annualBonusEnabled, setAnnualBonusEnabled] = useState(false);
  const [annualBonusValue, setAnnualBonusValue] = useState(0);
  const [annualBonusRules, setAnnualBonusRules] = useState("");
  const [draftRates, setDraftRates] = useState<Record<string, { percent: number; fixed: number }>>({});
  const [draftTiers, setDraftTiers] = useState<{ min: number; max: string; multiplier: number; label: string }[]>([]);

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

  const products = productsQuery.data ?? [];

  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  // Auto-select first position
  useEffect(() => {
    if (!selectedPositionId && positions.length > 0) {
      setSelectedPositionId(positions[0].id);
    }
  }, [positions, selectedPositionId]);

  // Sync state from active plan for this position
  useEffect(() => {
    initializedRef.current = false;
    setDraftRates({});
    if (activePlan) {
      setPlanName(activePlan.name);
      setPlanDesc(activePlan.description || "");
      setBonusBase(Number(activePlan.bonus_base_value));
      setQuotaValue(Number(activePlan.quota_value || 0));
      setGoalValue(Number(activePlan.goal_value || 0));
      setMinimumAchievement(Number(activePlan.minimum_achievement_percent ?? 40));
      setClawbackEnabled(activePlan.clawback_enabled);
      setClawbackDays(activePlan.clawback_days);
      setClawbackPercent(Number(activePlan.clawback_percent));
      setQuarterlyBonusEnabled(activePlan.quarterly_bonus_enabled);
      setQuarterlyBonusValue(Number(activePlan.quarterly_bonus_value));
    } else {
      // Defaults for new plan
      const pos = positions.find((p) => p.id === selectedPositionId);
      setPlanName(pos ? `Plano ${pos.title}` : "Novo Plano");
      setPlanDesc("");
      setBonusBase(0);
      setQuotaValue(0);
      setGoalValue(0);
      setMinimumAchievement(40);
      setClawbackEnabled(false);
      setClawbackDays(90);
      setClawbackPercent(100);
      setQuarterlyBonusEnabled(false);
      setQuarterlyBonusValue(0);
    }
    setTimeout(() => { initializedRef.current = true; }, 150);
  }, [activePlan, selectedPositionId]);

  useEffect(() => {
    if (planTiers.length > 0) {
      initializedRef.current = false;
      setDraftTiers(
        planTiers.map((t) => ({
          min: Number(t.min_achievement_percent),
          max: t.max_achievement_percent != null ? String(t.max_achievement_percent) : "",
          multiplier: Number(t.bonus_multiplier),
          label: t.label || "",
        }))
      );
      setTimeout(() => { initializedRef.current = true; }, 150);
    } else if (!activePlan) {
      setDraftTiers([
        { min: 0, max: "80", multiplier: 0, label: "Abaixo da Meta" },
        { min: 80, max: "100", multiplier: 0.5, label: "Bronze" },
        { min: 100, max: "120", multiplier: 1, label: "Prata" },
        { min: 120, max: "", multiplier: 1.5, label: "Ouro" },
      ]);
    }
  }, [planTiers, activePlan]);

  // ── Smart autosave ──
  const hasPlanChanges = useCallback(() => {
    if (!activePlan) return planName.trim().length > 0;
    return (
      planName !== activePlan.name ||
      planDesc !== (activePlan.description || "") ||
      bonusBase !== Number(activePlan.bonus_base_value) ||
      quotaValue !== Number(activePlan.quota_value || 0) ||
      goalValue !== Number(activePlan.goal_value || 0) ||
      minimumAchievement !== Number(activePlan.minimum_achievement_percent ?? 40) ||
      clawbackEnabled !== activePlan.clawback_enabled ||
      clawbackDays !== activePlan.clawback_days ||
      clawbackPercent !== Number(activePlan.clawback_percent) ||
      quarterlyBonusEnabled !== activePlan.quarterly_bonus_enabled ||
      quarterlyBonusValue !== Number(activePlan.quarterly_bonus_value)
    );
  }, [activePlan, planName, planDesc, bonusBase, quotaValue, goalValue, minimumAchievement, clawbackEnabled, clawbackDays, clawbackPercent, quarterlyBonusEnabled, quarterlyBonusValue]);

  const hasTierChanges = useCallback(() => {
    if (draftTiers.length !== planTiers.length) return true;
    return draftTiers.some((dt, i) => {
      const st = planTiers[i];
      if (!st) return true;
      return (
        dt.min !== Number(st.min_achievement_percent) ||
        dt.max !== (st.max_achievement_percent != null ? String(st.max_achievement_percent) : "") ||
        dt.multiplier !== Number(st.bonus_multiplier) ||
        dt.label !== (st.label || "")
      );
    });
  }, [draftTiers, planTiers]);

  const hasRateChanges = Object.keys(draftRates).length > 0;

  useEffect(() => {
    if (!initializedRef.current || !selectedPositionId) return;
    const planChanged = hasPlanChanges();
    const tierChanged = hasTierChanges();
    if (!planChanged && !tierChanged && !hasRateChanges) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus("saving");
      try {
        // Always ensure plan exists first; capture its id for downstream saves
        let planId = activePlan?.id ?? plans.find((p) => p.position_id === selectedPositionId && p.is_active)?.id ?? null;
        if (planChanged || !planId) {
          const saved = await handleSavePlanSilent();
          planId = saved?.id ?? planId;
        }
        if (hasRateChanges && planId) await handleSaveRatesSilent(planId);
        if (tierChanged && planId) await handleSaveTiersSilent(planId);
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
      } catch {
        setAutoSaveStatus("idle");
      }
    }, 1500);

    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [planName, planDesc, bonusBase, quotaValue, goalValue, minimumAchievement, clawbackEnabled, clawbackDays, clawbackPercent, quarterlyBonusEnabled, quarterlyBonusValue, draftRates, draftTiers]);

  const getRate = (productId: string) => {
    if (draftRates[productId]) return draftRates[productId];
    const existing = planProductRates.find((r) => r.product_id === productId);
    return existing ? { percent: Number(existing.commission_percent) || 0, fixed: Number(existing.fixed_amount) || 0 } : { percent: 0, fixed: 0 };
  };

  const handleSavePlanSilent = async () => {
    return await savePlan.mutateAsync({
      id: activePlan?.id,
      name: planName,
      description: planDesc,
      bonus_base_value: bonusBase,
      quota_value: quotaValue,
      goal_value: goalValue,
      minimum_achievement_percent: minimumAchievement,
      is_active: true,
      clawback_enabled: clawbackEnabled,
      clawback_days: clawbackDays,
      clawback_percent: clawbackPercent,
      quarterly_bonus_enabled: quarterlyBonusEnabled,
      quarterly_bonus_value: quarterlyBonusValue,
      position_id: selectedPositionId,
    });
  };

  const handleSaveRatesSilent = async (planId: string) => {
    const entries = Object.entries(draftRates);
    if (entries.length === 0) return;
    for (const [productId, rate] of entries) {
      await saveProductRate.mutateAsync({
        plan_id: planId,
        product_id: productId,
        commission_percent: rate.percent,
        fixed_amount: rate.fixed,
      });
    }
    setDraftRates({});
  };

  const handleSaveTiersSilent = async (planId: string) => {
    await saveTiers.mutateAsync({
      planId,
      tiers: draftTiers.map((t) => ({
        plan_id: planId,
        min_achievement_percent: t.min,
        max_achievement_percent: t.max ? parseFloat(t.max) : null,
        bonus_multiplier: t.multiplier,
        label: t.label || null,
      })),
    });
  };

  const addTier = () => {
    const last = draftTiers[draftTiers.length - 1];
    const newMin = last ? (last.max ? parseFloat(last.max) : last.min + 20) : 0;
    setDraftTiers([...draftTiers, { min: newMin, max: "", multiplier: 1, label: "" }]);
  };

  const removeTier = (idx: number) => {
    setDraftTiers(draftTiers.filter((_, i) => i !== idx));
  };

  const getTierIcon = (min: number) => {
    if (min >= 100) return <TrendingUp className="h-3.5 w-3.5 text-green-600" />;
    if (min >= 80) return <DollarSign className="h-3.5 w-3.5 text-yellow-600" />;
    return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  };

  const getTierBadge = (min: number) => {
    if (min >= 100) return <Badge variant="default" className="text-[10px]">Acelerador</Badge>;
    if (min >= 80) return <Badge variant="secondary" className="text-[10px]">Base</Badge>;
    return <Badge variant="outline" className="text-[10px] text-destructive border-destructive">Desacelerador</Badge>;
  };

  if (loading || productsQuery.isLoading || positionsLoading) {
    return <div className="space-y-3"><Skeleton className="h-10 w-60" /><Skeleton className="h-64" /></div>;
  }

  const selectedPosition = positions.find((p) => p.id === selectedPositionId);

  const handleManualSave = async () => {
    if (!selectedPositionId) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setAutoSaveStatus("saving");
    try {
      let planId = activePlan?.id ?? plans.find((p) => p.position_id === selectedPositionId && p.is_active)?.id ?? null;
      const saved = await handleSavePlanSilent();
      planId = saved?.id ?? planId;
      if (planId) {
        if (Object.keys(draftRates).length > 0) await handleSaveRatesSilent(planId);
        await handleSaveTiersSilent(planId);
      }
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 2000);
    } catch {
      setAutoSaveStatus("idle");
    }
  };

  const isSaving = autoSaveStatus === "saving" || savePlan.isPending || saveProductRate.isPending || saveTiers.isPending;

  return (
    <div className="space-y-6">
      {/* ── Sticky Save Bar ── */}
      <div className="sticky top-0 z-30 -mx-4 px-4 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Plano de Incentivo</span>
          {selectedPosition && (
            <Badge variant="secondary" className="text-[10px]">{selectedPosition.title}</Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {autoSaveStatus === "saving" && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...
            </span>
          )}
          {autoSaveStatus === "saved" && (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Salvo
            </span>
          )}
          <Button size="sm" onClick={handleManualSave} disabled={isSaving || !selectedPositionId} className="gap-1.5">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* ── Position Selector ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Plano por Cargo
              </CardTitle>
              <CardDescription>Cada cargo possui seu próprio plano de incentivo</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {positions.filter((p) => p.is_active).map((pos) => {
              const hasPlan = plans.some((pl) => pl.position_id === pos.id && pl.is_active);
              const isSelected = selectedPositionId === pos.id;
              return (
                <Button
                  key={pos.id}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                  onClick={() => setSelectedPositionId(pos.id)}
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  {pos.title}
                  {hasPlan && (
                    <Badge variant="secondary" className="text-[10px] ml-1">
                      <CheckCircle2 className="h-3 w-3 mr-0.5" />
                      Configurado
                    </Badge>
                  )}
                </Button>
              );
            })}
            {positions.filter((p) => p.is_active).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum cargo cadastrado. Cadastre cargos na área de RH para configurar planos de incentivo.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedPositionId && (
        <>
          {/* ── Plan Config ── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Gift className="h-4 w-4" />
                    Configuração — {selectedPosition?.title}
                  </CardTitle>
                  <CardDescription>Modelo híbrido: comissão por produto + bônus por atingimento + aceleradores</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {autoSaveStatus === "saving" && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...
                    </span>
                  )}
                  {autoSaveStatus === "saved" && (
                    <span className="flex items-center gap-1.5 text-xs text-green-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Salvo
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Plano</Label>
                  <Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="Ex: Plano Comercial 2026" />
                </div>
                <div className="space-y-2">
                  <Label>Bônus Base Mensal (R$) — ao atingir 100%</Label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      className="pl-8"
                      value={bonusBase ? bonusBase.toLocaleString("pt-BR") : ""}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "");
                        setBonusBase(digits ? parseInt(digits, 10) : 0);
                      }}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Meta / Super Meta / Mínimo */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Meta, Super Meta e Mínimo</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Trophy className="h-3.5 w-3.5 text-amber-600" />
                      Meta (R$) — 100%
                    </Label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        className="pl-8"
                        value={goalValue ? goalValue.toLocaleString("pt-BR") : ""}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          setGoalValue(digits ? parseInt(digits, 10) : 0);
                        }}
                        placeholder="640.000"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">Objetivo principal (100%) — comissão cheia ao atingir.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Zap className="h-3.5 w-3.5 text-green-600" />
                      Super Meta (R$) — Acelerador
                    </Label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        className="pl-8"
                        value={quotaValue ? quotaValue.toLocaleString("pt-BR") : ""}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          setQuotaValue(digits ? parseInt(digits, 10) : 0);
                        }}
                        placeholder="800.000"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">Patamar acima da meta que ativa o acelerador de comissão.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                      Atingimento Mínimo (%)
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="pr-8"
                        value={minimumAchievement}
                        onChange={(e) => setMinimumAchievement(parseFloat(e.target.value) || 0)}
                        placeholder="40"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Abaixo deste % da meta, o vendedor não recebe comissão.</p>
                  </div>
                </div>
                {goalValue > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                    <Badge variant="outline" className="font-normal">
                      Mínimo: R$ {((goalValue * minimumAchievement) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </Badge>
                    <Badge variant="outline" className="font-normal">
                      Meta: R$ {goalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </Badge>
                    {quotaValue > 0 && (
                      <Badge variant="outline" className="font-normal">
                        Super Meta (acelerador): R$ {quotaValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Descrição / Regras</Label>
                <Textarea value={planDesc} onChange={(e) => setPlanDesc(e.target.value)} rows={3} placeholder="Descreva as regras gerais do plano..." />
              </div>

              {/* Quarterly Bonus */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium">Bônus Trimestral</p>
                    <p className="text-xs text-muted-foreground">Bônus adicional por atingimento da meta no trimestre</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {quarterlyBonusEnabled && (
                    <div className="relative w-40">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        className="pl-8 text-right"
                        value={quarterlyBonusValue ? quarterlyBonusValue.toLocaleString("pt-BR") : ""}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          setQuarterlyBonusValue(digits ? parseInt(digits, 10) : 0);
                        }}
                        placeholder="0"
                      />
                    </div>
                  )}
                  <Switch checked={quarterlyBonusEnabled} onCheckedChange={setQuarterlyBonusEnabled} />
                </div>
              </div>

              {/* Clawback */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="text-sm font-medium">Clawback (Estorno de Comissão)</p>
                    <p className="text-xs text-muted-foreground">Devolução de comissão se o cliente cancelar dentro do prazo</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {clawbackEnabled && (
                    <>
                      <div className="text-right">
                        <Label className="text-[10px] text-muted-foreground">Prazo (dias)</Label>
                        <Input type="number" className="w-20 text-center" value={clawbackDays} onChange={(e) => setClawbackDays(parseInt(e.target.value) || 90)} />
                      </div>
                      <div className="text-right">
                        <Label className="text-[10px] text-muted-foreground">Estorno (%)</Label>
                        <Input type="number" className="w-20 text-center" value={clawbackPercent} onChange={(e) => setClawbackPercent(parseFloat(e.target.value) || 100)} />
                      </div>
                    </>
                  )}
                  <Switch checked={clawbackEnabled} onCheckedChange={setClawbackEnabled} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Commission per product ── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Comissão por Produto — {selectedPosition?.title}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Preço (R$)</TableHead>
                    <TableHead className="text-center w-[130px]">Comissão (%)</TableHead>
                    <TableHead className="text-center w-[150px]">Valor Fixo (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const rate = getRate(product.id);
                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {(Number(product.price) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            className="w-24 text-center mx-auto"
                            value={rate.percent || ""}
                            onChange={(e) => setDraftRates((prev) => ({
                              ...prev,
                              [product.id]: { ...getRate(product.id), percent: parseFloat(e.target.value) || 0 },
                            }))}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="text"
                            inputMode="numeric"
                            className="w-32 text-center mx-auto"
                            value={rate.fixed ? rate.fixed.toLocaleString("pt-BR") : ""}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, "");
                              setDraftRates((prev) => ({
                                ...prev,
                                [product.id]: { ...getRate(product.id), fixed: digits ? parseInt(digits, 10) : 0 },
                              }));
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* ── Bonus Tiers ── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Faixas de Atingimento — {selectedPosition?.title}
                  </CardTitle>
                  <CardDescription>Multiplicadores sobre o bônus base. Abaixo de 80% = desacelerador, acima de 100% = acelerador</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={addTier} className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Faixa
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Tipo</TableHead>
                    <TableHead className="w-[120px]">Label</TableHead>
                    <TableHead className="text-center w-[110px]">De (%)</TableHead>
                    <TableHead className="text-center w-[110px]">Até (%)</TableHead>
                    <TableHead className="text-center w-[120px]">Multiplicador</TableHead>
                    <TableHead className="text-right w-[130px]">Bônus (R$)</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draftTiers.map((tier, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getTierIcon(tier.min)}
                          {getTierBadge(tier.min)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={tier.label}
                          onChange={(e) => {
                            const t = [...draftTiers];
                            t[idx] = { ...t[idx], label: e.target.value };
                            setDraftTiers(t);
                          }}
                          placeholder="Ex: Ouro"
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          value={(tier as any)._minStr ?? (tier.min || "")}
                          onChange={(e) => {
                            const t = [...draftTiers];
                            const v = e.target.value;
                            t[idx] = { ...t[idx], min: v === "" ? 0 : parseFloat(v) || 0, _minStr: v } as any;
                            setDraftTiers(t);
                          }}
                          className="w-20 text-center mx-auto"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          value={tier.max}
                          onChange={(e) => {
                            const t = [...draftTiers];
                            t[idx] = { ...t[idx], max: e.target.value };
                            setDraftTiers(t);
                          }}
                          className="w-20 text-center mx-auto"
                          placeholder="∞"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          step={0.1}
                          value={(tier as any)._multStr ?? (tier.multiplier || "")}
                          onChange={(e) => {
                            const t = [...draftTiers];
                            const v = e.target.value;
                            t[idx] = { ...t[idx], multiplier: v === "" ? 0 : parseFloat(v) || 0, _multStr: v } as any;
                            setDraftTiers(t);
                          }}
                          className="w-20 text-center mx-auto"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {bonusBase > 0 ? `R$ ${((bonusBase || 0) * (tier.multiplier || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeTier(idx)} className="h-8 w-8">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {draftTiers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhuma faixa configurada. Clique em "+ Faixa" para adicionar.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── OTE Section ── */}
      <OTESection year={now.getFullYear()} />

      {/* ── SPIFFs Section ── */}
      <SpiffsSection />

      {/* ── Commission Simulator ── */}
      <CommissionSimulator />
    </div>
  );
}
