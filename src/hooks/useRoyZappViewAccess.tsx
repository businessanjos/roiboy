import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { ZappView } from "@/lib/royZappRoutes";
import {
  ALL_ZAPP_VIEWS,
  DEFAULT_ZAPP_VIEWS,
  canPickSector,
  sanitizeViewList,
} from "@/lib/royZappAccess";

/**
 * Telas do RoyZapp liberadas para o usuário atual.
 * Maikol/Everton (picker) e admins têm acesso total.
 */
export function useRoyZappViewAccess() {
  const { currentUser, loading: userLoading } = useCurrentUser();
  const userId = currentUser?.id;
  const accountId = currentUser?.account_id;

  const unrestricted =
    canPickSector(currentUser?.email) ||
    currentUser?.role === "admin" ||
    currentUser?.is_also_admin === true;

  const { data, isLoading } = useQuery({
    queryKey: ["royzapp-view-access", userId, accountId],
    enabled: !!userId && !!accountId && !unrestricted,
    staleTime: 300000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ZappView[] | null> => {
      const { data, error } = await (supabase as any)
        .from("user_royzapp_views")
        .select("views")
        .eq("account_id", accountId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return sanitizeViewList(data.views);
    },
  });

  const allowedViews = useMemo<ZappView[]>(() => {
    if (unrestricted) return ALL_ZAPP_VIEWS;
    if (data === null || data === undefined) return DEFAULT_ZAPP_VIEWS;
    // Conversas é sempre necessária para operar o atendimento.
    return data.includes("inbox") ? data : ["inbox", ...data];
  }, [unrestricted, data]);

  return {
    allowedViews,
    canSeeView: (view: ZappView) => allowedViews.includes(view),
    unrestricted,
    loading: userLoading || isLoading,
  };
}
