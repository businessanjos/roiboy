import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Save,
  Settings2,
  Layers,
  Zap,
  Target,
  DollarSign,
} from "lucide-react";
import { CommissionPlan, CommissionTier, CommissionTrigger, CommissionSalesLevel } from "@/hooks/useCommissionPlan";

interface CommissionPlanSetupProps {
  plan: CommissionPlan | null;
  onSave: (
    planData: { name: string; period_type: string; tier_mode: string; monthly_quota: number; prospecting_commission_percent: number },
    tiers: CommissionTier[],
    triggers: CommissionTrigger[],
    salesLevels: CommissionSalesLevel[]
  ) => Promise<void>;
}

const DEFAULT_TRIGGERS: CommissionTrigger[] = [
  { trigger_type: "min_calls", trigger_value: 50, description: "Mínimo de ligações no mês", is_active: true },
  { trigger_type: "min_conversion_rate", trigger_value: 20, description: "Taxa de conversão mínima (%)", is_active: true },
  { trigger_type: "no_delinquency", trigger_value: null, description: "Sem inadimplência de clientes", is_active: true },
  { trigger_type: "tasks_completed", trigger_value: 100, description: "% de tarefas concluídas", is_active: true },
];

const DEFAULT_TIERS: CommissionTier[] = [
  { tier_name: "Até 80% da cota", min_value: 0, max_value: 80, commission_percent: 0.5, is_super_meta: false, bonus_value: 0, display_order: 0 },
  { tier_name: "81% a 99%", min_value: 81, max_value: 99, commission_percent: 0.8, is_super_meta: false, bonus_value: 0, display_order: 1 },
  { tier_name: "Acima de 100%", min_value: 100, max_value: null, commission_percent: 2, is_super_meta: true, bonus_value: 0, display_order: 2 },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);

export function CommissionPlanSetup({ plan, onSave }: CommissionPlanSetupProps) {
  const [name, setName] = useState(plan?.name || "Plano de Comissão - Eternum");
  const [tierMode, setTierMode] = useState<string>(plan?.tier_mode || "percent_of_target");
  const [monthlyQuota, setMonthlyQuota] = useState(plan?.monthly_quota || 450000);
  const [prospectingPercent, setProspectingPercent] = useState(plan?.prospecting_commission_percent || 3);

  const [tiers, setTiers] = useState<CommissionTier[]>(
    plan?.tiers?.length ? plan.tiers : DEFAULT_TIERS
  );

  const [triggers, setTriggers] = useState<CommissionTrigger[]>(
    plan?.triggers?.length ? plan.triggers : DEFAULT_TRIGGERS
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setTierMode(plan.tier_mode || "percent_of_target");
      setMonthlyQuota(plan.monthly_quota || 450000);
      setProspectingPercent(plan.prospecting_commission_percent || 3);
      if (plan.tiers.length) setTiers(plan.tiers);
      if (plan.triggers.length) setTriggers(plan.triggers);
    }
  }, [plan]);

  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    const isPercent = tierMode === "percent_of_target";
    setTiers([
      ...tiers,
      {
        tier_name: isPercent ? `${(lastTier?.max_value || 0)}%+` : `Faixa ${tiers.length + 1}`,
        min_value: lastTier?.max_value || 0,
        max_value: null,
        commission_percent: (lastTier?.commission_percent || 0) + 1,
        is_super_meta: false,
        bonus_value: 0,
        display_order: tiers.length,
      },
    ]);
  };

  const updateTier = (index: number, updates: Partial<CommissionTier>) => {
    setTiers(tiers.map((t, i) => (i === index ? { ...t, ...updates } : t)));
  };

  const removeTier = (index: number) => {
    if (tiers.length <= 1) return;
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTrigger = (index: number, updates: Partial<CommissionTrigger>) => {
    setTriggers(triggers.map((t, i) => (i === index ? { ...t, ...updates } : t)));
  };

  const handleSave = async () => {
    setSaving(true);
    // Pass existing sales levels from plan (managed in Career tab)
    const salesLevels = plan?.sales_levels || [];
    await onSave(
      { name, period_type: "monthly", tier_mode: tierMode, monthly_quota: monthlyQuota, prospecting_commission_percent: prospectingPercent },
      tiers,
      triggers,
      salesLevels
    );
    setSaving(false);
  };

  const isPercent = tierMode === "percent_of_target";

  return (
    <div className="space-y-6">
      {/* Plan Settings + Quota */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Configuração Geral
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Plano</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Modo das Faixas</Label>
              <Select value={tierMode} onValueChange={setTierMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent_of_target">% da cota atingida</SelectItem>
                  <SelectItem value="absolute">Valor absoluto (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" />
                Cota Mensal (R$)
              </Label>
              <Input
                type="number"
                value={monthlyQuota || ""}
                onChange={(e) => setMonthlyQuota(e.target.value === "" ? 0 : Number(e.target.value))}
                placeholder="Ex: 450000"
              />
              <p className="text-xs text-muted-foreground">Meta de vendas mensal aplicada a todos os vendedores.</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                Comissão Indicação/Prospecção (%)
              </Label>
              <Input
                type="number"
                step="0.5"
                value={prospectingPercent || ""}
                onChange={(e) => setProspectingPercent(e.target.value === "" ? 0 : Number(e.target.value))}
                placeholder="Ex: 3"
              />
              <p className="text-xs text-muted-foreground">Percentual sobre vendas originadas de indicação ou prospecção ativa.</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Período de apuração: <strong>Mensal</strong> · Cota: <strong>{formatCurrency(monthlyQuota)}</strong>
          </p>
        </CardContent>
      </Card>

      {/* Tiers */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Faixas de Comissão
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addTier}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Faixa
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground mb-2">
            {isPercent
              ? `Defina as faixas como % da cota atingida (cota: ${formatCurrency(monthlyQuota)}).`
              : "Defina as faixas em valor absoluto (R$)."}
          </p>
          {tiers.map((tier, index) => (
            <div
              key={index}
              className={`border rounded-lg p-4 space-y-3 ${
                tier.is_super_meta ? "border-amber-500/50 bg-amber-500/5" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Input
                    value={tier.tier_name}
                    onChange={(e) => updateTier(index, { tier_name: e.target.value })}
                    className="w-44 h-8 text-sm font-medium"
                  />
                  {tier.is_super_meta && (
                    <Badge className="bg-amber-500 text-white text-[10px]">⭐ Super Meta</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs text-muted-foreground">Super Meta</Label>
                    <Switch
                      checked={tier.is_super_meta}
                      onCheckedChange={(v) => updateTier(index, { is_super_meta: v })}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeTier(index)}
                    disabled={tiers.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{isPercent ? "De (%)" : "Valor mínimo (R$)"}</Label>
                  <Input
                    type="number"
                    value={tier.min_value || ""}
                    placeholder="0"
                    onChange={(e) => updateTier(index, { min_value: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{isPercent ? "Até (%)" : "Valor máximo (R$)"}</Label>
                  <Input
                    type="number"
                    value={tier.max_value ?? ""}
                    placeholder="Sem limite"
                    onChange={(e) =>
                      updateTier(index, {
                        max_value: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Comissão (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={tier.commission_percent || ""}
                    placeholder="0"
                    onChange={(e) => updateTier(index, { commission_percent: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="h-8 text-sm"
                  />
                </div>
                {tier.is_super_meta && (
                  <div className="space-y-1">
                    <Label className="text-xs">Bônus fixo (R$)</Label>
                    <Input
                      type="number"
                      value={tier.bonus_value || ""}
                      placeholder="0"
                      onChange={(e) => updateTier(index, { bonus_value: e.target.value === "" ? 0 : Number(e.target.value) })}
                      className="h-8 text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                {isPercent ? (
                  <div>
                    {tier.min_value}%{tier.max_value ? ` a ${tier.max_value}%` : "+"} da cota →{" "}
                    <strong>{tier.commission_percent}%</strong>
                    {tier.is_super_meta && tier.bonus_value > 0 && ` + bônus de ${formatCurrency(tier.bonus_value)}`}
                    <span className="ml-2 text-foreground/60">
                      ({formatCurrency((tier.min_value / 100) * monthlyQuota)}
                      {tier.max_value ? ` a ${formatCurrency((tier.max_value / 100) * monthlyQuota)}` : "+"})
                    </span>
                  </div>
                ) : (
                  <div>
                    {formatCurrency(tier.min_value)}
                    {tier.max_value ? ` até ${formatCurrency(tier.max_value)}` : " em diante"} → {tier.commission_percent}%
                    {tier.is_super_meta && tier.bonus_value > 0 && ` + bônus de ${formatCurrency(tier.bonus_value)}`}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Prospecting reminder */}
          <div className="p-3 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="font-medium">Indicação / Prospecção:</span>
              <span className="text-primary font-bold">{prospectingPercent}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Triggers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Gatilhos Obrigatórios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground mb-2">
            O vendedor precisa cumprir todos os gatilhos ativos para ter direito à comissão.
          </p>
          {triggers.map((trigger, index) => (
            <div
              key={trigger.trigger_type}
              className={`flex items-center gap-4 p-3 border rounded-lg ${
                !trigger.is_active ? "opacity-50" : ""
              }`}
            >
              <Switch
                checked={trigger.is_active}
                onCheckedChange={(v) => updateTrigger(index, { is_active: v })}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{trigger.description}</p>
                <p className="text-xs text-muted-foreground">
                  {trigger.trigger_type === "min_calls" && "Quantidade mínima de ligações no período"}
                  {trigger.trigger_type === "min_conversion_rate" && "Percentual mínimo de conversão de negócios"}
                  {trigger.trigger_type === "no_delinquency" && "Nenhum cliente com inadimplência"}
                  {trigger.trigger_type === "tasks_completed" && "Percentual de tarefas concluídas"}
                </p>
              </div>
              {trigger.trigger_type !== "no_delinquency" && (
                <Input
                  type="number"
                  value={trigger.trigger_value ?? ""}
                  onChange={(e) => updateTrigger(index, { trigger_value: e.target.value === "" ? null : Number(e.target.value) })}
                  className="w-24 h-8 text-sm"
                  disabled={!trigger.is_active}
                  placeholder={trigger.trigger_type === "min_calls" ? "Ex: 50" : "Ex: 20"}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Comissionamento"}
        </Button>
      </div>
    </div>
  );
}
