import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Centralized super admin check — replaces 4+ duplicate RPC calls across the app.
 * Uses react-query with a 10-minute staleTime so it's called once and shared everywhere.
 */
export function useSuperAdmin() {
  const { user } = useAuth();

  const { data: isSuperAdmin = false, isLoading } = useQuery({
    queryKey: ["is-super-admin-global", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase.rpc("is_super_admin", { _user_id: user.id });
      return data === true;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  return { isSuperAdmin, isLoading };
}
