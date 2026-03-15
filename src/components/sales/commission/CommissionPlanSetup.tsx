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
} from "lucide-react";
import { CommissionPlan, CommissionTier, CommissionTrigger } from "@/hooks/useCommissionPlan";

interface CommissionPlanSetupProps {
  plan: CommissionPlan | null;
  onSave: (
    planData: { name: string; period_type: string },
    tiers: CommissionTier[],
    triggers: CommissionTrigger[]
  ) => Promise<void>;
}

const DEFAULT_TRIGGERS: CommissionTrigger[] = [
  { trigger_type: "min_calls", trigger_value: 50, description: "Mínimo de ligações na semana", is_active: true },
  { trigger_type: "min_conversion_rate", trigger_value: 20, description: "Taxa de conversão mínima (%)", is_active: true },
  { trigger_type: "no_delinquency", trigger_value: null, description: "Sem inadimplência de clientes", is_active: true },
  { trigger_type: "tasks_completed", trigger_value: 100, description: "% de tarefas concluídas", is_active: true },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);

export function CommissionPlanSetup({ plan, onSave }: CommissionPlanSetupProps) {
  const [name, setName] = useState(plan?.name || "Plano de Comissão Semanal");
  const [periodType, setPeriodType] = useState(plan?.period_type || "weekly");
  const [tiers, setTiers] = useState<CommissionTier[]>(
    plan?.tiers?.length
      ? plan.tiers
      : [
          { tier_name: "Faixa 1", min_value: 0, max_value: 30000, commission_percent: 3, is_super_meta: false, bonus_value: 0, display_order: 0 },
          { tier_name: "Faixa 2", min_value: 30000, max_value: 60000, commission_percent: 5, is_super_meta: false, bonus_value: 0, display_order: 1 },
          { tier_name: "Super Meta", min_value: 60000, max_value: null, commission_percent: 7, is_super_meta: true, bonus_value: 1000, display_order: 2 },
        ]
  );
  const [triggers, setTriggers] = useState<CommissionTrigger[]>(
    plan?.triggers?.length ? plan.triggers : DEFAULT_TRIGGERS
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setPeriodType(plan.period_type);
      if (plan.tiers.length) setTiers(plan.tiers);
      if (plan.triggers.length) setTriggers(plan.triggers);
    }
  }, [plan]);

  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    setTiers([
      ...tiers,
      {
        tier_name: `Faixa ${tiers.length + 1}`,
        min_value: lastTier?.max_value || 0,
        max_value: null,
        commission_percent: (lastTier?.commission_percent || 0) + 2,
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
    await onSave({ name, period_type: periodType }, tiers, triggers);
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Plan Settings */}
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
              <Label>Período de Apuração</Label>
              <Select value={periodType} onValueChange={setPeriodType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quinzenal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
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
                    className="w-40 h-8 text-sm font-medium"
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
                  <Label className="text-xs">Valor mínimo (R$)</Label>
                  <Input
                    type="number"
                    value={tier.min_value || ""}
                    placeholder="0"
                    onChange={(e) => updateTier(index, { min_value: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor máximo (R$)</Label>
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
                    step="0.5"
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
                      value={tier.bonus_value}
                      onChange={(e) => updateTier(index, { bonus_value: Number(e.target.value) })}
                      className="h-8 text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                De {formatCurrency(tier.min_value)}
                {tier.max_value ? ` até ${formatCurrency(tier.max_value)}` : " em diante"} → {tier.commission_percent}%
                {tier.is_super_meta && tier.bonus_value > 0 && ` + bônus de ${formatCurrency(tier.bonus_value)}`}
              </div>
            </div>
          ))}
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
                  onChange={(e) => updateTrigger(index, { trigger_value: Number(e.target.value) })}
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
          {saving ? "Salvando..." : "Salvar Plano"}
        </Button>
      </div>
    </div>
  );
}
