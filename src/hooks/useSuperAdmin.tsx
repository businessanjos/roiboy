import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Centralized super admin check — replaces 4+ duplicate RPC calls across the app.
 * Uses react-query with a short staleTime + realtime invalidation so role changes
 * propagate to the user's open sessions without requiring a logout/refresh.
 */
export function useSuperAdmin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: isSuperAdmin = false, isLoading } = useQuery({
    queryKey: ["is-super-admin-global", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase.rpc("is_super_admin", { _user_id: user.id });
      return data === true;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30, // 30s — short enough that role grants land fast
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Realtime invalidation: when the current user is granted/revoked super_admin,
  // invalidate this query immediately. No logout needed.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`super-admin-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "super_admins",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["is-super-admin-global", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return { isSuperAdmin, isLoading };
}
