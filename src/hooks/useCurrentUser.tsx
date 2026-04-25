import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  account_id: string;
  auth_user_id: string | null;
  is_also_admin?: boolean;
  /** When false, the super admin has revoked this user's access. */
  is_active?: boolean;
  zapp_signature: string | null;
  zapp_signature_enabled: boolean;
  team_role_name?: string;
  team_role_names?: string[];
  team_role_id?: string | null;
  team_role_ids?: string[];
}

interface CurrentUserContextType {
  currentUser: CurrentUser | null;
  loading: boolean;
  refetchUser: () => Promise<void>;
  updateUser: (updates: Partial<CurrentUser>) => void;
}

const CurrentUserContext = createContext<CurrentUserContextType | undefined>(undefined);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async (attempt = 0): Promise<void> => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      // Fetch user profile
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email, role, avatar_url, account_id, auth_user_id, is_also_admin, zapp_signature, zapp_signature_enabled, team_role_id, team_role:team_roles(name)")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();

      if (error || !data) {
        console.error("[useCurrentUser] Error fetching user profile (attempt " + attempt + "):", error);
        // Retry up to 2 more times with exponential backoff. Transient
        // failures (network, cold RLS, refresh token race) were silently
        // leaving the whole app in a permanent loading state.
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
          return fetchUser(attempt + 1);
        }
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      // Fetch all roles from junction table (parallel-safe, no dependency on profile query besides user id)
      const { data: userRolesData } = await supabase
        .from("user_team_roles")
        .select("team_role_id, team_role:team_roles(name)")
        .eq("user_id", data.id);

      const teamRoleNames = (userRolesData || []).map((ur: any) => ur.team_role?.name).filter(Boolean);
      const teamRoleIds = (userRolesData || []).map((ur: any) => ur.team_role_id);

      let teamRoleName = (data as any).team_role?.name;
      const teamRoleId = (data as any).team_role_id;

      if (teamRoleNames.length > 0 && !teamRoleName) {
        teamRoleName = teamRoleNames[0];
      }

      setCurrentUser({
        ...data,
        team_role_name: teamRoleName,
        team_role_names: teamRoleNames,
        team_role_id: teamRoleId,
        team_role_ids: teamRoleIds,
      } as CurrentUser);
      setLoading(false);
    } catch (error) {
      console.error("[useCurrentUser] Unexpected error (attempt " + attempt + "):", error);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        return fetchUser(attempt + 1);
      }
      setCurrentUser(null);
      setLoading(false);
    }
  }, []);

  const refetchUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  const updateUser = useCallback((updates: Partial<CurrentUser>) => {
    setCurrentUser((prev) => prev ? { ...prev, ...updates } : null);
  }, []);

  useEffect(() => {
    fetchUser();

    // Safety timeout - force loading to false after 5s
    const safetyTimeout = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          console.warn("[useCurrentUser] Safety timeout: forcing loading to false after 5s");
          return false;
        }
        return prev;
      });
    }, 5000);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        fetchUser();
      } else if (event === "SIGNED_OUT") {
        setCurrentUser(null);
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [fetchUser]);

  return (
    <CurrentUserContext.Provider value={{ currentUser, loading, refetchUser, updateUser }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  const context = useContext(CurrentUserContext);
  if (context === undefined) {
    throw new Error("useCurrentUser must be used within a CurrentUserProvider");
  }
  return context;
}
