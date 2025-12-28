import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { SectorId } from "@/config/sectors";

interface SectorAccess {
  sector_id: SectorId;
  role_in_sector: string | null;
  is_active: boolean;
}

export function useSectorAccess() {
  const { currentUser } = useCurrentUser();

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

  const hasSectorAccess = (sectorId: SectorId): boolean => {
    // Admins have access to all sectors
    if (currentUser?.role === "admin") return true;
    
    return sectorAccess.some((access) => access.sector_id === sectorId);
  };

  const hasVendasAccess = hasSectorAccess("vendas");

  return {
    sectorAccess,
    isLoading,
    hasSectorAccess,
    hasVendasAccess,
  };
}
