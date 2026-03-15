import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Users, Target, ArrowRight } from "lucide-react";
import { CommissionPlan, CommissionSalesLevel } from "@/hooks/useCommissionPlan";

const DEFAULT_LEVELS: CommissionSalesLevel[] = [
  { level_name: "Anjo Vendedor", monthly_target: 450000, fixed_salary: 4000, team_bonus_percent: 0, total_compensation: 13000, display_order: 0 },
  { level_name: "Anjo Executivo", monthly_target: 450000, fixed_salary: 4300, team_bonus_percent: 0, total_compensation: 13300, display_order: 1 },
  { level_name: "Anjo Pro", monthly_target: 450000, fixed_salary: 4600, team_bonus_percent: 0, total_compensation: 13900, display_order: 2 },
  { level_name: "Anjo Elite", monthly_target: 450000, fixed_salary: 5000, team_bonus_percent: 0, total_compensation: 14500, display_order: 3 },
  { level_name: "Anjo Star", monthly_target: 450000, fixed_salary: 5500, team_bonus_percent: 0, total_compensation: 15000, display_order: 4 },
  { level_name: "Anjo Mestre", monthly_target: 450000, fixed_salary: 6000, team_bonus_percent: 0, total_compensation: 15500, display_order: 5 },
  { level_name: "Anjo Líder / Especialista", monthly_target: 450000, fixed_salary: 6500, team_bonus_percent: 0.25, total_compensation: 16600, display_order: 6 },
  { level_name: "Anjo Estrategista / Esp. Pro", monthly_target: 450000, fixed_salary: 7200, team_bonus_percent: 0.5, total_compensation: 18500, display_order: 7 },
  { level_name: "Anjo Visionário / Esp. Elite", monthly_target: 450000, fixed_salary: 8000, team_bonus_percent: 0.75, total_compensation: 20500, display_order: 8 },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);

interface CareerPlanTabProps {
  plan: CommissionPlan | null;
  onSaveLevels: (levels: CommissionSalesLevel[]) => Promise<void>;
}

export function CareerPlanTab({ plan, onSaveLevels }: CareerPlanTabProps) {
  const [salesLevels, setSalesLevels] = useState<CommissionSalesLevel[]>(
    plan?.sales_levels?.length ? plan.sales_levels : DEFAULT_LEVELS
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plan?.sales_levels?.length) {
      setSalesLevels(plan.sales_levels);
    }
  }, [plan]);

  const addLevel = () => {
    setSalesLevels([
      ...salesLevels,
      { level_name: `Nível ${salesLevels.length + 1}`, monthly_target: 450000, fixed_salary: 0, team_bonus_percent: 0, total_compensation: 0, display_order: salesLevels.length },
    ]);
  };

  const updateLevel = (index: number, updates: Partial<CommissionSalesLevel>) => {
    setSalesLevels(salesLevels.map((l, i) => (i === index ? { ...l, ...updates } : l)));
  };

  const removeLevel = (index: number) => {
    if (salesLevels.length <= 1) return;
    setSalesLevels(salesLevels.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSaveLevels(salesLevels);
    setSaving(false);
  };

  // Find the Y-split point (first level with team_bonus_percent > 0)
  const ySplitIndex = salesLevels.findIndex((l) => l.team_bonus_percent > 0);

  return (
    <div className="space-y-6">
      {/* Career visual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Visão Geral — Carreira em Y
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 items-center">
            {salesLevels.map((level, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <div className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
                  level.team_bonus_percent > 0 
                    ? "border-primary/40 bg-primary/10 text-primary" 
                    : "border-border bg-muted/50"
                }`}>
                  <div>{level.level_name}</div>
                  <div className="text-[10px] text-muted-foreground font-normal">{formatCurrency(level.fixed_salary)}</div>
                </div>
                {index < salesLevels.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
          {ySplitIndex > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              A partir de <strong>{salesLevels[ySplitIndex]?.level_name}</strong>, o colaborador escolhe entre a trilha de Gestão ou Especialista e passa a receber bônus sobre o time.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Editable levels */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Níveis e Remuneração
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addLevel}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Nível
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {salesLevels.map((level, index) => (
            <div key={index} className={`border rounded-lg p-4 space-y-3 ${level.team_bonus_percent > 0 ? "border-primary/30 bg-primary/5" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Input
                    value={level.level_name}
                    onChange={(e) => updateLevel(index, { level_name: e.target.value })}
                    className="w-56 h-8 text-sm font-medium"
                    placeholder="Nome do nível"
                  />
                  {level.team_bonus_percent > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      +{level.team_bonus_percent}% time
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => removeLevel(index)}
                  disabled={salesLevels.length <= 1}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Salário fixo (R$)</Label>
                  <Input
                    type="number"
                    value={level.fixed_salary || ""}
                    onChange={(e) => updateLevel(index, { fixed_salary: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="h-8 text-sm"
                    placeholder="Ex: 4000"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Remuneração total (R$)</Label>
                  <Input
                    type="number"
                    value={level.total_compensation || ""}
                    onChange={(e) => updateLevel(index, { total_compensation: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="h-8 text-sm"
                    placeholder="Ex: 13000"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">% sobre o time</Label>
                  <Input
                    type="number"
                    step="0.25"
                    value={level.team_bonus_percent || ""}
                    onChange={(e) => updateLevel(index, { team_bonus_percent: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="h-8 text-sm"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Comissão esperada</Label>
                  <div className="h-8 flex items-center text-sm font-medium text-muted-foreground">
                    {formatCurrency(Math.max(0, (level.total_compensation || 0) - (level.fixed_salary || 0)))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Plano de Carreira"}
        </Button>
      </div>
    </div>
  );
}
