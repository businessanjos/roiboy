import { useState } from "react";
import { BarChart3, LineChart, PieChart, Hash, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { useInsightsPanels } from "@/hooks/useInsightsPanels";
import {
  WidgetType,
  MetricType,
  GroupByType,
  WIDGET_TYPE_OPTIONS,
  METRIC_OPTIONS,
  GROUP_BY_OPTIONS,
  VALID_COMBINATIONS,
  generateDefaultTitle,
} from "./types";

interface AddWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ICON_MAP = {
  BarChart3: BarChart3,
  LineChart: LineChart,
  PieChart: PieChart,
  Hash: Hash,
};

export function AddWidgetDialog({ open, onOpenChange }: AddWidgetDialogProps) {
  const { addWidget } = useInsightsPanels();
  const [step, setStep] = useState(1);
  const [widgetType, setWidgetType] = useState<WidgetType | null>(null);
  const [metric, setMetric] = useState<MetricType | null>(null);
  const [groupBy, setGroupBy] = useState<GroupByType | null>(null);
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const resetForm = () => {
    setStep(1);
    setWidgetType(null);
    setMetric(null);
    setGroupBy(null);
    setTitle("");
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  const handleNext = () => {
    if (step === 2 && metric) {
      // Reset groupBy if current selection is not valid for new metric
      if (groupBy && !VALID_COMBINATIONS[metric].includes(groupBy)) {
        setGroupBy(null);
      }
      // Auto-generate title when moving to step 3
      if (metric && !title) {
        const validGroupBy = VALID_COMBINATIONS[metric][0];
        setTitle(generateDefaultTitle(metric, groupBy || validGroupBy));
      }
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setStep((s) => s - 1);
  };

  const handleCreate = async () => {
    if (!widgetType || !metric || !groupBy) return;

    setIsCreating(true);
    try {
      await addWidget({
        id: crypto.randomUUID(),
        type: widgetType,
        metric,
        groupBy,
        title: title || generateDefaultTitle(metric, groupBy),
        createdAt: new Date().toISOString(),
      });
      handleClose();
    } catch (error) {
      console.error("Error creating widget:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const canProceedStep1 = widgetType !== null;
  const canProceedStep2 = metric !== null;
  const canProceedStep3 = groupBy !== null;

  const validGroupByOptions = metric
    ? GROUP_BY_OPTIONS.filter((opt) => VALID_COMBINATIONS[metric].includes(opt.value))
    : [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Visual</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Passo {step} de 3 —{" "}
            {step === 1
              ? "Escolha o formato"
              : step === 2
              ? "O que medir?"
              : "Como agrupar?"}
          </p>
        </DialogHeader>

        <div className="py-4">
          {/* Step 1: Widget Type */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {WIDGET_TYPE_OPTIONS.map((option) => {
                const Icon = ICON_MAP[option.icon as keyof typeof ICON_MAP];
                const isSelected = widgetType === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setWidgetType(option.value)}
                    className={cn(
                      "relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:border-primary/50",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <Icon className="h-8 w-8 text-muted-foreground" />
                    <span className="font-medium text-sm">{option.label}</span>
                    <span className="text-xs text-muted-foreground text-center">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Metric */}
          {step === 2 && (
            <RadioGroup
              value={metric || ""}
              onValueChange={(v) => setMetric(v as MetricType)}
              className="space-y-3"
            >
              {METRIC_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50",
                    metric === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  )}
                >
                  <RadioGroupItem value={option.value} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{option.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </RadioGroup>
          )}

          {/* Step 3: Group By + Title */}
          {step === 3 && (
            <div className="space-y-4">
              <RadioGroup
                value={groupBy || ""}
                onValueChange={(v) => {
                  setGroupBy(v as GroupByType);
                  if (metric) {
                    setTitle(generateDefaultTitle(metric, v as GroupByType));
                  }
                }}
                className="space-y-3"
              >
                {validGroupByOptions.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50",
                      groupBy === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    )}
                  >
                    <RadioGroupItem value={option.value} className="mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{option.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {option.description}
                      </div>
                    </div>
                  </label>
                ))}
              </RadioGroup>

              <div className="space-y-2 pt-2">
                <Label htmlFor="widget-title">Título do Visual</Label>
                <Input
                  id="widget-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Faturamento por Mês"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>

          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack}>
                ← Voltar
              </Button>
            )}

            {step < 3 ? (
              <Button
                onClick={handleNext}
                disabled={
                  (step === 1 && !canProceedStep1) ||
                  (step === 2 && !canProceedStep2)
                }
              >
                Próximo →
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={!canProceedStep3 || isCreating}
              >
                {isCreating ? "Criando..." : "Criar"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
