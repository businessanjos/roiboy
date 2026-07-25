import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { ZappView } from "@/lib/royZappRoutes";
import {
  ALL_ZAPP_VIEWS,
  DEFAULT_ZAPP_VIEWS,
  ZAPP_WHATSAPP_SECTORS,
  canPickSector,
  sanitizeViewList,
  sanitizeZappSectorList,
  type ZappWhatsAppSector,
} from "@/lib/royZappAccess";

interface ZappAccessRow {
  views: ZappView[];
  zappSectors: ZappWhatsAppSector[] | null;
}

/**
 * Acesso do usuário atual dentro do RoyZapp — dois controles independentes:
 *
 * 1. `allowedZappSectors`: quais WhatsApps de setor ele pode abrir. É separado do
 *    acesso geral ao setor (`user_sector_access`): dar pipeline Comercial não dá
 *    o WhatsApp do Comercial e vice-versa. `null` = herda os setores gerais.
 * 2. `allowedViews`: quais telas internas do RoyZapp ele vê.
 *
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
    queryFn: async (): Promise<ZappAccessRow | null> => {
      const { data, error } = await (supabase as any)
        .from("user_royzapp_views")
        .select("views, zapp_sectors")
        .eq("account_id", accountId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const zappSectors = data.zapp_sectors === null || data.zapp_sectors === undefined
        ? null
        : sanitizeZappSectorList(data.zapp_sectors);
      return { views: sanitizeViewList(data.views), zappSectors };
    },
  });

  const allowedViews = useMemo<ZappView[]>(() => {
    if (unrestricted) return ALL_ZAPP_VIEWS;
    const views = data?.views;
    if (!views || views.length === 0) return DEFAULT_ZAPP_VIEWS;
    // Conversas é sempre necessária para operar o atendimento.
    return views.includes("inbox") ? views : ["inbox", ...views];
  }, [unrestricted, data]);

  /** `null` = sem restrição específica do RoyZapp (herda os setores gerais). */
  const allowedZappSectors = useMemo<ZappWhatsAppSector[] | null>(() => {
    if (unrestricted) return [...ZAPP_WHATSAPP_SECTORS];
    return data?.zappSectors ?? null;
  }, [unrestricted, data]);

  /**
   * Regra final de acesso ao WhatsApp de um setor.
   * @param hasGeneralSectorAccess acesso geral ao setor (user_sector_access)
   */
  const canOpenZappSector = (sectorId: string, hasGeneralSectorAccess: boolean) => {
    if (unrestricted) return true;
    if (allowedZappSectors === null) return hasGeneralSectorAccess;
    return allowedZappSectors.includes(sectorId as ZappWhatsAppSector);
  };

  return {
    allowedViews,
    canSeeView: (view: ZappView) => allowedViews.includes(view),
    allowedZappSectors,
    canOpenZappSector,
    unrestricted,
    loading: userLoading || isLoading,
  };
}
