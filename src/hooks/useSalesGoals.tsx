import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export type SalesGoalPeriodType = "weekly" | "monthly";
export type SalesGoalTargetType = "revenue" | "count";

export interface SalesGoal {
  id: string;
  account_id: string;
  user_id: string;
  period_type: SalesGoalPeriodType;
  period_start: string; // YYYY-MM-DD
  period_end: string;   // YYYY-MM-DD
  target_type: SalesGoalTargetType;
  target_value: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesGoalInput {
  user_id: string;
  period_type: SalesGoalPeriodType;
  period_start: string;
  period_end: string;
  target_type: SalesGoalTargetType;
  target_value: number;
  note?: string | null;
}

export function useSalesGoals() {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["sales-rep-goals", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async (): Promise<SalesGoal[]> => {
      const { data, error } = await supabase
        .from("sales_rep_goals")
        .select("*")
        .order("period_start", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SalesGoal[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: SalesGoalInput) => {
      if (!currentUser?.account_id) throw new Error("Sem conta ativa");
      const { data, error } = await supabase
        .from("sales_rep_goals")
        .insert({
          account_id: currentUser.account_id,
          created_by: currentUser.id,
          ...input,
        })
        .select()
        .single();
      if (error) throw error;
      return data as SalesGoal;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-rep-goals"] });
      toast.success("Meta criada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar meta"),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<SalesGoalInput>) => {
      const { data, error } = await supabase
        .from("sales_rep_goals")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as SalesGoal;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-rep-goals"] });
      toast.success("Meta atualizada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar meta"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_rep_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-rep-goals"] });
      toast.success("Meta removida");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover meta"),
  });

  return { ...query, create, update, remove };
}

export function useSalesGoalProgress(goal: SalesGoal | null | undefined) {
  return useQuery({
    queryKey: ["sales-goal-progress", goal?.id],
    enabled: !!goal,
    queryFn: async () => {
      if (!goal) return { total: 0, count: 0, deals: [] as any[] };
      // End of day inclusive
      const endInclusive = `${goal.period_end}T23:59:59.999Z`;
      const startISO = `${goal.period_start}T00:00:00.000Z`;
      const { data, error } = await supabase
        .from("deals")
        .select("id, title, value, won_at, client_id, status")
        .eq("responsible_user_id", goal.user_id)
        .eq("status", "won")
        .not("won_at", "is", null)
        .gte("won_at", startISO)
        .lte("won_at", endInclusive)
        .is("deleted_at", null)
        .order("won_at", { ascending: false });
      if (error) throw error;
      const deals = data ?? [];
      const total = deals.reduce((s, d: any) => s + Number(d.value ?? 0), 0);
      return { total, count: deals.length, deals };
    },
  });
}
