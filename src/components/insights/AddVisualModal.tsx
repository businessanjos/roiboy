import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BarChart3, LineChart, PieChart, Hash, Check, ChevronLeft, ChevronRight, Trophy, Phone, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInsightsDashboards } from "@/hooks/useInsightsDashboards";
import { VisualConfig, DEFAULT_APPEARANCE } from "./visual-builder/types";

interface AddVisualModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ChartType = "bar" | "bar_horizontal" | "line" | "pie" | "scorecard" | "ranking" | "call_commercial" | "gauge";
type Metric = "revenue" | "deals_count" | "avg_ticket" | "conversion" | "lost_reasons" | "leads_count" | "sales_cycle" | "meta";
type GroupBy = "month" | "user" | "stage" | "product" | "mql" | "faturamento_atual";

const CHART_TYPES = [
  { value: "bar" as const, label: "Gráfico de Barras", description: "Comparar valores entre categorias", icon: BarChart3 },
  { value: "bar_horizontal" as const, label: "Barras Horizontal", description: "Barras na horizontal para categorias", icon: BarChart3 },
  { value: "line" as const, label: "Gráfico de Linhas", description: "Visualizar tendências ao longo do tempo", icon: LineChart },
  { value: "pie" as const, label: "Gráfico de Pizza", description: "Mostrar proporções de um todo", icon: PieChart },
  { value: "scorecard" as const, label: "Scorecard", description: "Exibir um número ou KPI destacado", icon: Hash },
  { value: "ranking" as const, label: "Ranking", description: "Tabela ordenada com medalhas e barras de progresso", icon: Trophy },
  { value: "call_commercial" as const, label: "Calls Comerciais", description: "Agendadas vs Concluídas por vendedor", icon: Phone },
  { value: "gauge" as const, label: "Conta-Giro", description: "Velocímetro de progresso mensal", icon: Gauge },
];

const METRICS = [
  { value: "revenue" as const, label: "Valor Total (R$)", description: "Soma dos valores de negócios" },
  { value: "deals_count" as const, label: "Quantidade de Negócios", description: "Contagem de deals" },
  { value: "avg_ticket" as const, label: "Ticket Médio", description: "Valor médio por negócio" },
  { value: "conversion" as const, label: "Taxa de Conversão", description: "Porcentagem de ganhos" },
  { value: "lost_reasons" as const, label: "Motivos de Perda", description: "Análise de deals perdidos" },
  { value: "leads_count" as const, label: "Total de Leads", description: "Contagem de todos os leads cadastrados" },
  { value: "sales_cycle" as const, label: "Ciclo de Vendas", description: "Média de dias entre primeiro contato e fechamento" },
  { value: "meta" as const, label: "Meta", description: "Meta de faturamento configurada manualmente" },
];

const GROUP_BY_OPTIONS = [
  { value: "month" as const, label: "Por Mês", description: "Evolução temporal" },
  { value: "user" as const, label: "Por Vendedor", description: "Comparativo entre usuários" },
  { value: "stage" as const, label: "Por Etapa do Funil", description: "Distribuição por stage" },
  { value: "product" as const, label: "Por Produto", description: "Ranking de produtos" },
  { value: "mql" as const, label: "Por MQL", description: "Classificação MQL do negócio" },
  { value: "faturamento_atual" as const, label: "Por Faturamento Atual", description: "Faixa de faturamento do lead" },
];

// Mapping from simplified selections to full VisualConfig
const METRIC_TO_CONFIG: Record<Metric, { 
  dataSource: 'deals' | 'leads'; 
  measureField: string | null; 
  aggregation: 'sum' | 'count' | 'avg' | 'conversion_rate' | 'sales_cycle'; 
  formatType: 'currency' | 'decimal' | 'percentage';
  statusFilter?: 'won' | 'lost';
}> = {
  revenue: { dataSource: 'deals', measureField: 'value', aggregation: 'sum', formatType: 'currency', statusFilter: 'won' },
  deals_count: { dataSource: 'deals', measureField: null, aggregation: 'count', formatType: 'decimal' },
  avg_ticket: { dataSource: 'deals', measureField: 'value', aggregation: 'avg', formatType: 'currency', statusFilter: 'won' },
  conversion: { dataSource: 'deals', measureField: null, aggregation: 'conversion_rate', formatType: 'percentage' },
  lost_reasons: { dataSource: 'deals', measureField: null, aggregation: 'count', formatType: 'decimal', statusFilter: 'lost' },
  leads_count: { dataSource: 'leads', measureField: null, aggregation: 'count', formatType: 'decimal' },
  sales_cycle: { dataSource: 'deals', measureField: null, aggregation: 'sales_cycle', formatType: 'decimal', statusFilter: 'won' },
  meta: { dataSource: 'deals', measureField: 'meta', aggregation: 'sum', formatType: 'currency' },
};

const GROUP_BY_TO_DIMENSION: Record<GroupBy, { field: string; type: 'date' | 'text'; dateGrouping?: 'day' | 'week' | 'month' | 'year' }> = {
  month: { field: 'created_at', type: 'date', dateGrouping: 'month' }, // Default, overridden by getDateFieldForMetric
  user: { field: 'responsible_name', type: 'text' },
  stage: { field: 'stage_name', type: 'text' },
  product: { field: 'product_name', type: 'text' },
  mql: { field: 'mql', type: 'text' },
  faturamento_atual: { field: 'faturamento_atual', type: 'text' },
};

// Determines the correct date field based on the metric being measured
const getDateFieldForMetric = (metric: Metric): string => {
  switch (metric) {
    case 'revenue':      // Revenue = WON deals
    case 'avg_ticket':   // Avg ticket also based on won deals
    case 'sales_cycle':  // Sales cycle also based on won deals
      return 'won_at';
    case 'lost_reasons': // Losses = LOST deals
      return 'lost_at';
    default:
      return 'created_at';
  }
};

const METRIC_LABELS: Record<Metric, string> = {
  revenue: "Faturamento",
  deals_count: "Negócios",
  avg_ticket: "Ticket Médio",
  conversion: "Conversão",
  lost_reasons: "Perdas",
  leads_count: "Leads",
  sales_cycle: "Ciclo de Vendas",
  meta: "Meta",
};

const GROUP_LABELS: Record<GroupBy, string> = {
  month: "por Mês",
  user: "por Vendedor",
  stage: "por Etapa",
  product: "por Produto",
  mql: "por MQL",
  faturamento_atual: "por Faturamento Atual",
};

export function AddVisualModal({ open, onOpenChange }: AddVisualModalProps) {
  const { activeDashboardId, addVisual } = useInsightsDashboards();
  
  const [step, setStep] = useState(1);
  const [chartType, setChartType] = useState<ChartType | null>(null);
  const [metric, setMetric] = useState<Metric | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy | null>(null);
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [gaugeSubType, setGaugeSubType] = useState<'days_elapsed' | 'revenue_vs_goal'>('days_elapsed');
  const [gaugeGoal, setGaugeGoal] = useState("");
  const [monthlyGoals, setMonthlyGoals] = useState<Record<string, string>>({});

  // Scorecards, rankings, call_commercial and gauge have only 2 steps
  const totalSteps = (chartType === 'scorecard' || chartType === 'ranking' || chartType === 'call_commercial' || chartType === 'gauge') ? 2 : 3;

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setChartType(null);
      setMetric(null);
      setGroupBy(null);
      setTitle("");
      setGaugeSubType('days_elapsed');
      setGaugeGoal("");
      setMonthlyGoals({});
    }
  }, [open]);

  // Auto-generate title when selections change
  useEffect(() => {
    if (chartType === 'ranking') {
      setTitle("Ranking de Vendedores");
    } else if (chartType === 'call_commercial') {
      setTitle("Calls Comerciais");
    } else if (chartType === 'gauge') {
      setTitle(gaugeSubType === 'days_elapsed' ? 'Dias Corridos do Mês' : 'Faturamento x Meta');
    } else if (chartType === 'scorecard' && metric) {
      setTitle(metric === 'meta' ? 'Meta' : METRIC_LABELS[metric]);
    } else if (metric && groupBy) {
      const generatedTitle = `${METRIC_LABELS[metric]} ${GROUP_LABELS[groupBy]}`;
      setTitle(generatedTitle);
    }
  }, [chartType, metric, groupBy, gaugeSubType]);

  const canProceedStep1 = chartType !== null;
  const canProceedStep2 = metric !== null;
  
  // Validation for creating the visual
  const canCreate = chartType === 'scorecard'
    ? metric !== null && title.trim() !== "" && activeDashboardId !== null
    : (chartType === 'ranking' || chartType === 'call_commercial' || chartType === 'gauge')
    ? title.trim() !== "" && activeDashboardId !== null
    : groupBy !== null && title.trim() !== "" && activeDashboardId !== null;

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleCreate = async () => {
    if (!chartType || !activeDashboardId) return;
    
    // For ranking and call_commercial, metric and groupBy are fixed
    if (chartType === 'ranking') {
      if (!canCreate) return;
      setIsCreating(true);
      try {
        const config: VisualConfig = {
          dataSource: 'deals',
          measure: { field: 'value', aggregation: 'sum' },
          dimension: { field: 'responsible_name', type: 'text' },
          formatting: { type: 'currency', decimals: 2 },
          appearance: DEFAULT_APPEARANCE,
          statusFilter: 'won',
        };
        await addVisual({
          dashboard_id: activeDashboardId,
          title: title.trim(),
          chart_type: chartType,
          config,
          layout: { x: 0, y: 0, w: 6, h: 5 },
        });
        onOpenChange(false);
      } catch (error) {
        console.error("Error creating visual:", error);
      } finally {
        setIsCreating(false);
      }
      return;
    }

    if (chartType === 'call_commercial') {
      if (!canCreate) return;
      setIsCreating(true);
      try {
        const config: VisualConfig = {
          dataSource: 'tasks',
          measure: { field: '', aggregation: 'count' },
          dimension: { field: 'assigned_to', type: 'text' },
          formatting: { type: 'decimal', decimals: 0 },
          appearance: DEFAULT_APPEARANCE,
        };
        await addVisual({
          dashboard_id: activeDashboardId,
          title: title.trim(),
          chart_type: 'call_commercial',
          config,
          layout: { x: 0, y: 0, w: 6, h: 4 },
        });
        onOpenChange(false);
      } catch (error) {
        console.error("Error creating visual:", error);
      } finally {
        setIsCreating(false);
      }
      return;
    }

    if (chartType === 'gauge') {
      if (!canCreate) return;
      setIsCreating(true);
      try {
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const isRevenue = gaugeSubType === 'revenue_vs_goal';
        const config: VisualConfig = {
          dataSource: 'deals',
          measure: { field: isRevenue ? 'value' : '', aggregation: isRevenue ? 'sum' : 'count' },
          dimension: { field: 'created_at', type: 'date', dateGrouping: 'month' },
          formatting: { type: isRevenue ? 'currency' : 'decimal', decimals: 2 },
          appearance: DEFAULT_APPEARANCE,
          ...(isRevenue && { statusFilter: 'won' as const }),
          gaugeConfig: {
            subType: gaugeSubType,
            ...(isRevenue && gaugeGoal ? { monthlyGoals: { [monthKey]: Number(gaugeGoal) } } : {}),
          },
        };
        await addVisual({
          dashboard_id: activeDashboardId,
          title: title.trim(),
          chart_type: 'gauge',
          config,
          layout: { x: 0, y: 0, w: 6, h: 4 },
        });
        onOpenChange(false);
      } catch (error) {
        console.error("Error creating visual:", error);
      } finally {
        setIsCreating(false);
      }
      return;
    }

    if (!metric) return;
    // For non-scorecards, groupBy is required
    if (chartType !== 'scorecard' && !groupBy) return;
    if (!canCreate) return;

    setIsCreating(true);
    try {
      const metricConfig = METRIC_TO_CONFIG[metric];
      
      let config: VisualConfig;
      
      if (chartType === 'scorecard') {
        const isMeta = metric === 'meta';
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        config = {
          dataSource: metricConfig.dataSource,
          measure: {
            field: metricConfig.measureField || '',
            aggregation: metricConfig.aggregation,
          },
          dimension: {
            field: '_total',
            type: 'text',
          },
          formatting: {
            type: metricConfig.formatType,
            decimals: metricConfig.formatType === 'currency' ? 1 : (metricConfig.formatType === 'percentage' ? 1 : 0),
            displayScale: 'auto',
          },
          appearance: DEFAULT_APPEARANCE,
          statusFilter: metricConfig.statusFilter,
          ...(isMeta ? (() => {
            const parsedGoals: Record<string, number> = {};
            Object.entries(monthlyGoals).forEach(([k, v]) => {
              const num = Number(v);
              if (num > 0) parsedGoals[k] = num;
            });
            return Object.keys(parsedGoals).length > 0 ? {
              gaugeConfig: {
                subType: 'revenue_vs_goal' as const,
                monthlyGoals: parsedGoals,
              },
            } : {};
          })() : {}),
        };
      } else {
        const baseDimensionConfig = GROUP_BY_TO_DIMENSION[groupBy!];
        const dimensionField = baseDimensionConfig.type === 'date' 
          ? getDateFieldForMetric(metric) 
          : baseDimensionConfig.field;
        const isTemporalGrouping = baseDimensionConfig.type === 'date';

        config = {
          dataSource: metricConfig.dataSource,
          measure: {
            field: metricConfig.measureField || '',
            aggregation: metricConfig.aggregation,
          },
          dimension: {
            field: dimensionField,
            type: baseDimensionConfig.type,
            ...(baseDimensionConfig.dateGrouping && { dateGrouping: baseDimensionConfig.dateGrouping }),
          },
          formatting: {
            type: metricConfig.formatType,
            decimals: metricConfig.formatType === 'currency' ? 2 : (metricConfig.formatType === 'percentage' ? 1 : 0),
          },
          appearance: {
            ...DEFAULT_APPEARANCE,
            fillEmptyDates: isTemporalGrouping,
            showDataLabels: isTemporalGrouping,
          },
          statusFilter: metricConfig.statusFilter,
        };
      }

      await addVisual({
        dashboard_id: activeDashboardId,
        title: title.trim(),
        chart_type: chartType,
        config,
        layout: { x: 0, y: 0, w: chartType === 'scorecard' ? 3 : 6, h: chartType === 'scorecard' ? 2 : 4 },
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error creating visual:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Adicionar Visual
            <span className="text-sm font-normal text-muted-foreground">
              — Passo {step} de {totalSteps}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Step 1: Choose Format */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Escolha o formato do visual</p>
              <div className="grid grid-cols-2 gap-3">
                {CHART_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = chartType === type.value;
                  return (
                    <button
                      key={type.value}
                      onClick={() => setChartType(type.value)}
                      className={cn(
                        "relative flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all text-left",
                        isSelected 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      {isSelected && (
                        <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
                      )}
                      <Icon className={cn(
                        "h-8 w-8",
                        type.value === 'bar_horizontal' && "rotate-90",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )} />
                      <span className="font-medium text-sm">{type.label}</span>
                      <span className="text-xs text-muted-foreground text-center leading-tight">
                        {type.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Title for Rankings/Call Commercial */}
          {step === 2 && (chartType === 'ranking' || chartType === 'call_commercial') && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {chartType === 'ranking'
                  ? 'O ranking exibirá os vendedores ordenados pelo faturamento total (negócios ganhos).'
                  : 'Exibirá para cada vendedor a contagem de Calls Comerciais Agendadas (em aberto) e Concluídas.'}
              </p>
              <div className="space-y-2">
                <Label htmlFor="visual-title-simple">Título</Label>
                <Input
                  id="visual-title-simple"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={chartType === 'ranking' ? 'Ex: Ranking de Vendedores' : 'Ex: Calls Comerciais'}
                />
              </div>
            </div>
          )}

          {/* Step 2: Gauge configuration */}
          {step === 2 && chartType === 'gauge' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Escolha o tipo de conta-giro</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'days_elapsed' as const, label: 'Dias Corridos', description: 'Dias passados vs total do mês' },
                  { value: 'revenue_vs_goal' as const, label: 'Faturamento x Meta', description: 'Receita atual vs meta mensal' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setGaugeSubType(opt.value)}
                    className={cn(
                      "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      gaugeSubType === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    {gaugeSubType === opt.value && (
                      <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
                    )}
                    <Gauge className={cn("h-7 w-7", gaugeSubType === opt.value ? "text-primary" : "text-muted-foreground")} />
                    <span className="font-medium text-sm">{opt.label}</span>
                    <span className="text-xs text-muted-foreground text-center leading-tight">{opt.description}</span>
                  </button>
                ))}
              </div>

              {gaugeSubType === 'revenue_vs_goal' && (
                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="gauge-goal">Meta do Mês Atual (R$)</Label>
                  <Input
                    id="gauge-goal"
                    type="number"
                    value={gaugeGoal}
                    onChange={(e) => setGaugeGoal(e.target.value)}
                    placeholder="Ex: 100000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Você pode editar metas de outros meses nos ajustes do visual após criá-lo.
                  </p>
                </div>
              )}

              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="visual-title-gauge">Título</Label>
                <Input
                  id="visual-title-gauge"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Dias Corridos do Mês"
                />
              </div>
            </div>
          )}

          {step === 2 && chartType !== 'ranking' && chartType !== 'call_commercial' && chartType !== 'gauge' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">O que você quer medir?</p>
              <RadioGroup
                value={metric || ""}
                onValueChange={(value) => setMetric(value as Metric)}
                className="space-y-2"
              >
                {METRICS.map((m) => (
                  <div
                    key={m.value}
                    className={cn(
                      "flex items-center space-x-3 rounded-lg border p-4 cursor-pointer transition-colors",
                      metric === m.value 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:bg-muted/50"
                    )}
                    onClick={() => setMetric(m.value)}
                  >
                    <RadioGroupItem value={m.value} id={m.value} />
                    <div className="flex-1">
                      <Label htmlFor={m.value} className="font-medium cursor-pointer">
                        {m.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>

              {/* Title field for Scorecards (shown in step 2 since it's the final step) */}
              {chartType === 'scorecard' && (
                <>
              {metric === 'meta' && (
                    <div className="space-y-3 pt-4 border-t">
                      <Label className="text-base font-medium">Metas Mensais (R$)</Label>
                      <p className="text-xs text-muted-foreground">Defina a meta de faturamento para cada mês.</p>
                      <div className="space-y-2 max-h-[250px] overflow-y-auto">
                        {(() => {
                          const currentYear = new Date().getFullYear();
                          const months: { key: string; label: string }[] = [];
                          for (let m = 0; m < 12; m++) {
                            const d = new Date(currentYear, m, 1);
                            const key = `${currentYear}-${String(m + 1).padStart(2, '0')}`;
                            const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                            months.push({ key, label });
                          }
                          return months.map((m) => (
                            <div key={m.key} className="flex items-center gap-2">
                              <span className="text-sm w-[130px] capitalize">{m.label}</span>
                              <Input
                                type="number"
                                className="h-8 text-sm"
                                placeholder="0"
                                value={monthlyGoals[m.key] || ''}
                                onChange={(e) => setMonthlyGoals(prev => ({ ...prev, [m.key]: e.target.value }))}
                              />
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="visual-title-scorecard">Título do Scorecard</Label>
                    <Input
                      id="visual-title-scorecard"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Faturamento Total"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: How to Group + Title */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Como agrupar os dados?</p>
                <RadioGroup
                  value={groupBy || ""}
                  onValueChange={(value) => setGroupBy(value as GroupBy)}
                  className="space-y-2"
                >
                  {GROUP_BY_OPTIONS.map((g) => (
                    <div
                      key={g.value}
                      className={cn(
                        "flex items-center space-x-3 rounded-lg border p-4 cursor-pointer transition-colors",
                        groupBy === g.value 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:bg-muted/50"
                      )}
                      onClick={() => setGroupBy(g.value)}
                    >
                      <RadioGroupItem value={g.value} id={g.value} />
                      <div className="flex-1">
                        <Label htmlFor={g.value} className="font-medium cursor-pointer">
                          {g.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{g.description}</p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="visual-title">Título do Visual</Label>
                <Input
                  id="visual-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Faturamento por Mês"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancelar
          </Button>
          
          {step > 1 && (
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex-1"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          )}
          
          {step < totalSteps ? (
            <Button
              onClick={handleNext}
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              className="flex-1"
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={!canCreate || isCreating}
              className="flex-1"
            >
              {isCreating ? "Criando..." : "Criar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
