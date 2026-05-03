import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Conta quantas "Cadeiras Duplas" existem na conta.
 * Cadeira Dupla = vínculo entre clientes com sync_data=true e is_active=true.
 * Cada relação conta como 1 cadeira dupla (não 2).
 */
export function useDoubleChairCount(accountId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard-double-chair-count", accountId],
    queryFn: async () => {
      if (!accountId) return 0;
      const { count, error } = await supabase
        .from("client_relationships")
        .select("*", { count: "exact", head: true })
        .eq("account_id", accountId)
        .eq("sync_data", true)
        .eq("is_active", true);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!accountId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
  });
}
