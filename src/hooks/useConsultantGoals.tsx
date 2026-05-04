import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";

export type MetricType = "renewal_rate" | "churn_rate" | "nps";

export interface ConsultantGoal {
  id: string;
  account_id: string;
  user_id: string;
  product_id: string;
  year: number;
  metric_type: MetricType;
  annual_target: number;
  monthly_targets: Record<string, number>;
  bonus_amount: number;
  notes: string | null;
}

export const METRIC_LABELS: Record<MetricType, string> = {
  renewal_rate: "Taxa de Renovação (%)",
  churn_rate: "Churn (%)",
  nps: "NPS",
};

export const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function useConsultantGoals(year: number) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["consultant-goals", currentUser?.account_id, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultant_goals")
        .select("*")
        .eq("year", year);
      if (error) throw error;
      return (data || []) as unknown as ConsultantGoal[];
    },
    enabled: !!currentUser?.account_id,
  });

  const upsertGoal = useMutation({
    mutationFn: async (params: {
      user_id: string;
      product_id: string;
      metric_type: MetricType;
      annual_target: number;
      monthly_targets: Record<string, number>;
      bonus_amount: number;
      notes?: string | null;
    }) => {
      if (!currentUser?.account_id) throw new Error("No account");
      const { data, error } = await supabase
        .from("consultant_goals")
        .upsert(
          {
            account_id: currentUser.account_id,
            user_id: params.user_id,
            product_id: params.product_id,
            year,
            metric_type: params.metric_type,
            annual_target: params.annual_target,
            monthly_targets: params.monthly_targets as any,
            bonus_amount: params.bonus_amount,
            notes: params.notes ?? null,
          },
          { onConflict: "account_id,user_id,product_id,year,metric_type" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultant-goals"] });
      toast.success("Meta salva com sucesso!");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar meta"),
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("consultant_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultant-goals"] });
      toast.success("Meta removida");
    },
  });

  return { goals, isLoading, upsertGoal, deleteGoal };
}
