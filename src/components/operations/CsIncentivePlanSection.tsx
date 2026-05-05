import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { PAYMENT_CHANNELS } from "@/components/sales/quotas/paymentChannels";

const CONSULTANT_NAMES = ["andréia", "andreia", "dayara", "michele", "ana"];

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

  // Consultoras ativas (puxando salário base do RH)
  const { data: consultants = [] } = useQuery({
    queryKey: ["cs-incentive-consultants", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("hr_collaborators")
        .select("id, full_name, email, user_id, status, base_salary")
        .eq("status", "active")
        .not("user_id", "is", null)
        .order("full_name");
      return (data || [])
        .filter((c: any) => {
          const n = (c.full_name || "").toLowerCase();
          return CONSULTANT_NAMES.some((k) => n.includes(k));
        })
        .map((c: any) => ({
          id: c.user_id,
          name: c.full_name,
          email: c.email,
          base_salary: Number(c.base_salary) || 0,
        }));
    },
  });

  // "team" = plano-modelo do time (user_id null)
  const [selectedScope, setSelectedScope] = useState<string>("team");

  useEffect(() => {
    // nothing
  }, [selectedScope]);

  const activePlan: CsIncentivePlan | null = useMemo(() => {
    if (selectedScope === "team") {
      return plans.find((p) => p.is_active && !p.user_id) ?? null;
    }
    return plans.find((p) => p.is_active && p.user_id === selectedScope) ?? null;
  }, [plans, selectedScope]);

  // Local state
  const [form, setForm] = useState<Partial<CsIncentivePlan>>({});
  const [draftTiers, setDraftTiers] = useState<
    { min: number | ""; max: string; multiplier: number | ""; label: string }[]
  >([]);

  useEffect(() => {
    const consultant =
      selectedScope !== "team"
        ? consultants.find((c: any) => c.id === selectedScope)
        : null;
    const rhSalary = consultant?.base_salary ?? 0;

    if (activePlan) {
      setForm({
        ...activePlan,
        // Sempre sincroniza salário base com RH quando há consultor selecionado
        base_salary_monthly:
          selectedScope !== "team" && rhSalary > 0
            ? rhSalary
            : activePlan.base_salary_monthly,
      });
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
            : `Plano CS — ${consultant?.name?.split(" ")[0] || ""}`,
        description: "",
        is_active: true,
        user_id: selectedScope === "team" ? null : selectedScope,
        base_salary_monthly: rhSalary,
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
      });
      setDraftTiers(defaultTiers());
    }
  }, [activePlan, selectedScope, tiers, consultants]);

  function defaultTiers() {
    return [
      { min: 0, max: "70", multiplier: 0, label: "Abaixo do mínimo" },
      { min: 70, max: "100", multiplier: 0.5, label: "Bronze" },
      { min: 100, max: "120", multiplier: 1, label: "Prata" },
      { min: 120, max: "", multiplier: 1.5, label: "Ouro" },
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
    const newMin = last ? (last.max ? parseFloat(last.max) : last.min + 20) : 0;
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
              {consultants.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-[8px]">{initials(c.name)}</AvatarFallback>
                    </Avatar>
                    {c.name}
                  </div>
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

      {/* Remuneração base */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Remuneração & Meta variável</CardTitle>
          <CardDescription>
            Valores mensais de referência (informativos para apuração de bônus)
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Salário base mensal (R$)</Label>
            <Input
              type="number"
              value={form.base_salary_monthly ?? 0}
              onChange={(e) => setF("base_salary_monthly", Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Meta variável mensal (R$)</Label>
            <Input
              type="number"
              value={form.variable_target_monthly ?? 0}
              onChange={(e) => setF("variable_target_monthly", Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Mínimo para liberar bônus (%)</Label>
            <Input
              type="number"
              value={form.minimum_achievement_percent ?? 0}
              onChange={(e) => setF("minimum_achievement_percent", Number(e.target.value))}
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
              value={form.monthly_bonus_value ?? 0}
              onChange={(e) => setF("monthly_bonus_value", Number(e.target.value))}
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
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Faixas de Atingimento</CardTitle>
            <CardDescription>
              Multiplicador aplicado sobre o bônus mensal conforme % de atingimento.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={addTier} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Adicionar faixa
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>De %</TableHead>
                <TableHead>Até %</TableHead>
                <TableHead>Multiplicador</TableHead>
                <TableHead>Rótulo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draftTiers.map((t, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Input
                      type="number"
                      value={t.min}
                      onChange={(e) => {
                        const v = [...draftTiers];
                        v[i].min = Number(e.target.value);
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
                      placeholder="∞"
                      className="w-20 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.1"
                      value={t.multiplier}
                      onChange={(e) => {
                        const v = [...draftTiers];
                        v[i].multiplier = Number(e.target.value);
                        setDraftTiers(v);
                      }}
                      className="w-24 h-8"
                    />
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
                      placeholder="Bronze, Prata..."
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
              ))}
            </TableBody>
          </Table>
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
                  value={form.churn_penalty_threshold ?? 0}
                  onChange={(e) => setF("churn_penalty_threshold", Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Redução do bônus (%)</Label>
                <Input
                  type="number"
                  value={form.churn_penalty_percent ?? 0}
                  onChange={(e) => setF("churn_penalty_percent", Number(e.target.value))}
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
              <strong>{formatBRL(Number(form.variable_target_monthly || 0))}</strong>
            </span>
            <span>
              Bônus mensal base:{" "}
              <strong className="text-amber-600">
                {formatBRL(Number(form.monthly_bonus_value || 0))}
              </strong>
            </span>
            <span>
              Mínimo: <strong>{form.minimum_achievement_percent}%</strong>
            </span>
          </CardContent>
        </Card>
      ) : null}
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
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        {icon} {label} (peso %)
      </Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function BonusBlock(props: {
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  value: number;
  onValueChange: (v: number) => void;
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
                value={props.value}
                onChange={(e) => props.onValueChange(Number(e.target.value))}
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
