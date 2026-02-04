import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ContractStats {
  active: number;
  cancelled: number;
  ended: number;
  suspended: number;
  paused: number;
  total_clients: number;
}

export function useDashboardContractStats(accountId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard-contract-stats", accountId],
    queryFn: async () => {
      if (!accountId) return null;
      
      const { data, error } = await supabase
        .rpc("get_dashboard_contract_counts", { p_account_id: accountId });
      
      if (error) throw error;
      return data as unknown as ContractStats;
    },
    enabled: !!accountId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes cache
  });
}
