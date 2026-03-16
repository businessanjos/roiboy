import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Percent,
  TrendingUp,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Package,
  Users,
  Shield,
  Award,
  Phone,
} from "lucide-react";
import { CommissionPlan, CommissionTier, CommissionTrigger, CommissionSalesLevel } from "@/hooks/useCommissionPlan";
import { motion, AnimatePresence } from "framer-motion";

// ===== Commission Model Definitions =====
interface CommissionModel {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  examples: string;
}

const COMMISSION_MODELS: CommissionModel[] = [
  {
    key: "percent_tiers",
    label: "Escalonado",
    description: "Percentual varia de acordo com a faixa de atingimento da meta.",
    icon: <TrendingUp className="h-5 w-5 text-emerald-600" />,
    examples: "Ex: até 80% da cota = 0,5% · 81-99% = 0,8% · 100%+ = 2%",
  },
  {
    key: "sdr_activity",
    label: "SDR por Atividade",
    description: "Valor fixo por call comparecida e por venda originada pelo SDR.",
    icon: <Phone className="h-5 w-5 text-violet-600" />,
    examples: "Ex: R$ 20 por call comparecida + R$ 300 por venda originada",
  },
  {
    key: "recurring",
    label: "Recorrente",
    description: "Comissão paga mensalmente enquanto o cliente mantiver contrato.",
    icon: <ArrowRight className="h-5 w-5 text-blue-600" />,
    examples: "Ex: 5% recorrente sobre mensalidade do cliente ativo",
  },
  {
    key: "team",
    label: "Por Equipe",
    description: "Comissão pelo desempenho coletivo do time.",
    icon: <Users className="h-5 w-5 text-teal-600" />,
    examples: "Ex: 1% sobre faturamento total da equipe dividido entre membros",
  },
  {
    key: "ote",
    label: "OTE",
    description: "Salário fixo + variável. Transparência total.",
    icon: <Target className="h-5 w-5 text-amber-600" />,
    examples: "Ex: R$ 5.000 fixo + R$ 5.000 variável ao bater 100% da meta",
  },
  {
    key: "pure_commission",
    label: "Comissão Pura",
    description: "Baixo fixo, alta variável.",
    icon: <Zap className="h-5 w-5 text-red-500" />,
    examples: "Ex: Sem salário fixo, 10% sobre todas as vendas fechadas",
  },
  {
    key: "gross_revenue",
    label: "Por Faturamento Bruto",
    description: "Comissão sobre faturamento bruto total.",
    icon: <BarChart3 className="h-5 w-5 text-blue-500" />,
    examples: "Ex: 2% sobre o faturamento bruto mensal gerado",
  },
  {
    key: "profit_margin",
    label: "Por Margem de Lucro",
    description: "Comissão baseada na margem, não no faturamento.",
    icon: <Shield className="h-5 w-5 text-teal-500" />,
    examples: "Ex: 8% sobre a margem líquida de cada venda",
  },
  {
    key: "bonus_model",
    label: "Modelo de Bônus",
    description: "Remuneração variável por metas específicas.",
    icon: <Award className="h-5 w-5 text-orange-500" />,
    examples: "Ex: R$ 2.000 ao atingir 100% da meta · R$ 5.000 ao atingir 150%",
  },
];

// ===== Interfaces =====
interface CommissionPlanSetupProps {
  plan: CommissionPlan | null;
  onSave: (
    planData: { name: string; period_type: string; tier_mode: string; monthly_quota: number; prospecting_commission_percent: number; commission_model?: string; sdr_value_per_call?: number; sdr_value_per_sale?: number },
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

const DEFAULT_FIXED_TIERS: CommissionTier[] = [
  { tier_name: "Reunião agendada", min_value: 0, max_value: null, commission_percent: 0, is_super_meta: false, bonus_value: 50, display_order: 0 },
  { tier_name: "Lead qualificado", min_value: 0, max_value: null, commission_percent: 0, is_super_meta: false, bonus_value: 100, display_order: 1 },
];

const DEFAULT_VOLUME_TIERS: CommissionTier[] = [
  { tier_name: "1 a 5 vendas", min_value: 1, max_value: 5, commission_percent: 1, is_super_meta: false, bonus_value: 0, display_order: 0 },
  { tier_name: "6 a 10 vendas", min_value: 6, max_value: 10, commission_percent: 1.5, is_super_meta: false, bonus_value: 0, display_order: 1 },
  { tier_name: "11+ vendas", min_value: 11, max_value: null, commission_percent: 2, is_super_meta: true, bonus_value: 0, display_order: 2 },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);

// Detect model from existing plan
function detectModel(plan: CommissionPlan | null): string {
  if (!plan) return "";
  // Use stored model if available
  if ((plan as any).commission_model) return (plan as any).commission_model;
  // Fallback: detect from tier_mode
  if (plan.tier_mode === "percent_of_target") return "percent_tiers";
  return "percent_tiers";
}

export function CommissionPlanSetup({ plan, onSave }: CommissionPlanSetupProps) {
  const [selectedModel, setSelectedModel] = useState<string>(detectModel(plan));
  const [name, setName] = useState(plan?.name || "Plano de Comissão");
  const [tierMode, setTierMode] = useState<string>(plan?.tier_mode || "percent_of_target");
  const [monthlyQuota, setMonthlyQuota] = useState(plan?.monthly_quota || 450000);
  const [prospectingPercent, setProspectingPercent] = useState(plan?.prospecting_commission_percent || 3);
  const [drawAmount, setDrawAmount] = useState(0);
  const [sdrValuePerCall, setSdrValuePerCall] = useState((plan as any)?.sdr_value_per_call || 20);
  const [sdrValuePerSale, setSdrValuePerSale] = useState((plan as any)?.sdr_value_per_sale || 300);

  const [tiers, setTiers] = useState<CommissionTier[]>(
    plan?.tiers?.length ? plan.tiers : DEFAULT_TIERS
  );

  const [triggers, setTriggers] = useState<CommissionTrigger[]>(
    plan?.triggers?.length ? plan.triggers : DEFAULT_TRIGGERS
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plan) {
      setSelectedModel(detectModel(plan));
      setName(plan.name);
      setTierMode(plan.tier_mode || "percent_of_target");
      setMonthlyQuota(plan.monthly_quota || 450000);
      setProspectingPercent(plan.prospecting_commission_percent || 3);
      setSdrValuePerCall((plan as any).sdr_value_per_call || 20);
      setSdrValuePerSale((plan as any).sdr_value_per_sale || 300);
      if (plan.tiers.length) setTiers(plan.tiers);
      if (plan.triggers.length) setTriggers(plan.triggers);
    }
  }, [plan]);

  // When model changes, set appropriate defaults
  const handleModelSelect = (modelKey: string) => {
    setSelectedModel(modelKey);

    switch (modelKey) {
      case "percent_tiers":
        setTierMode("percent_of_target");
        if (!plan?.tiers?.length) setTiers(DEFAULT_TIERS);
        break;
      case "fixed_per_sale":
        setTierMode("absolute");
        if (!plan?.tiers?.length) setTiers(DEFAULT_FIXED_TIERS);
        break;
      case "scaled_volume":
        setTierMode("absolute");
        if (!plan?.tiers?.length) setTiers(DEFAULT_VOLUME_TIERS);
        break;
      case "draw_against":
        setTierMode("percent_of_target");
        if (!plan?.tiers?.length) setTiers(DEFAULT_TIERS);
        break;
      case "sdr_activity":
        setTierMode("absolute");
        setTiers([]);
        break;
    }
  };

  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    setTiers([
      ...tiers,
      {
        tier_name: `Faixa ${tiers.length + 1}`,
        min_value: lastTier?.max_value || 0,
        max_value: null,
        commission_percent: (lastTier?.commission_percent || 0) + 0.5,
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
    if (saving) return;

    setSaving(true);
    try {
      const salesLevels = plan?.sales_levels || [];
      await onSave(
        {
          name,
          period_type: "monthly",
          tier_mode: tierMode,
          monthly_quota: monthlyQuota,
          prospecting_commission_percent: prospectingPercent,
          commission_model: selectedModel,
          sdr_value_per_call: sdrValuePerCall,
          sdr_value_per_sale: sdrValuePerSale,
        },
        tiers,
        triggers,
        salesLevels
      );
    } finally {
      setSaving(false);
    }
  };

  const savedModel = detectModel(plan);
  const isPercent = tierMode === "percent_of_target";
  const currentModelDef = COMMISSION_MODELS.find((m) => m.key === selectedModel);

  // ===== STEP 1: Model selection =====
  if (!selectedModel) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-2">
          <h2 className="text-lg font-bold text-foreground">Escolha o modelo de comissão</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione o modelo que melhor se aplica ao cargo. Cada cargo pode ter um modelo diferente.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {COMMISSION_MODELS.map((model, idx) => (
            <motion.div
              key={model.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
            >
              <button
                onClick={() => handleModelSelect(model.key)}
                className="w-full text-left p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    {model.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {model.label}
                      </h3>
                      {(savedModel || "percent_tiers") === model.key && (
                        <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-500">
                          Modelo atual
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {model.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-2 italic">
                      {model.examples}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                </div>
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // ===== STEP 2: Configuration based on selected model =====
  return (
    <div className="space-y-6">
      {/* Model indicator + change */}
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                {currentModelDef?.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{currentModelDef?.label}</span>
                  <Badge variant="outline" className="text-[9px]">
                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                    Selecionado
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{currentModelDef?.description}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setSelectedModel("")}
            >
              Alterar modelo
            </Button>
          </div>
        </CardContent>
      </Card>

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

            {selectedModel === "percent_tiers" && (
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
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(selectedModel === "percent_tiers" || selectedModel === "draw_against" || selectedModel === "scaled_volume") && (
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
                <p className="text-xs text-muted-foreground">Meta de vendas mensal.</p>
              </div>
            )}

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
              <p className="text-xs text-muted-foreground">Percentual sobre vendas de indicação ou prospecção ativa.</p>
            </div>

            {selectedModel === "draw_against" && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  Draw mensal (R$)
                </Label>
                <Input
                  type="number"
                  value={drawAmount || ""}
                  onChange={(e) => setDrawAmount(e.target.value === "" ? 0 : Number(e.target.value))}
                  placeholder="Ex: 3000"
                />
                <p className="text-xs text-muted-foreground">Adiantamento mensal descontado da comissão real apurada.</p>
              </div>
            )}

            {selectedModel === "sdr_activity" && (
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    Valor por call comparecida (R$)
                  </Label>
                  <Input
                    type="number"
                    value={sdrValuePerCall || ""}
                    onChange={(e) => setSdrValuePerCall(e.target.value === "" ? 0 : Number(e.target.value))}
                    placeholder="Ex: 20"
                  />
                  <p className="text-xs text-muted-foreground">Valor pago por cada call em que o cliente compareceu.</p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    Valor por venda originada (R$)
                  </Label>
                  <Input
                    type="number"
                    value={sdrValuePerSale || ""}
                    onChange={(e) => setSdrValuePerSale(e.target.value === "" ? 0 : Number(e.target.value))}
                    placeholder="Ex: 300"
                  />
                  <p className="text-xs text-muted-foreground">Valor pago por cada venda feita pelo Closer a partir de agendamentos do SDR.</p>
                </div>
              </>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Período de apuração: <strong>Mensal</strong>
            {(selectedModel === "percent_tiers" || selectedModel === "draw_against" || selectedModel === "scaled_volume") && (
              <> · Cota: <strong>{formatCurrency(monthlyQuota)}</strong></>
            )}
            {selectedModel === "draw_against" && drawAmount > 0 && (
              <> · Draw: <strong>{formatCurrency(drawAmount)}</strong>/mês</>
            )}
            {selectedModel === "sdr_activity" && (
              <> · Call: <strong>{formatCurrency(sdrValuePerCall)}</strong> · Venda: <strong>{formatCurrency(sdrValuePerSale)}</strong></>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Tiers — adapt labels per model */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" />
              {selectedModel === "fixed_per_sale" ? "Valores por Atividade" : "Faixas de Comissão"}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addTier}>
              <Plus className="h-4 w-4 mr-1" />
              {selectedModel === "fixed_per_sale" ? "Atividade" : "Faixa"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground mb-2">
            {selectedModel === "percent_tiers" && (isPercent
              ? `Defina as faixas como % da cota atingida (cota: ${formatCurrency(monthlyQuota)}).`
              : "Defina as faixas em valor absoluto (R$).")}
            {selectedModel === "fixed_per_sale" && "Defina o valor fixo pago por cada tipo de atividade/venda realizada."}
            {selectedModel === "scaled_volume" && "Defina as faixas por quantidade de vendas fechadas no período."}
            {selectedModel === "draw_against" && `Faixas de comissão aplicadas sobre o faturamento. Draw de ${formatCurrency(drawAmount)} é descontado do total.`}
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
                    className="w-52 h-8 text-sm font-medium"
                  />
                  {tier.is_super_meta && (
                    <Badge className="bg-amber-500 text-white text-[10px]">⭐ Super Meta</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedModel !== "fixed_per_sale" && (
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">Super Meta</Label>
                      <Switch
                        checked={tier.is_super_meta}
                        onCheckedChange={(v) => updateTier(index, { is_super_meta: v })}
                      />
                    </div>
                  )}
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

              {selectedModel === "fixed_per_sale" ? (
                /* Fixed per sale: just name + fixed value */
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Valor fixo por atividade (R$)</Label>
                    <Input
                      type="number"
                      value={tier.bonus_value || ""}
                      placeholder="Ex: 50"
                      onChange={(e) => updateTier(index, { bonus_value: e.target.value === "" ? 0 : Number(e.target.value) })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Meta mínima (quantidade)</Label>
                    <Input
                      type="number"
                      value={tier.min_value || ""}
                      placeholder="0"
                      onChange={(e) => updateTier(index, { min_value: e.target.value === "" ? 0 : Number(e.target.value) })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              ) : selectedModel === "scaled_volume" ? (
                /* Volume-based: quantity ranges + % */
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">De (vendas)</Label>
                    <Input
                      type="number"
                      value={tier.min_value || ""}
                      placeholder="1"
                      onChange={(e) => updateTier(index, { min_value: e.target.value === "" ? 0 : Number(e.target.value) })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Até (vendas)</Label>
                    <Input
                      type="number"
                      value={tier.max_value ?? ""}
                      placeholder="Sem limite"
                      onChange={(e) => updateTier(index, { max_value: e.target.value ? Number(e.target.value) : null })}
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
              ) : (
                /* Default: percent_tiers and draw_against */
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
                      onChange={(e) => updateTier(index, { max_value: e.target.value ? Number(e.target.value) : null })}
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
              )}

              {/* Summary line */}
              <div className="text-xs text-muted-foreground">
                {selectedModel === "fixed_per_sale" ? (
                  <span>{tier.tier_name}: <strong>{formatCurrency(tier.bonus_value || 0)}</strong> por atividade</span>
                ) : selectedModel === "scaled_volume" ? (
                  <span>
                    {tier.min_value}{tier.max_value ? ` a ${tier.max_value}` : "+"} vendas → <strong>{tier.commission_percent}%</strong>
                    {tier.is_super_meta && tier.bonus_value > 0 && ` + bônus de ${formatCurrency(tier.bonus_value)}`}
                  </span>
                ) : isPercent ? (
                  <span>
                    {tier.min_value}%{tier.max_value ? ` a ${tier.max_value}%` : "+"} da cota → <strong>{tier.commission_percent}%</strong>
                    {tier.is_super_meta && tier.bonus_value > 0 && ` + bônus de ${formatCurrency(tier.bonus_value)}`}
                    <span className="ml-2 text-foreground/60">
                      ({formatCurrency((tier.min_value / 100) * monthlyQuota)}
                      {tier.max_value ? ` a ${formatCurrency((tier.max_value / 100) * monthlyQuota)}` : "+"})
                    </span>
                  </span>
                ) : (
                  <span>
                    {formatCurrency(tier.min_value)}{tier.max_value ? ` até ${formatCurrency(tier.max_value)}` : " em diante"} → {tier.commission_percent}%
                    {tier.is_super_meta && tier.bonus_value > 0 && ` + bônus de ${formatCurrency(tier.bonus_value)}`}
                  </span>
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

          {/* Draw summary */}
          {selectedModel === "draw_against" && drawAmount > 0 && (
            <div className="p-3 border rounded-lg bg-amber-500/5 border-amber-500/20">
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-amber-600" />
                <span className="font-medium">Draw mensal:</span>
                <span className="text-amber-600 font-bold">{formatCurrency(drawAmount)}</span>
                <span className="text-xs text-muted-foreground">descontado da comissão total</span>
              </div>
            </div>
          )}
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
