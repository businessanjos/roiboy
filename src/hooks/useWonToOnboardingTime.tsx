import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WonToOnboardingStats {
  avg_days: number | null;
  median_days: number | null;
  sample_count: number;
  min_days: number | null;
  max_days: number | null;
}

export function useWonToOnboardingTime(accountId?: string, monthsBack: number = 6) {
  return useQuery({
    queryKey: ["won-to-onboarding-time", accountId, monthsBack],
    enabled: !!accountId,
    queryFn: async (): Promise<WonToOnboardingStats> => {
      const { data, error } = await (supabase.rpc as any)("get_avg_won_to_onboarding_days", {
        p_account_id: accountId!,
        p_months_back: monthsBack,
      });
      if (error) throw error;
      const row = (data as any[])?.[0];
      return {
        avg_days: row?.avg_days != null ? Number(row.avg_days) : null,
        median_days: row?.median_days != null ? Number(row.median_days) : null,
        sample_count: row?.sample_count ?? 0,
        min_days: row?.min_days != null ? Number(row.min_days) : null,
        max_days: row?.max_days != null ? Number(row.max_days) : null,
      };
    },
  });
}
