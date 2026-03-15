import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Users, Target, Crown, Star, Sparkles, TrendingUp, GitFork } from "lucide-react";
import { CommissionPlan, CommissionSalesLevel } from "@/hooks/useCommissionPlan";
import { motion } from "framer-motion";

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

function getLevelIcon(index: number, total: number, hasBonus: boolean) {
  if (hasBonus && index === total - 1) return <Crown className="h-4 w-4" />;
  if (hasBonus) return <Star className="h-4 w-4" />;
  if (index >= total * 0.6) return <Sparkles className="h-4 w-4" />;
  return <Target className="h-4 w-4" />;
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

  const ySplitIndex = salesLevels.findIndex((l) => l.team_bonus_percent > 0);
  const trunkLevels = ySplitIndex > 0 ? salesLevels.slice(0, ySplitIndex) : salesLevels;
  const branchLevels = ySplitIndex > 0 ? salesLevels.slice(ySplitIndex) : [];

  const maxCompensation = Math.max(...salesLevels.map((l) => l.total_compensation || 0), 1);

  return (
    <div className="space-y-6">
      {/* Career Y-Path Visual */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              Visão Geral — Carreira em Y
            </CardTitle>
            <Badge variant="outline" className="text-[10px] gap-1">
              {salesLevels.length} níveis
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {/* Trunk: linear progression */}
          <div className="relative">
            {trunkLevels.map((level, index) => {
              const compPct = maxCompensation > 0 ? ((level.total_compensation || 0) / maxCompensation) * 100 : 0;
              const commissionValue = Math.max(0, (level.total_compensation || 0) - (level.fixed_salary || 0));

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className="relative flex items-stretch gap-4 group"
                >
                  {/* Timeline */}
                  <div className="flex flex-col items-center w-8 flex-shrink-0">
                    <div className={`w-3 h-3 rounded-full border-2 z-10 transition-all ${
                      index === 0
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30 bg-background group-hover:border-primary group-hover:bg-primary/20"
                    }`} />
                    {(index < trunkLevels.length - 1 || branchLevels.length > 0) && (
                      <div className="w-0.5 flex-1 bg-border" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-5">
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-sm transition-all group-hover:bg-muted/20">
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground flex-shrink-0">
                        {getLevelIcon(index, salesLevels.length, false)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground truncate">{level.level_name}</span>
                          <Badge variant="secondary" className="text-[9px] px-1.5 h-4 font-normal flex-shrink-0">
                            Nível {index + 1}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[11px] text-muted-foreground">
                            Fixo: <span className="font-medium text-foreground">{formatCurrency(level.fixed_salary)}</span>
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Comissão: <span className="font-medium text-foreground">{formatCurrency(commissionValue)}</span>
                          </span>
                        </div>
                      </div>

                      {/* Compensation bar */}
                      <div className="w-32 flex-shrink-0 text-right">
                        <div className="text-sm font-bold text-foreground">{formatCurrency(level.total_compensation)}</div>
                        <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-primary/60"
                            initial={{ width: 0 }}
                            animate={{ width: `${compPct}%` }}
                            transition={{ delay: index * 0.06 + 0.2, duration: 0.5 }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Y-Fork indicator */}
            {branchLevels.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: trunkLevels.length * 0.06 }}
                className="relative flex items-stretch gap-4"
              >
                <div className="flex flex-col items-center w-8 flex-shrink-0">
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center z-10 ring-4 ring-primary/10">
                    <GitFork className="h-3 w-3 text-primary-foreground" />
                  </div>
                  <div className="w-0.5 flex-1 bg-primary/30" />
                </div>
                <div className="flex-1 pb-4">
                  <div className="px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
                    <span className="text-xs font-semibold text-primary">Bifurcação da Carreira em Y</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      O colaborador escolhe entre a trilha de <strong>Gestão</strong> ou <strong>Especialista</strong>. Ambas com bônus sobre o faturamento do time.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Branch levels (leadership/specialist) */}
            {branchLevels.map((level, index) => {
              const realIndex = ySplitIndex + index;
              const compPct = maxCompensation > 0 ? ((level.total_compensation || 0) / maxCompensation) * 100 : 0;
              const commissionValue = Math.max(0, (level.total_compensation || 0) - (level.fixed_salary || 0));
              const isLast = index === branchLevels.length - 1;

              return (
                <motion.div
                  key={realIndex}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (trunkLevels.length + index + 1) * 0.06 }}
                  className="relative flex items-stretch gap-4 group"
                >
                  {/* Timeline */}
                  <div className="flex flex-col items-center w-8 flex-shrink-0">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 z-10 transition-all ${
                      isLast
                        ? "border-primary bg-primary ring-4 ring-primary/10"
                        : "border-primary/50 bg-primary/10 group-hover:border-primary group-hover:bg-primary/30"
                    }`} />
                    {!isLast && (
                      <div className="w-0.5 flex-1 bg-primary/20" />
                    )}
                  </div>

                  {/* Content */}
                  <div className={`flex-1 ${isLast ? "" : "pb-5"}`}>
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/[0.03] hover:border-primary/40 hover:shadow-sm transition-all group-hover:bg-primary/[0.06]">
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                        {getLevelIcon(realIndex, salesLevels.length, true)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground truncate">{level.level_name}</span>
                          <Badge className="text-[9px] px-1.5 h-4 font-normal bg-primary/10 text-primary border-primary/20 flex-shrink-0">
                            +{level.team_bonus_percent}% time
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[11px] text-muted-foreground">
                            Fixo: <span className="font-medium text-foreground">{formatCurrency(level.fixed_salary)}</span>
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Comissão: <span className="font-medium text-foreground">{formatCurrency(commissionValue)}</span>
                          </span>
                        </div>
                      </div>

                      {/* Compensation bar */}
                      <div className="w-32 flex-shrink-0 text-right">
                        <div className="text-sm font-bold text-primary">{formatCurrency(level.total_compensation)}</div>
                        <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${compPct}%` }}
                            transition={{ delay: (trunkLevels.length + index + 1) * 0.06 + 0.2, duration: 0.5 }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-border/60">
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Salário Inicial</div>
              <div className="text-base font-bold text-foreground mt-0.5">{formatCurrency(salesLevels[0]?.fixed_salary || 0)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Teto Salarial</div>
              <div className="text-base font-bold text-foreground mt-0.5">{formatCurrency(salesLevels[salesLevels.length - 1]?.fixed_salary || 0)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Max. Remuneração</div>
              <div className="text-base font-bold text-primary mt-0.5">{formatCurrency(maxCompensation)}</div>
            </div>
          </div>
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
