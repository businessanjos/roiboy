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
import { BarChart3, LineChart, PieChart, Hash, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInsightsDashboards } from "@/hooks/useInsightsDashboards";
import { VisualConfig, DEFAULT_APPEARANCE } from "./visual-builder/types";

interface AddVisualModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ChartType = "bar" | "line" | "pie" | "scorecard";
type Metric = "revenue" | "deals_count" | "avg_ticket" | "conversion" | "lost_reasons";
type GroupBy = "month" | "user" | "stage" | "product";

const CHART_TYPES = [
  { value: "bar" as const, label: "Gráfico de Barras", description: "Comparar valores entre categorias", icon: BarChart3 },
  { value: "line" as const, label: "Gráfico de Linhas", description: "Visualizar tendências ao longo do tempo", icon: LineChart },
  { value: "pie" as const, label: "Gráfico de Pizza", description: "Mostrar proporções de um todo", icon: PieChart },
  { value: "scorecard" as const, label: "Scorecard", description: "Exibir um número ou KPI destacado", icon: Hash },
];

const METRICS = [
  { value: "revenue" as const, label: "Valor Total (R$)", description: "Soma dos valores de negócios" },
  { value: "deals_count" as const, label: "Quantidade de Negócios", description: "Contagem de deals" },
  { value: "avg_ticket" as const, label: "Ticket Médio", description: "Valor médio por negócio" },
  { value: "conversion" as const, label: "Taxa de Conversão", description: "Porcentagem de ganhos" },
  { value: "lost_reasons" as const, label: "Motivos de Perda", description: "Análise de deals perdidos" },
];

const GROUP_BY_OPTIONS = [
  { value: "month" as const, label: "Por Mês", description: "Evolução temporal" },
  { value: "user" as const, label: "Por Vendedor", description: "Comparativo entre usuários" },
  { value: "stage" as const, label: "Por Etapa do Funil", description: "Distribuição por stage" },
  { value: "product" as const, label: "Por Produto", description: "Ranking de produtos" },
];

// Mapping from simplified selections to full VisualConfig
const METRIC_TO_CONFIG: Record<Metric, { dataSource: 'deals'; measureField: string | null; aggregation: 'sum' | 'count' | 'avg'; formatType: 'currency' | 'decimal' | 'percentage' }> = {
  revenue: { dataSource: 'deals', measureField: 'value', aggregation: 'sum', formatType: 'currency' },
  deals_count: { dataSource: 'deals', measureField: null, aggregation: 'count', formatType: 'decimal' },
  avg_ticket: { dataSource: 'deals', measureField: 'value', aggregation: 'avg', formatType: 'currency' },
  conversion: { dataSource: 'deals', measureField: null, aggregation: 'count', formatType: 'percentage' },
  lost_reasons: { dataSource: 'deals', measureField: null, aggregation: 'count', formatType: 'decimal' },
};

const GROUP_BY_TO_DIMENSION: Record<GroupBy, { field: string; type: 'date' | 'text'; dateGrouping?: 'day' | 'week' | 'month' | 'year' }> = {
  month: { field: 'created_at', type: 'date', dateGrouping: 'month' },
  user: { field: 'responsible_name', type: 'text' },
  stage: { field: 'stage_name', type: 'text' },
  product: { field: 'product_name', type: 'text' },
};

const METRIC_LABELS: Record<Metric, string> = {
  revenue: "Faturamento",
  deals_count: "Negócios",
  avg_ticket: "Ticket Médio",
  conversion: "Conversão",
  lost_reasons: "Perdas",
};

const GROUP_LABELS: Record<GroupBy, string> = {
  month: "por Mês",
  user: "por Vendedor",
  stage: "por Etapa",
  product: "por Produto",
};

export function AddVisualModal({ open, onOpenChange }: AddVisualModalProps) {
  const { activeDashboardId, addVisual } = useInsightsDashboards();
  
  const [step, setStep] = useState(1);
  const [chartType, setChartType] = useState<ChartType | null>(null);
  const [metric, setMetric] = useState<Metric | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy | null>(null);
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setChartType(null);
      setMetric(null);
      setGroupBy(null);
      setTitle("");
    }
  }, [open]);

  // Auto-generate title when selections change
  useEffect(() => {
    if (metric && groupBy) {
      const generatedTitle = `${METRIC_LABELS[metric]} ${GROUP_LABELS[groupBy]}`;
      setTitle(generatedTitle);
    }
  }, [metric, groupBy]);

  const canProceedStep1 = chartType !== null;
  const canProceedStep2 = metric !== null;
  const canCreate = groupBy !== null && title.trim() !== "" && activeDashboardId !== null;

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleCreate = async () => {
    if (!canCreate || !chartType || !metric || !groupBy || !activeDashboardId) return;

    setIsCreating(true);
    try {
      const metricConfig = METRIC_TO_CONFIG[metric];
      const dimensionConfig = GROUP_BY_TO_DIMENSION[groupBy];

      const config: VisualConfig = {
        dataSource: metricConfig.dataSource,
        measure: {
          field: metricConfig.measureField || '',
          aggregation: metricConfig.aggregation,
        },
        dimension: {
          field: dimensionConfig.field,
          type: dimensionConfig.type,
          ...(dimensionConfig.dateGrouping && { dateGrouping: dimensionConfig.dateGrouping }),
        },
        formatting: {
          type: metricConfig.formatType,
          decimals: metricConfig.formatType === 'currency' ? 2 : (metricConfig.formatType === 'percentage' ? 1 : 0),
        },
        appearance: DEFAULT_APPEARANCE,
      };

      await addVisual({
        dashboard_id: activeDashboardId,
        title: title.trim(),
        chart_type: chartType,
        config,
        layout: { x: 0, y: 0, w: 6, h: 4 },
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
              — Passo {step} de 3
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

          {/* Step 2: What to Measure */}
          {step === 2 && (
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
          
          {step < 3 ? (
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
