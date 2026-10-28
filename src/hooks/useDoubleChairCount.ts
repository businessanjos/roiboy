import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clientScopeIds, clientScopeKey } from "@/lib/dashboard/clientScope";

/**
 * Conta quantas "Cadeiras Duplas" existem na conta.
 * Cadeira Dupla = vínculo entre clientes com sync_data=true e is_active=true.
 * Cada relação conta como 1 cadeira dupla (não 2).
 *
 * `clientIds` restringe a contagem a vínculos em que OS DOIS clientes estão no
 * escopo (usado pelo filtro de formação do dashboard).
 */
export function useDoubleChairCount(accountId: string | undefined, clientIds?: string[] | null) {
  return useQuery({
    queryKey: ["dashboard-double-chair-count", accountId, clientScopeKey(clientIds)],
    queryFn: async () => {
      if (!accountId) return 0;

      const scope = clientScopeIds(clientIds);
      if (scope) {
        const { data, error } = await supabase
          .from("client_relationships")
          .select("primary_client_id, related_client_id")
          .eq("account_id", accountId)
          .eq("is_active", true);
        if (error) throw error;
        return (data || []).filter(
          (row: any) => scope.has(row.primary_client_id) && scope.has(row.related_client_id),
        ).length;
      }

      const { count, error } = await supabase
        .from("client_relationships")
        .select("*", { count: "exact", head: true })
        .eq("account_id", accountId)
        .eq("is_active", true);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!accountId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
  });
}
