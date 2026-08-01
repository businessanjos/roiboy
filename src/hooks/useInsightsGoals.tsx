import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export type GoalEntity = "deal" | "activity" | "forecast";
export type GoalMetric =
  | "won_revenue"
  | "deal_count"
  | "activities_completed"
  | "forecast_revenue";
export type GoalScopeType = "company" | "user" | "pipeline" | "product";
export type GoalFrequency = "weekly" | "monthly" | "quarterly" | "yearly";

export interface InsightsGoal {
  id: string;
  account_id: string;
  name: string;
  entity: GoalEntity;
  metric: GoalMetric;
  scope_type: GoalScopeType;
  scope_id: string | null;
  pipeline_id: string | null;
  activity_type_id: string | null;
  frequency: GoalFrequency;
  period_start: string;
  period_end: string;
  target_value: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const GOAL_ENTITY_OPTIONS: { value: GoalEntity; label: string; description: string }[] = [
  { value: "deal", label: "Negócio", description: "Receita ganha ou quantidade de negócios fechados" },
  { value: "activity", label: "Atividade", description: "Atividades concluídas no período" },
  { value: "forecast", label: "Previsão", description: "Receita prevista ponderada pela etapa" },
];

export const GOAL_METRIC_BY_ENTITY: Record<GoalEntity, { value: GoalMetric; label: string; currency: boolean }[]> = {
  deal: [
    { value: "won_revenue", label: "Receita ganha", currency: true },
    { value: "deal_count", label: "Negócios ganhos", currency: false },
  ],
  activity: [{ value: "activities_completed", label: "Atividades concluídas", currency: false }],
  forecast: [{ value: "forecast_revenue", label: "Receita prevista (ponderada)", currency: true }],
};

export const GOAL_FREQUENCY_OPTIONS: { value: GoalFrequency; label: string }[] = [
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "yearly", label: "Anual" },
];

export const GOAL_SCOPE_OPTIONS: { value: GoalScopeType; label: string }[] = [
  { value: "company", label: "Empresa (todos)" },
  { value: "user", label: "Vendedor" },
  { value: "pipeline", label: "Funil" },
  { value: "product", label: "Item da venda" },
];

export function isCurrencyMetric(metric: GoalMetric) {
  return metric === "won_revenue" || metric === "forecast_revenue";
}

export function useInsightsGoals(accountIdOverride?: string | null) {
  const { currentUser } = useCurrentUser();
  const accountId = accountIdOverride || currentUser?.account_id || null;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["insights-goals", accountId],
    enabled: !!accountId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("insights_goals")
        .select("*")
        .eq("account_id", accountId)
        .order("period_start", { ascending: false });
      if (error) throw error;
      return (data || []) as InsightsGoal[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["insights-goals"] });

  const createGoal = useMutation({
    mutationFn: async (payload: Partial<InsightsGoal>) => {
      const { data, error } = await (supabase as any)
        .from("insights_goals")
        .insert({ ...payload, account_id: accountId, created_by: currentUser?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data as InsightsGoal;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Meta criada");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar meta"),
  });

  const updateGoal = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InsightsGoal> & { id: string }) => {
      const { error } = await (supabase as any).from("insights_goals").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Meta atualizada");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar meta"),
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("insights_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Meta excluída");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir meta"),
  });

  return {
    goals: query.data || [],
    isLoading: query.isLoading,
    createGoal,
    updateGoal,
    deleteGoal,
  };
}

export function useInsightsGoal(goalId?: string | null, accountIdOverride?: string | null) {
  const { currentUser } = useCurrentUser();
  const accountId = accountIdOverride || currentUser?.account_id || null;
  return useQuery({
    queryKey: ["insights-goal", goalId, accountId],
    enabled: !!goalId && !!accountId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("insights_goals")
        .select("*")
        .eq("id", goalId)
        .eq("account_id", accountId)
        .maybeSingle();
      if (error) throw error;
      return (data as InsightsGoal) || null;
    },
  });
}
