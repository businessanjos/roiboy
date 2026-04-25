import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { useSuperAdmin } from "./useSuperAdmin";
import { SectorId } from "@/config/sectors";
import { hasExactRole } from "@/lib/roles";

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
  
  const userId = currentUser?.id;
  const accountId = currentUser?.account_id;
  const userRole = currentUser?.role;
  const teamRoleName = currentUser?.team_role_name;
  const isAlsoAdmin = currentUser?.is_also_admin === true;
  const teamRoleNamesAll = currentUser?.team_role_names || (teamRoleName ? [teamRoleName] : []);
  const isTeamRoleAdmin = teamRoleNamesAll.some((name) => hasExactRole(name, "Admin"));

  const { data: sectorAccess = [], isLoading } = useQuery({
    queryKey: ["user-sector-access", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("user_sector_access")
        .select("sector_id, role_in_sector, is_active")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (error) throw error;
      return (data || []) as SectorAccess[];
    },
    enabled: !!userId,
    staleTime: 300000, // OPTIMIZED: 5 minutes (up from 60 seconds) - sector access rarely changes
    refetchOnWindowFocus: false,
  });

  const { data: sectorSettings = [] } = useQuery({
    queryKey: ["sector-settings", accountId],
    queryFn: async () => {
      if (!accountId) return [];

      const { data, error } = await supabase
        .from("sector_settings")
        .select("sector_id, royzapp_enabled")
        .eq("account_id", accountId);

      if (error) throw error;
      return (data || []) as SectorSettings[];
    },
    enabled: !!accountId,
    staleTime: 300000, // OPTIMIZED: 5 minutes
    refetchOnWindowFocus: false,
  });

  // Use centralized super admin hook (eliminates duplicate RPC calls)
  const { isSuperAdmin } = useSuperAdmin();

  const hasSectorAccess = (sectorId: SectorId): boolean => {
    
    // Only explicit admin flags bypass the per-user sector settings from the admin panel.
    if (userRole === "admin" || isAlsoAdmin || isTeamRoleAdmin) return true;
    
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
