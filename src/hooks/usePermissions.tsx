import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";

// All available permissions in the system
export const PERMISSIONS = {
  CLIENTS_VIEW: "clients.view",
  CLIENTS_EDIT: "clients.edit",
  CLIENTS_DELETE: "clients.delete",
  TEAM_VIEW: "team.view",
  TEAM_EDIT: "team.edit",
  SETTINGS_VIEW: "settings.view",
  SETTINGS_EDIT: "settings.edit",
  REPORTS_VIEW: "reports.view",
  EVENTS_VIEW: "events.view",
  EVENTS_EDIT: "events.edit",
  FORMS_VIEW: "forms.view",
  FORMS_EDIT: "forms.edit",
  PRODUCTS_VIEW: "products.view",
  PRODUCTS_EDIT: "products.edit",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

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
      // Check if user is admin (has all permissions)
      if (currentUser.role === "admin") {
        // Admin has all permissions
        setPermissions(Object.values(PERMISSIONS));
        setIsAdmin(true);
        setLoading(false);
        return;
      }

      // Fetch permissions based on user's team_role_id
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("team_role_id")
        .eq("id", currentUser.id)
        .single();

      if (userError || !userData?.team_role_id) {
        // No role assigned, no permissions
        setPermissions([]);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // Fetch permissions for this role
      const { data: permsData, error: permsError } = await supabase
        .from("role_permissions")
        .select("permission")
        .eq("role_id", userData.team_role_id);

      if (permsError) {
        console.error("Error fetching permissions:", permsError);
        setPermissions([]);
      } else {
        setPermissions(permsData?.map((p) => p.permission) || []);
      }

      setIsAdmin(false);
    } catch (error) {
      console.error("Error in fetchPermissions:", error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!userLoading) {
      fetchPermissions();
    }
  }, [fetchPermissions, userLoading]);

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
