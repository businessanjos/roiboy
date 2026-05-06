import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  useCsIncentivePlans,
  type CsIncentivePlan,
} from "@/hooks/useCsIncentivePlans";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Gift,
  Target,
  TrendingDown,
  Star,
  ShieldAlert,
  CheckCircle2,
  Plus,
  Trash2,
  Save,
  Loader2,
  Users,
  ListChecks,
  RefreshCw,
} from "lucide-react";
import { PAYMENT_CHANNELS } from "@/components/sales/quotas/paymentChannels";
import { fetchActiveConsultants } from "@/lib/consultants";


function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const parseNumberInput = (value: string) => (value === "" ? "" : Number(value));
const toNumber = (value: unknown, fallback = 0) => {
  if (value === "" || value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const DEFAULT_ROUTINES = [
  "Reunião 1:1 quinzenal com cada cliente",
  "QBR (Quarterly Business Review) trimestral",
  "Follow-up de NPS após cada interação chave",
  "Revisão semanal de saúde da carteira",
  "Plano de renovação iniciado a 90 dias do vencimento",
];

export function CsIncentivePlanSection() {
  const { currentUser } = useCurrentUser();
  const { plans, tiers, loading, savePlan, deletePlan, saveTiers } = useCsIncentivePlans();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cs-incentive-consultants"] }),
        queryClient.invalidateQueries({ queryKey: ["cs-incentive-quarter-payouts"] }),
        queryClient.invalidateQueries({ queryKey: ["cs-incentive-plans"] }),
        queryClient.invalidateQueries({ queryKey: ["cs-incentive-tiers"] }),
        queryClient.invalidateQueries({ queryKey: ["consultant-bonus-payouts"] }),
      ]);
      toast.success("Dados atualizados");
    } finally {
      setRefreshing(false);
    }
  };
  // Consultoras ativas (puxando salário base do RH) — fonte única em @/lib/consultants
  const { data: consultants = [] } = useQuery({
    queryKey: ["cs-incentive-consultants", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: fetchActiveConsultants,
  });

  // Trimestre atual (1..4) e meses correspondentes
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const quarterMonths = [
    currentQuarter * 3 - 2,
    currentQuarter * 3 - 1,
    currentQuarter * 3,
  ];

  // Soma do bônus apurado no trimestre atual, por consultora (user_id)
  const { data: quarterPayouts = {} as Record<string, number> } = useQuery({
    queryKey: [
      "cs-incentive-quarter-payouts",
      currentUser?.account_id,
      currentYear,
      currentQuarter,
    ],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultant_bonus_payouts")
        .select("user_id, bonus_paid")
        .eq("year", currentYear)
        .in("month", quarterMonths);
      if (error) throw error;
      const acc: Record<string, number> = {};
      for (const row of (data || []) as any[]) {
        acc[row.user_id] = (acc[row.user_id] || 0) + Number(row.bonus_paid || 0);
      }
      return acc;
    },
  });

  // "team" = plano-modelo do time (sem cargo). Caso contrário, é um cargo (role_label).
  const ROLE_OPTIONS = ["CS Júnior", "CS Pleno", "CS Sênior", "Líder"] as const;
  const [selectedScope, setSelectedScope] = useState<string>("team");

  const activePlan: CsIncentivePlan | null = useMemo(() => {
    if (selectedScope === "team") {
      return plans.find((p) => p.is_active && !p.user_id && !p.role_label) ?? null;
    }
    return plans.find((p) => p.is_active && p.role_label === selectedScope) ?? null;
  }, [plans, selectedScope]);

  // Local state
  const [form, setForm] = useState<Partial<CsIncentivePlan>>({});
  const [draftTiers, setDraftTiers] = useState<
    { min: number | ""; max: string; multiplier: number | ""; label: string }[]
  >([]);

  useEffect(() => {
    // Sugestão de salário base: menor salário entre as consultoras desse cargo
    const roleConsultants =
      selectedScope !== "team"
        ? consultants.filter((c: any) => c.role_label === selectedScope)
        : [];
    const suggestedSalary =
      roleConsultants.length > 0
        ? Math.min(...roleConsultants.map((c: any) => c.base_salary || 0).filter((v) => v > 0)) || 0
        : 0;

    if (activePlan) {
      setForm({ ...activePlan });
      const planTiers = tiers.filter((t) => t.plan_id === activePlan.id);
      setDraftTiers(
        planTiers.length > 0
          ? planTiers.map((t) => ({
              min: Number(t.min_achievement_percent),
              max: t.max_achievement_percent != null ? String(t.max_achievement_percent) : "",
              multiplier: Number(t.bonus_multiplier),
              label: t.label || "",
            }))
          : defaultTiers()
      );
    } else {
      setForm({
        name:
          selectedScope === "team"
            ? "Plano CS — Time"
            : `Plano CS — ${selectedScope}`,
        description: "",
        is_active: true,
        user_id: null,
        role_label: selectedScope === "team" ? null : selectedScope,
        base_salary_monthly: suggestedSalary,
        variable_target_monthly: 0,
        minimum_achievement_percent: 70,
        weight_renewal: 50,
        weight_churn: 30,
        weight_nps: 20,
        monthly_bonus_value: 0,
        monthly_bonus_payment_channel: "folha",
        quarterly_bonus_enabled: false,
        quarterly_bonus_value: 0,
        quarterly_bonus_rules: "",
        quarterly_bonus_payment_channel: "ferias_co",
        annual_bonus_enabled: false,
        annual_bonus_value: 0,
        annual_bonus_rules: "",
        annual_bonus_payment_channel: "ferias_co",
        churn_penalty_enabled: false,
        churn_penalty_threshold: 10,
        churn_penalty_percent: 50,
        routines: DEFAULT_ROUTINES,
        notes: "",
        bonus_budget_amount: 0,
        bonus_budget_value_type: "absolute",
        bonus_budget_period: "quarterly",
        bonus_budget_percent_base: "renewal_revenue",
        bonus_payment_channel: "folha",
        bonus_payment_when: "Até o 5º dia útil após o fechamento do período",
        bonus_distribution_method: "equal",
        bonus_distribution_shares: {},
      });
      setDraftTiers(defaultTiers());
    }
  }, [activePlan, selectedScope, tiers, consultants]);

  function defaultTiers() {
    return [
      { min: 0, max: "20", multiplier: 0, label: "Não atinge — zera o bônus" },
      { min: 21, max: "39", multiplier: 0.7, label: "Parcial — 70% do bônus" },
      { min: 40, max: "", multiplier: 1, label: "Meta atingida — 100% do bônus" },
    ];
  }

  const setF = (k: keyof CsIncentivePlan, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const totalWeight =
    toNumber(form.weight_renewal) +
    toNumber(form.weight_churn) +
    toNumber(form.weight_nps);

  const handleSave = async () => {
    const normalizedForm = {
      ...form,
      base_salary_monthly: toNumber(form.base_salary_monthly),
      variable_target_monthly: toNumber(form.variable_target_monthly),
      minimum_achievement_percent: toNumber(form.minimum_achievement_percent),
      weight_renewal: toNumber(form.weight_renewal),
      weight_churn: toNumber(form.weight_churn),
      weight_nps: toNumber(form.weight_nps),
      monthly_bonus_value: toNumber(form.monthly_bonus_value),
      quarterly_bonus_value: toNumber(form.quarterly_bonus_value),
      annual_bonus_value: toNumber(form.annual_bonus_value),
      churn_penalty_threshold: toNumber(form.churn_penalty_threshold),
      churn_penalty_percent: toNumber(form.churn_penalty_percent),
      bonus_budget_amount: toNumber(form.bonus_budget_amount),
      bonus_distribution_method: "equal" as const,
      bonus_distribution_shares: {},
    };
    const saved = await savePlan.mutateAsync(normalizedForm);
    if (saved?.id) {
      await saveTiers.mutateAsync({
        planId: saved.id,
        tiers: draftTiers.map((t) => ({
          plan_id: saved.id,
          min_achievement_percent: toNumber(t.min),
          max_achievement_percent: t.max ? parseFloat(t.max) : null,
          bonus_multiplier: toNumber(t.multiplier),
          label: t.label || null,
        })),
      });
    }
  };

  const addTier = () => {
    const last = draftTiers[draftTiers.length - 1];
    const newMin = last ? (last.max ? parseFloat(last.max) : toNumber(last.min) + 20) : 0;
    setDraftTiers([...draftTiers, { min: newMin, max: "", multiplier: 1, label: "" }]);
  };

  const updateRoutine = (idx: number, value: string) => {
    const arr = [...(form.routines || [])];
    arr[idx] = value;
    setF("routines", arr);
  };
  const addRoutine = () => setF("routines", [...(form.routines || []), ""]);
  const removeRoutine = (idx: number) =>
    setF("routines", (form.routines || []).filter((_, i) => i !== idx));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sticky save bar */}
      <div className="sticky top-0 z-30 -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Plano de Incentivo — Customer Success</span>
          {activePlan ? (
            <Badge variant="secondary" className="text-[10px]">Ativo</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Novo</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Aplicar para:</Label>
          <Select value={selectedScope} onValueChange={setSelectedScope}>
            <SelectTrigger className="w-[260px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="team">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" /> Time inteiro (modelo)
                </div>
              </SelectItem>
              {ROLE_OPTIONS.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activePlan && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => deletePlan.mutate(activePlan.id)}
              className="text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={savePlan.isPending} className="gap-1.5">
            {savePlan.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      {/* Identificação */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" /> Identificação
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Nome do plano</Label>
            <Input value={form.name || ""} onChange={(e) => setF("name", e.target.value)} />
          </div>
          <div>
            <Label>Descrição curta</Label>
            <Input
              value={form.description || ""}
              onChange={(e) => setF("description", e.target.value)}
              placeholder="Ex: Plano 2026 do time de CS"
            />
          </div>
        </CardContent>
      </Card>

      {/* Orçamento do Bônus */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" /> Orçamento do Bônus
          </CardTitle>
          <CardDescription>
            Defina o budget total do bônus do time de CS, periodicidade, canal e como será distribuído entre as consultoras.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Tipo de valor</Label>
              <Select
                value={form.bonus_budget_value_type || "absolute"}
                onValueChange={(v) => setF("bonus_budget_value_type", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="absolute">Valor absoluto (R$)</SelectItem>
                  <SelectItem value="percent">Percentual (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>
                {form.bonus_budget_value_type === "percent" ? "Percentual (%)" : "Valor (R$)"}
              </Label>
              <Input
                type="number"
                step={form.bonus_budget_value_type === "percent" ? "0.1" : "1"}
                value={form.bonus_budget_amount ?? ""}
                onChange={(e) => setF("bonus_budget_amount", parseNumberInput(e.target.value))}
              />
            </div>
            <div>
              <Label>Periodicidade</Label>
              <Select
                value={form.bonus_budget_period || "quarterly"}
                onValueChange={(v) => setF("bonus_budget_period", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="quarterly">Trimestral</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.bonus_budget_value_type === "percent" && (
            <div>
              <Label>Base de cálculo do percentual</Label>
              <Select
                value={form.bonus_budget_percent_base || "renewal_revenue"}
                onValueChange={(v) => setF("bonus_budget_percent_base", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="renewal_revenue">Faturamento de renovações</SelectItem>
                  <SelectItem value="total_revenue">Faturamento total da carteira</SelectItem>
                  <SelectItem value="base_salary">Salário base</SelectItem>
                  <SelectItem value="variable_target">Meta variável</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Por onde será pago</Label>
              <Select
                value={form.bonus_payment_channel || "folha"}
                onValueChange={(v) => setF("bonus_payment_channel", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quando será pago</Label>
              <Input
                value={form.bonus_payment_when || ""}
                onChange={(e) => setF("bonus_payment_when", e.target.value)}
                placeholder="Ex: Até o 5º dia útil após o fechamento do trimestre"
              />
            </div>
          </div>

        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Remuneração & Meta variável</CardTitle>
          <CardDescription>
            Valores mensais de referência (informativos para apuração de bônus)
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Salário base mensal (R$)</Label>
            <Input
              type="number"
              value={form.base_salary_monthly ?? ""}
              onChange={(e) => setF("base_salary_monthly", parseNumberInput(e.target.value))}
            />
          </div>
          <div>
            <Label>Meta variável mensal (R$)</Label>
            <Input
              type="number"
              value={form.variable_target_monthly ?? ""}
              onChange={(e) => setF("variable_target_monthly", parseNumberInput(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Métricas estrela */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Métricas-estrela & Pesos</CardTitle>
          <CardDescription>
            Soma dos pesos deve totalizar 100. Atingimento global = média ponderada.
            {totalWeight !== 100 && (
              <Badge variant="destructive" className="ml-2">
                Soma atual: {totalWeight}
              </Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricInput
            icon={<Target className="h-4 w-4 text-emerald-500" />}
            label="Taxa de Renovação"
            value={form.weight_renewal ?? 0}
            onChange={(v) => setF("weight_renewal", v)}
          />
          <MetricInput
            icon={<TrendingDown className="h-4 w-4 text-rose-500" />}
            label="Churn"
            value={form.weight_churn ?? 0}
            onChange={(v) => setF("weight_churn", v)}
          />
          <MetricInput
            icon={<Star className="h-4 w-4 text-amber-500" />}
            label="NPS"
            value={form.weight_nps ?? 0}
            onChange={(v) => setF("weight_nps", v)}
          />
        </CardContent>
      </Card>

      {/* Bônus mensal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" /> Bônus Mensal
          </CardTitle>
          <CardDescription>
            Pago quando atingimento global ≥ mínimo. Faixas abaixo aplicam multiplicador.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Valor base (R$)</Label>
            <Input
              type="number"
              value={form.monthly_bonus_value ?? ""}
              onChange={(e) => setF("monthly_bonus_value", parseNumberInput(e.target.value))}
            />
          </div>
          <div>
            <Label>Canal de pagamento</Label>
            <Select
              value={form.monthly_bonus_payment_channel || "folha"}
              onValueChange={(v) => setF("monthly_bonus_payment_channel", v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_CHANNELS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tiers */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Faixas de Atingimento do Bônus</CardTitle>
            <CardDescription>
              Defina, por faixa de % atingida, qual percentual do bônus é pago.
              Use <strong>0%</strong> para zerar o bônus, <strong>70%</strong> para pagamento parcial e
              {" "}<strong>100%</strong> (ou mais) quando a meta for batida. A faixa final pode ficar com{" "}
              <em>Até %</em> em branco para representar "ou mais".
            </CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDraftTiers(defaultTiers())}
              title="Aplicar template padrão (0–20: 0%, 21–39: 70%, 40+: 100%)"
            >
              Template padrão
            </Button>
            <Button size="sm" variant="outline" onClick={addTier} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Adicionar faixa
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>De %</TableHead>
                <TableHead>Até %</TableHead>
                <TableHead>% do bônus pago</TableHead>
                <TableHead>
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 cursor-help">
                          Valor no trimestre
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="space-y-1 text-xs">
                          <p className="font-semibold">Fórmula</p>
                          <p>Valor base mensal × 3 meses × % do bônus da faixa</p>
                          <p className="text-muted-foreground">
                            Usa o campo "Valor do bônus mensal" do plano e a "% do bônus pago" desta faixa.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draftTiers.map((t, i) => {
                const pct = Math.round((toNumber(t.multiplier) || 0) * 100);
                const tone =
                  pct === 0
                    ? "text-rose-600"
                    : pct >= 100
                    ? "text-emerald-600"
                    : "text-amber-600";
                const monthly = toNumber(form.monthly_bonus_value);
                const quarterValue = monthly * 3 * (toNumber(t.multiplier) || 0);
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <Input
                        type="number"
                        value={t.min}
                        onChange={(e) => {
                          const v = [...draftTiers];
                          v[i].min = parseNumberInput(e.target.value);
                          setDraftTiers(v);
                        }}
                        className="w-20 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={t.max}
                        onChange={(e) => {
                          const v = [...draftTiers];
                          v[i].max = e.target.value;
                          setDraftTiers(v);
                        }}
                        placeholder="ou mais"
                        className="w-24 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="1"
                          value={pct}
                          onChange={(e) => {
                            const v = [...draftTiers];
                            const num = parseFloat(e.target.value);
                            v[i].multiplier = isNaN(num) ? 0 : num / 100;
                            setDraftTiers(v);
                          }}
                          className={`w-20 h-8 font-semibold ${tone}`}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-semibold ${tone}`}>
                        {formatBRL(quarterValue)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={t.label}
                        onChange={(e) => {
                          const v = [...draftTiers];
                          v[i].label = e.target.value;
                          setDraftTiers(v);
                        }}
                        className="h-8"
                        placeholder="Ex: Não atinge, Parcial, Meta batida"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDraftTiers(draftTiers.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-3">
            Exemplo: meta de 40% de renovação → 0–20% paga 0% (zera), 21–39% paga 70%, a partir de 40% paga 100%.
          </p>
        </CardContent>
      </Card>

      {/* Bônus trimestral & anual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BonusBlock
          title="Bônus Trimestral"
          enabled={!!form.quarterly_bonus_enabled}
          onToggle={(v) => setF("quarterly_bonus_enabled", v)}
          value={form.quarterly_bonus_value ?? 0}
          onValueChange={(v) => setF("quarterly_bonus_value", v)}
          rules={form.quarterly_bonus_rules || ""}
          onRulesChange={(v) => setF("quarterly_bonus_rules", v)}
          channel={form.quarterly_bonus_payment_channel || "ferias_co"}
          onChannelChange={(v) => setF("quarterly_bonus_payment_channel", v)}
          rulesPlaceholder="Ex: Renovação ≥ 85% nos 3 meses + NPS ≥ 70"
        />
        <BonusBlock
          title="Bônus Anual"
          enabled={!!form.annual_bonus_enabled}
          onToggle={(v) => setF("annual_bonus_enabled", v)}
          value={form.annual_bonus_value ?? 0}
          onValueChange={(v) => setF("annual_bonus_value", v)}
          rules={form.annual_bonus_rules || ""}
          onRulesChange={(v) => setF("annual_bonus_rules", v)}
          channel={form.annual_bonus_payment_channel || "ferias_co"}
          onChannelChange={(v) => setF("annual_bonus_payment_channel", v)}
          rulesPlaceholder="Ex: Churn anual < 8% + Renovação ≥ 90%"
        />
      </div>

      {/* Penalidade churn */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-500" /> Penalidade por Churn
          </CardTitle>
          <CardDescription>
            Reduz o bônus mensal quando o churn ultrapassar o limite definido.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Ativar penalidade</Label>
            <Switch
              checked={!!form.churn_penalty_enabled}
              onCheckedChange={(v) => setF("churn_penalty_enabled", v)}
            />
          </div>
          {form.churn_penalty_enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Limite de churn (%)</Label>
                <Input
                  type="number"
                  value={form.churn_penalty_threshold ?? ""}
                  onChange={(e) => setF("churn_penalty_threshold", parseNumberInput(e.target.value))}
                />
              </div>
              <div>
                <Label>Redução do bônus (%)</Label>
                <Input
                  type="number"
                  value={form.churn_penalty_percent ?? ""}
                  onChange={(e) => setF("churn_penalty_percent", parseNumberInput(e.target.value))}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rotinas / rituais */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" /> Rotinas & Rituais de CS
            </CardTitle>
            <CardDescription>
              Cadência mínima esperada da consultora para sustentar a meta.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={addRoutine} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(form.routines || []).map((r, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={r}
                onChange={(e) => updateRoutine(i, e.target.value)}
                placeholder="Ex: 1:1 quinzenal com cada cliente"
              />
              <Button size="icon" variant="ghost" onClick={() => removeRoutine(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {(form.routines || []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma rotina cadastrada.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Notas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Observações</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={3}
            value={form.notes || ""}
            onChange={(e) => setF("notes", e.target.value)}
            placeholder="Regras especiais, exceções, contexto..."
          />
        </CardContent>
      </Card>

      {/* Resumo */}
      {form.monthly_bonus_value ? (
        <Card className="bg-muted/30">
          <CardContent className="p-4 text-sm flex flex-wrap items-center gap-x-6 gap-y-2">
            <span>
              Variável mensal alvo:{" "}
              <strong>{formatBRL(toNumber(form.variable_target_monthly))}</strong>
            </span>
            <span>
              Bônus mensal base:{" "}
              <strong className="text-amber-600">
                {formatBRL(toNumber(form.monthly_bonus_value))}
              </strong>
            </span>
            <span>
              Piso para começar a pagar:{" "}
              <strong>
                {(() => {
                  const paying = draftTiers.filter((t) => toNumber(t.multiplier) > 0);
                  if (paying.length === 0) return "—";
                  const min = Math.min(...paying.map((t) => toNumber(t.min)));
                  return `${min}%`;
                })()}
              </strong>
            </span>
          </CardContent>
        </Card>
      ) : null}

      {/* Simulador */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Simulador de bônus
          </CardTitle>
          <CardDescription>
            Informe o % de renovação atingido e veja o impacto no bônus e no total trimestral (salário bruto + bônus).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BonusSimulator
            monthlyBonus={toNumber(form.monthly_bonus_value)}
            baseSalary={toNumber(form.base_salary_monthly)}
            tiers={draftTiers}
            scope={selectedScope}
            churnPenaltyEnabled={!!form.churn_penalty_enabled}
            churnPenaltyThreshold={toNumber(form.churn_penalty_threshold)}
            churnPenaltyPercent={toNumber(form.churn_penalty_percent)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function BonusSimulator({
  monthlyBonus,
  baseSalary,
  tiers,
  scope,
  churnPenaltyEnabled,
  churnPenaltyThreshold,
  churnPenaltyPercent,
}: {
  monthlyBonus: number;
  baseSalary: number;
  tiers: { min: number | ""; max: string; multiplier: number | ""; label: string }[];
  scope: string;
  churnPenaltyEnabled: boolean;
  churnPenaltyThreshold: number;
  churnPenaltyPercent: number;
}) {
  const [renewalPct, setRenewalPct] = useState<number | "">(100);
  // Churn editável: por padrão segue 100 − % renovação, mas pode ser sobrescrito
  // manualmente para simular cenários (ex.: testar penalidade de churn).
  const [churnOverride, setChurnOverride] = useState<number | "">("");
  const churnPct =
    churnOverride === ""
      ? Math.max(0, Math.min(100, 100 - toNumber(renewalPct)))
      : Math.max(0, Math.min(100, toNumber(churnOverride)));
  const pct = toNumber(renewalPct);

  // Senioridade do plano selecionado, para filtrar produtos atendidos
  const seniorityKey = useMemo(() => {
    if (scope === "team") return null;
    if (/j[uú]nior/i.test(scope)) return "junior";
    if (/pleno/i.test(scope)) return "pleno";
    if (/s[eê]nior/i.test(scope)) return "senior";
    if (/l[ií]der/i.test(scope)) return "lead";
    return null;
  }, [scope]);

  // Total de contratos expirando entre Maio e Dezembro de 2026, filtrado pelos
  // produtos atendidos pela senioridade do plano (ex.: CS Júnior só atende Rykas).
  const { data: totalRenewableContracts = 0 } = useQuery({
    queryKey: ["bonus-simulator-renewable-contracts-2026", seniorityKey],
    queryFn: async () => {
      let productIds: string[] | null = null;
      if (seniorityKey) {
        const { data: prods, error: pErr } = await supabase
          .from("products")
          .select("id, consultant_seniority");
        if (pErr) throw pErr;
        productIds = (prods || [])
          .filter((p: any) => Array.isArray(p.consultant_seniority) && p.consultant_seniority.includes(seniorityKey))
          .map((p: any) => p.id);
        if (productIds.length === 0) return 0;
      }

      // Mesma lógica do painel de Renovações: status='active', sem parent,
      // e excluindo contratos cujo cliente já tem um sucessor ativo do mesmo
      // produto começando perto do vencimento (renovação já fechada).
      let q = supabase
        .from("client_contracts")
        .select("id, client_id, product_id, end_date")
        .gte("end_date", "2026-05-01")
        .lte("end_date", "2026-12-31")
        .eq("status", "active")
        .is("parent_contract_id", null);
      if (productIds) q = q.in("product_id", productIds);
      const { data: candidates, error } = await q;
      if (error) throw error;

      const list = candidates || [];
      if (list.length === 0) return 0;

      const clientIds = [...new Set(list.map((c: any) => c.client_id))];
      const { data: peers } = await supabase
        .from("client_contracts")
        .select("id, client_id, product_id, start_date")
        .in("client_id", clientIds)
        .eq("status", "active")
        .is("parent_contract_id", null);

      const peersByClient: Record<string, any[]> = {};
      (peers || []).forEach((p: any) => {
        (peersByClient[p.client_id] ||= []).push(p);
      });

      const filtered = list.filter((c: any) => {
        const oldEnd = new Date(c.end_date);
        const windowStart = new Date(oldEnd); windowStart.setDate(windowStart.getDate() - 30);
        const windowEnd = new Date(oldEnd); windowEnd.setDate(windowEnd.getDate() + 365);
        const hasSuccessor = (peersByClient[c.client_id] || []).some((p) => {
          if (p.id === c.id) return false;
          if (c.product_id && p.product_id && p.product_id !== c.product_id) return false;
          const start = new Date(p.start_date);
          return start >= windowStart && start <= windowEnd;
        });
        return !hasSuccessor;
      });
      return filtered.length;
    },
    staleTime: 5 * 60_000,
  });

  const matched = useMemo(() => {
    return tiers.find((t) => {
      const min = toNumber(t.min);
      const max = t.max ? parseFloat(t.max) : Infinity;
      return pct >= min && pct <= max;
    });
  }, [tiers, pct]);

  const multiplier = matched ? toNumber(matched.multiplier) || 0 : 0;
  const attainmentPct = Math.round(multiplier * 100);
  const absoluteRenewals = Math.round((pct / 100) * totalRenewableContracts);

  // Penalidade por churn: se ativada, ao ultrapassar o limite, aplica desconto
  // de churn_penalty_percent (%) sobre o bônus do mês. Caso contrário, sem desconto.
  const churnInput = churnPct;
  const churnTriggered =
    churnPenaltyEnabled && churnInput > churnPenaltyThreshold;
  const grossMonthlyBonus = monthlyBonus * multiplier;
  const churnDiscountValue = churnTriggered
    ? grossMonthlyBonus * (churnPenaltyPercent / 100)
    : 0;
  const monthlyBonusValue = Math.max(0, grossMonthlyBonus - churnDiscountValue);
  const quarterBonus = monthlyBonusValue * 3;
  const quarterSalary = baseSalary * 3;
  const quarterTotal = quarterSalary + quarterBonus;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">% de renovação</Label>
          <Input
            type="number"
            value={renewalPct ?? ""}
            onChange={(e) => setRenewalPct(parseNumberInput(e.target.value))}
            placeholder="Ex: 85"
          />
        </div>
        <div>
          <Label className="text-xs">% de atingimento (auto)</Label>
          <Input
            value={matched ? `${attainmentPct}%` : "—"}
            disabled
          />
        </div>
        <div>
          <Label className="text-xs">Renovações (nº absoluto)</Label>
          <Input
            value={`${absoluteRenewals} de ${totalRenewableContracts}`}
            disabled
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Base: contratos ativos com vencimento entre Mai/2026 e Dez/2026.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Bônus mensal base</Label>
          <Input value={formatBRL(monthlyBonus)} disabled />
        </div>
        <div>
          <Label className="text-xs">Salário bruto mensal</Label>
          <Input value={formatBRL(baseSalary)} disabled />
        </div>
        <div>
          <Label className="text-xs">% de churn</Label>
          <Input
            type="number"
            value={churnOverride === "" ? churnPct : churnOverride}
            onChange={(e) => setChurnOverride(parseNumberInput(e.target.value))}
            placeholder="Ex: 12"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Padrão: 100% − % de renovação. Edite para simular outro cenário.
            {churnOverride !== "" && (
              <button
                type="button"
                onClick={() => setChurnOverride("")}
                className="ml-1 underline hover:text-foreground"
              >
                resetar
              </button>
            )}
            {churnPenaltyEnabled
              ? ` Acima de ${churnPenaltyThreshold}% desconta ${churnPenaltyPercent}% do bônus.`
              : " Penalidade por churn desativada."}
            {churnTriggered && (
              <span className="text-rose-600"> Desconto aplicado: −{formatBRL(churnDiscountValue)}</span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-md border p-3 bg-muted/30">
          <div className="text-xs text-muted-foreground">Bônus no mês</div>
          <div className="text-lg font-semibold text-amber-600">{formatBRL(monthlyBonusValue)}</div>
        </div>
        <div className="rounded-md border p-3 bg-muted/30">
          <div className="text-xs text-muted-foreground">Bônus no trimestre</div>
          <div className="text-lg font-semibold text-amber-600">{formatBRL(quarterBonus)}</div>
        </div>
        <div className="rounded-md border p-3 bg-primary/5 border-primary/30">
          <div className="text-xs text-muted-foreground">Trimestre: salário bruto + bônus</div>
          <div className="text-lg font-semibold text-primary">{formatBRL(quarterTotal)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {formatBRL(quarterSalary)} salário + {formatBRL(quarterBonus)} bônus
          </div>
        </div>
      </div>

      {matched?.label && (
        <p className="text-xs text-muted-foreground">{matched.label}</p>
      )}
    </div>
  );
}

function MetricInput({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        {icon} {label} (peso %)
      </Label>
      <Input type="number" value={value ?? ""} onChange={(e) => onChange(parseNumberInput(e.target.value))} />
    </div>
  );
}

function BonusBlock(props: {
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  value: number | "";
  onValueChange: (v: number | "") => void;
  rules: string;
  onRulesChange: (v: string) => void;
  channel: string;
  onChannelChange: (v: string) => void;
  rulesPlaceholder?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" /> {props.title}
          </CardTitle>
          <Switch checked={props.enabled} onCheckedChange={props.onToggle} />
        </div>
      </CardHeader>
      {props.enabled && (
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                value={props.value ?? ""}
                onChange={(e) => props.onValueChange(parseNumberInput(e.target.value))}
              />
            </div>
            <div>
              <Label>Canal</Label>
              <Select value={props.channel} onValueChange={props.onChannelChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Regras</Label>
            <Textarea
              rows={2}
              value={props.rules}
              onChange={(e) => props.onRulesChange(e.target.value)}
              placeholder={props.rulesPlaceholder}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
