import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";

export interface CsIncentivePlan {
  id: string;
  account_id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  base_salary_monthly: number;
  variable_target_monthly: number;
  minimum_achievement_percent: number;
  weight_renewal: number;
  weight_churn: number;
  weight_nps: number;
  monthly_bonus_value: number;
  monthly_bonus_payment_channel: string | null;
  quarterly_bonus_enabled: boolean;
  quarterly_bonus_value: number;
  quarterly_bonus_rules: string | null;
  quarterly_bonus_payment_channel: string | null;
  annual_bonus_enabled: boolean;
  annual_bonus_value: number;
  annual_bonus_rules: string | null;
  annual_bonus_payment_channel: string | null;
  churn_penalty_enabled: boolean;
  churn_penalty_threshold: number;
  churn_penalty_percent: number;
  routines: string[];
  notes: string | null;
}

export interface CsIncentiveTier {
  id: string;
  plan_id: string;
  min_achievement_percent: number;
  max_achievement_percent: number | null;
  bonus_multiplier: number;
  label: string | null;
}

export function useCsIncentivePlans() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const qc = useQueryClient();

  const plansQuery = useQuery({
    queryKey: ["cs-incentive-plans", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cs_incentive_plans" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CsIncentivePlan[];
    },
  });

  const tiersQuery = useQuery({
    queryKey: ["cs-incentive-tiers", accountId],
    enabled: !!accountId && !!plansQuery.data,
    queryFn: async () => {
      const ids = (plansQuery.data || []).map((p) => p.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("cs_incentive_tiers" as any)
        .select("*")
        .in("plan_id", ids)
        .order("min_achievement_percent");
      if (error) throw error;
      return (data || []) as unknown as CsIncentiveTier[];
    },
  });

  const savePlan = useMutation({
    mutationFn: async (plan: Partial<CsIncentivePlan>) => {
      if (!accountId) throw new Error("No account");
      const payload: any = { ...plan, account_id: accountId };
      if (plan.id) {
        const { id, ...upd } = payload;
        const { data, error } = await supabase
          .from("cs_incentive_plans" as any)
          .update(upd)
          .eq("id", plan.id)
          .select()
          .single();
        if (error) throw error;
        return data as unknown as CsIncentivePlan;
      } else {
        const { data, error } = await supabase
          .from("cs_incentive_plans" as any)
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return data as unknown as CsIncentivePlan;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cs-incentive-plans"] });
      qc.invalidateQueries({ queryKey: ["cs-incentive-tiers"] });
      toast.success("Plano salvo");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cs_incentive_plans" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cs-incentive-plans"] }),
  });

  const saveTiers = useMutation({
    mutationFn: async ({
      planId,
      tiers,
    }: {
      planId: string;
      tiers: Omit<CsIncentiveTier, "id">[];
    }) => {
      await supabase.from("cs_incentive_tiers" as any).delete().eq("plan_id", planId);
      if (tiers.length > 0) {
        const { error } = await supabase
          .from("cs_incentive_tiers" as any)
          .insert(tiers.map((t) => ({ ...t, plan_id: planId })));
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cs-incentive-tiers"] }),
  });

  return {
    plans: plansQuery.data ?? [],
    tiers: tiersQuery.data ?? [],
    loading: plansQuery.isLoading || tiersQuery.isLoading,
    savePlan,
    deletePlan,
    saveTiers,
  };
}
