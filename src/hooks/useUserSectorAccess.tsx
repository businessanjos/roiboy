import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { SectorId } from "@/config/sectors";

export interface UserSectorAccessData {
  sector_id: string;
  role_in_sector: "admin" | "manager" | "member" | "viewer";
  is_active: boolean;
}

interface UseUserSectorAccessReturn {
  sectorAccess: UserSectorAccessData[];
  loading: boolean;
  refetch: () => Promise<void>;
  canManageSector: (sectorId: SectorId | string | null) => boolean;
  hasAccessToSector: (sectorId: SectorId | string | null) => boolean;
  getRoleInSector: (sectorId: SectorId | string | null) => string | null;
}

export function useUserSectorAccess(): UseUserSectorAccessReturn {
  const { currentUser } = useCurrentUser();
  const [sectorAccess, setSectorAccess] = useState<UserSectorAccessData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSectorAccess = useCallback(async () => {
    if (!currentUser?.id || !currentUser?.account_id) {
      setSectorAccess([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_sector_access")
        .select("sector_id, role_in_sector, is_active")
        .eq("user_id", currentUser.id)
        .eq("account_id", currentUser.account_id)
        .eq("is_active", true);

      if (error) throw error;
      setSectorAccess((data || []) as UserSectorAccessData[]);
    } catch (error) {
      console.error("Error fetching user sector access:", error);
      setSectorAccess([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, currentUser?.account_id]);

  useEffect(() => {
    fetchSectorAccess();
  }, [fetchSectorAccess]);

  // Check if user can manage (create/edit/delete) resources in a sector
  // Admin and manager roles can manage; null sector means global (only admin can manage)
  const canManageSector = useCallback((sectorId: SectorId | string | null): boolean => {
    // Super admin or account admin can manage everything
    if (currentUser?.role === "admin") return true;

    // If sector is null (global resource), only admins can manage
    if (!sectorId) return false;

    // Find user's access to this sector
    const access = sectorAccess.find(
      (a) => a.sector_id === sectorId && a.is_active
    );

    if (!access) return false;

    // Only admin and manager roles can manage resources
    return access.role_in_sector === "admin" || access.role_in_sector === "manager";
  }, [currentUser?.role, sectorAccess]);

  // Check if user has any access to a sector (including view-only)
  const hasAccessToSector = useCallback((sectorId: SectorId | string | null): boolean => {
    if (currentUser?.role === "admin") return true;
    if (!sectorId) return true; // Global resources are viewable by all

    return sectorAccess.some(
      (a) => a.sector_id === sectorId && a.is_active
    );
  }, [currentUser?.role, sectorAccess]);

  // Get user's role in a specific sector
  const getRoleInSector = useCallback((sectorId: SectorId | string | null): string | null => {
    if (currentUser?.role === "admin") return "admin";
    if (!sectorId) return null;

    const access = sectorAccess.find(
      (a) => a.sector_id === sectorId && a.is_active
    );

    return access?.role_in_sector || null;
  }, [currentUser?.role, sectorAccess]);

  return {
    sectorAccess,
    loading,
    refetch: fetchSectorAccess,
    canManageSector,
    hasAccessToSector,
    getRoleInSector,
  };
}
