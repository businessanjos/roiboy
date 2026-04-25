import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { sectors } from "@/config/sectors";
import { Permission, PERMISSIONS } from "@/lib/access/permissions";

export { PERMISSIONS } from "@/lib/access/permissions";
export type { Permission } from "@/lib/access/permissions";

interface PermissionsContextType {
  permissions: string[];
  loading: boolean;
  hasPermission: (permission: Permission | Permission[]) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  isAdmin: boolean;
  refetchPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { currentUser, loading: userLoading } = useCurrentUser();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchPermissions = useCallback(async () => {
    if (!currentUser) {
      setPermissions([]);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    try {
      // Check if user is a real admin (has all permissions).
      // Team role names must NOT bypass admin-panel permission settings.
      const isAdminRole = currentUser.role === "admin" || currentUser.role === "super_admin";
      const hasAdminFlag = currentUser.is_also_admin === true;
      
      if (isAdminRole || hasAdminFlag) {
        // Admin has all permissions
        setPermissions(Object.values(PERMISSIONS));
        setIsAdmin(true);
        setLoading(false);
        return;
      }

      // Fetch permissions based on all roles assigned in the admin panel.
      const roleIds = Array.from(new Set([
        ...(currentUser.team_role_ids || []),
        currentUser.team_role_id,
      ].filter(Boolean))) as string[];

      // We don't early-return when roleIds is empty: the user may still have
      // sector access granted via the admin panel without a team role.

      // Fetch permissions for all assigned roles
      const rolePermsPromise = roleIds.length > 0
        ? supabase
            .from("role_permissions")
            .select("permission")
            .in("role_id", roleIds)
        : Promise.resolve({ data: [] as { permission: string }[], error: null });

      // Also fetch sector access from admin panel — each active sector grants
      // the permissions referenced by its nav items, so the admin panel
      // toggles directly translate into runtime permissions.
      const sectorAccessPromise = supabase
        .from("user_sector_access")
        .select("sector_id, role_in_sector, is_active")
        .eq("user_id", currentUser.id)
        .eq("is_active", true);

      const [{ data: permsData, error: permsError }, { data: sectorAccess, error: sectorErr }] =
        await Promise.all([rolePermsPromise, sectorAccessPromise]);

      if (permsError) console.error("Error fetching role permissions:", permsError);
      if (sectorErr) console.error("Error fetching sector access:", sectorErr);

      const fromRoles = (permsData || []).map((p) => p.permission);

      // Derive permissions from active sector access using the sectors config
      const fromSectors: string[] = [];
      for (const access of sectorAccess || []) {
        const sector = sectors.find((s) => s.id === access.sector_id);
        if (!sector) continue;
        for (const item of sector.navItems) {
          if (!item.permission) continue;
          const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
          fromSectors.push(...perms);
        }
      }

      const merged = Array.from(new Set([...fromRoles, ...fromSectors]));

      if (merged.length === 0) {
        console.warn("No permissions resolved for user", currentUser.id, { roleIds, sectorAccess });
      }
      setPermissions(merged);

      setIsAdmin(false);
    } catch (error) {
      console.error("Error in fetchPermissions:", error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    // Wait for user loading to complete AND currentUser to be available
    if (!userLoading && currentUser) {
      fetchPermissions();
    } else if (!userLoading && !currentUser) {
      // User is not logged in
      setPermissions([]);
      setIsAdmin(false);
      setLoading(false);
    }
  }, [fetchPermissions, userLoading, currentUser]);

  const hasPermission = useCallback(
    (permission: Permission | Permission[]): boolean => {
      // Admin has all permissions
      if (isAdmin) return true;

      if (Array.isArray(permission)) {
        return permission.some((p) => permissions.includes(p));
      }
      return permissions.includes(permission);
    },
    [permissions, isAdmin]
  );

  const hasAnyPermission = useCallback(
    (perms: Permission[]): boolean => {
      if (isAdmin) return true;
      return perms.some((p) => permissions.includes(p));
    },
    [permissions, isAdmin]
  );

  const hasAllPermissions = useCallback(
    (perms: Permission[]): boolean => {
      if (isAdmin) return true;
      return perms.every((p) => permissions.includes(p));
    },
    [permissions, isAdmin]
  );

  const refetchPermissions = useCallback(async () => {
    await fetchPermissions();
  }, [fetchPermissions]);

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        loading: loading || userLoading,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        isAdmin,
        refetchPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}

// Helper component for conditional rendering based on permissions
interface RequirePermissionProps {
  permission: Permission | Permission[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequirePermission({ permission, children, fallback = null }: RequirePermissionProps) {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return null;
  }

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
