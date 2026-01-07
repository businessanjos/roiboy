import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { SectorId } from "@/config/sectors";

interface SectorAccess {
  sector_id: SectorId;
  role_in_sector: string | null;
  is_active: boolean;
}

interface SectorSettings {
  sector_id: string;
  royzapp_enabled: boolean;
}

export function useSectorAccess() {
  const { currentUser } = useCurrentUser();

  // Check if user is super_admin
  const { data: isSuperAdmin = false } = useQuery({
    queryKey: ["is-super-admin", currentUser?.auth_user_id],
    queryFn: async () => {
      if (!currentUser?.auth_user_id) return false;
      const { data } = await supabase.rpc('is_super_admin', { _user_id: currentUser.auth_user_id });
      return data === true;
    },
    enabled: !!currentUser?.auth_user_id,
    staleTime: 60000,
  });

  const { data: sectorAccess = [], isLoading } = useQuery({
    queryKey: ["user-sector-access", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];

      const { data, error } = await supabase
        .from("user_sector_access")
        .select("sector_id, role_in_sector, is_active")
        .eq("user_id", currentUser.id)
        .eq("is_active", true);

      if (error) throw error;
      return (data || []) as SectorAccess[];
    },
    enabled: !!currentUser?.id,
    staleTime: 60000,
  });

  const { data: sectorSettings = [] } = useQuery({
    queryKey: ["sector-settings", currentUser?.account_id],
    queryFn: async () => {
      if (!currentUser?.account_id) return [];

      const { data, error } = await supabase
        .from("sector_settings")
        .select("sector_id, royzapp_enabled")
        .eq("account_id", currentUser.account_id);

      if (error) throw error;
      return (data || []) as SectorSettings[];
    },
    enabled: !!currentUser?.account_id,
    staleTime: 60000,
  });

  const hasSectorAccess = (sectorId: SectorId): boolean => {
    // Diretoria sector is ONLY accessible by super_admin
    if (sectorId === "diretoria") {
      return isSuperAdmin;
    }
    
    // Admins have access to all other sectors
    if (currentUser?.role === "admin") return true;
    
    return sectorAccess.some((access) => access.sector_id === sectorId);
  };

  const isSectorRoyzappEnabled = (sectorId: SectorId): boolean => {
    const setting = sectorSettings.find(s => s.sector_id === sectorId);
    // Default to true if no setting exists
    return setting?.royzapp_enabled ?? true;
  };

  const canAccessSectorRoyzapp = (sectorId: SectorId): boolean => {
    // Check if sector has ROY zAPP enabled AND user has access
    return isSectorRoyzappEnabled(sectorId) && hasSectorAccess(sectorId);
  };

  const hasVendasAccess = hasSectorAccess("vendas");

  return {
    sectorAccess,
    sectorSettings,
    isLoading,
    isSuperAdmin,
    hasSectorAccess,
    isSectorRoyzappEnabled,
    canAccessSectorRoyzapp,
    hasVendasAccess,
  };
}
