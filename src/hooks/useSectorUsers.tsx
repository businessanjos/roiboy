import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export interface SectorUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  role_in_sector: string;
}

interface UseSectorUsersOptions {
  sectorId: string;
  activeOnly?: boolean;
}

export function useSectorUsers({ sectorId, activeOnly = true }: UseSectorUsersOptions) {
  const { currentUser } = useCurrentUser();
  const [users, setUsers] = useState<SectorUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    if (!currentUser?.account_id || !sectorId) {
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get users with access to the specified sector
      const { data, error } = await supabase
        .from("user_sector_access")
        .select(`
          user_id,
          role_in_sector,
          is_active,
          user:users!user_sector_access_user_id_fkey(
            id,
            name,
            email,
            avatar_url,
            role,
            is_active
          )
        `)
        .eq("sector_id", sectorId)
        .eq("account_id", currentUser.account_id)
        .eq("is_active", activeOnly ? true : undefined);

      if (error) throw error;

      // Also fetch inactive HR collaborators to exclude them everywhere
      let inactiveEmails = new Set<string>();
      if (activeOnly) {
        const { data: hrData } = await supabase
          .from("hr_collaborators")
          .select("email")
          .eq("account_id", currentUser.account_id)
          .eq("status", "inactive");
        inactiveEmails = new Set(
          (hrData || [])
            .map((r: any) => String(r.email || "").trim().toLowerCase())
            .filter(Boolean),
        );
      }

      const sectorUsers: SectorUser[] = (data || [])
        .filter((access: any) => {
          if (!access.user) return false;
          if (activeOnly) {
            if (!access.is_active) return false;
            if (access.user.is_active === false) return false;
            const email = String(access.user.email || "").trim().toLowerCase();
            if (email && inactiveEmails.has(email)) return false;
          }
          return true;
        })
        .map((access: any) => ({
          id: access.user.id,
          name: access.user.name,
          email: access.user.email,
          avatar_url: access.user.avatar_url,
          role: access.user.role,
          role_in_sector: access.role_in_sector,
        }));

      // Sort by name
      sectorUsers.sort((a, b) => a.name.localeCompare(b.name));

      setUsers(sectorUsers);
    } catch (error) {
      console.error("Error fetching sector users:", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.account_id, sectorId, activeOnly]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    loading,
    refetch: fetchUsers,
  };
}
