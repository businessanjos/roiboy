import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GOAL_ENTITY_OPTIONS,
  GOAL_FREQUENCY_OPTIONS,
  GOAL_METRIC_BY_ENTITY,
  GOAL_SCOPE_OPTIONS,
  GoalEntity,
  GoalFrequency,
  GoalMetric,
  GoalScopeType,
  useInsightsGoals,
} from "@/hooks/useInsightsGoals";

export interface GoalVisualSettings {
  goalId?: string | null;
}

interface Props {
  value: GoalVisualSettings;
  onChange: (next: GoalVisualSettings) => void;
}

export function GoalSection({ value, onChange }: Props) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id ?? null;
  const { goals, createGoal, updateGoal, deleteGoal } = useInsightsGoals();
  const [creating, setCreating] = useState(false);
  const selectedGoal = goals.find((g) => g.id === value.goalId) || null;
  const [editTarget, setEditTarget] = useState<string | null>(null);

  const year = new Date().getFullYear();
  const [name, setName] = useState("Nova meta");
  const [entity, setEntity] = useState<GoalEntity>("deal");
  const [metric, setMetric] = useState<GoalMetric>("won_revenue");
  const [scopeType, setScopeType] = useState<GoalScopeType>("company");
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<GoalFrequency>("monthly");
  const [periodStart, setPeriodStart] = useState(`${year}-01-01`);
  const [periodEnd, setPeriodEnd] = useState(`${year}-12-31`);
  const [targetValue, setTargetValue] = useState("0");

  const { data: pipelines = [] } = useQuery({
    queryKey: ["goal-pipelines", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data } = await supabase
        .from("pipelines")
        .select("id, name")
        .eq("account_id", accountId!)
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["goal-users", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, name").eq("account_id", accountId!).order("name");
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["goal-products", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").eq("account_id", accountId!).order("name");
      return data || [];
    },
  });

  const handleEntity = (e: GoalEntity) => {
    setEntity(e);
    setMetric(GOAL_METRIC_BY_ENTITY[e][0].value);
  };

  const handleCreate = async () => {
    const created = await createGoal.mutateAsync({
      name: name.trim() || "Meta",
      entity,
      metric,
      scope_type: scopeType,
      scope_id: scopeType === "company" ? null : scopeId,
      pipeline_id: pipelineId,
      frequency,
      period_start: periodStart,
      period_end: periodEnd,
      target_value: Number(String(targetValue).replace(/\./g, "").replace(",", ".")) || 0,
    } as any);
    if (created?.id) onChange({ goalId: created.id });
    setCreating(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Meta</Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => setCreating((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" /> Nova meta
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Select value={value.goalId || ""} onValueChange={(v) => onChange({ goalId: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma meta" />
          </SelectTrigger>
          <SelectContent>
            {goals.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value.goalId && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={async () => {
              await deleteGoal.mutateAsync(value.goalId!);
              onChange({ goalId: null });
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      {creating && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da meta" />

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={entity} onValueChange={(v) => handleEntity(v as GoalEntity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOAL_ENTITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Métrica</Label>
              <Select value={metric} onValueChange={(v) => setMetric(v as GoalMetric)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOAL_METRIC_BY_ENTITY[entity].map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Responsável</Label>
              <Select
                value={scopeType}
                onValueChange={(v) => {
                  setScopeType(v as GoalScopeType);
                  setScopeId(null);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOAL_SCOPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {scopeType !== "company" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {scopeType === "user" ? "Vendedor" : scopeType === "pipeline" ? "Funil" : "Produto"}
                </Label>
                <Select value={scopeId || ""} onValueChange={setScopeId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {(scopeType === "user" ? users : scopeType === "pipeline" ? pipelines : products).map((o: any) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Funil (filtro)</Label>
              <Select value={pipelineId || "__all__"} onValueChange={(v) => setPipelineId(v === "__all__" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os funis</SelectItem>
                  {pipelines.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Frequência</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as GoalFrequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOAL_FREQUENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Início</Label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fim</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Valor por período</Label>
              <Input value={targetValue} onChange={(e) => setTargetValue(e.target.value)} inputMode="decimal" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            O valor informado é a meta de cada período da frequência escolhida (ex.: por mês).
          </p>

          <Separator />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleCreate} disabled={createGoal.isPending}>
              Criar meta
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
