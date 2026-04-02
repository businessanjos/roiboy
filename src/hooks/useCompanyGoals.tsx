import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";

export interface CompanyGoal {
  id: string;
  account_id: string;
  year: number;
  annual_goal: number;
  monthly_goals: Record<string, number>;
  goal_type: string;
  notes: string | null;
}

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function useCompanyGoals(year: number) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const { data: goal, isLoading } = useQuery({
    queryKey: ["company-goals", currentUser?.account_id, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_goals")
        .select("*")
        .eq("year", year)
        .eq("goal_type", "revenue")
        .maybeSingle();
      if (error) throw error;
      return data as CompanyGoal | null;
    },
    enabled: !!currentUser?.account_id,
  });

  const upsertGoal = useMutation({
    mutationFn: async (params: { annual_goal: number; monthly_goals: Record<string, number>; notes?: string }) => {
      if (!currentUser?.account_id) throw new Error("No account");
      const { data, error } = await supabase
        .from("company_goals")
        .upsert(
          {
            account_id: currentUser.account_id,
            year,
            annual_goal: params.annual_goal,
            monthly_goals: params.monthly_goals as any,
            goal_type: "revenue",
            notes: params.notes || null,
          },
          { onConflict: "account_id,year,goal_type" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-goals"] });
      toast.success("Meta da empresa salva com sucesso!");
    },
    onError: () => toast.error("Erro ao salvar meta"),
  });

  return { goal, isLoading, upsertGoal, MONTH_LABELS };
}
