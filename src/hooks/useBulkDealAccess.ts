import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";

export function useBulkDealAccess() {
  const { currentUser } = useCurrentUser();
  const query = useQuery({
    queryKey: ["bulk-deal-access", currentUser?.account_id, currentUser?.auth_user_id, currentUser?.role, currentUser?.is_also_admin],
    enabled: Boolean(currentUser?.auth_user_id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_bulk_edit_deals");
      if (error) throw error;
      return data === true;
    },
    staleTime: 30_000,
  });
  return { canBulkEdit: query.data === true && !query.isError };
}