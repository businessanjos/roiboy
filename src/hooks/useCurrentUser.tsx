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

  const fetchUser = useCallback(async () => {
    try {
      // First get the current auth user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }
      
      // Then fetch the user profile using auth_user_id, including team role
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email, role, avatar_url, account_id, auth_user_id, is_also_admin, zapp_signature, zapp_signature_enabled, team_role_id, team_role:team_roles(name)")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching user profile:", error);
        setCurrentUser(null);
        setLoading(false);
        return;
      }
      
      if (data) {
        // Extract team role name from the joined data (legacy single role)
        let teamRoleName = (data as any).team_role?.name;
        const teamRoleId = (data as any).team_role_id;
        
        // Fetch all roles from junction table
        const { data: userRolesData } = await supabase
          .from("user_team_roles")
          .select("team_role_id, team_role:team_roles(name)")
          .eq("user_id", data.id);
        
        const teamRoleNames = (userRolesData || []).map((ur: any) => ur.team_role?.name).filter(Boolean);
        const teamRoleIds = (userRolesData || []).map((ur: any) => ur.team_role_id);
        
        // Use first role name as primary if available
        if (teamRoleNames.length > 0 && !teamRoleName) {
          teamRoleName = teamRoleNames[0];
        }
        
        // Fallback: if no junction data but team_role_id exists, fetch name separately
        if (!teamRoleName && teamRoleId) {
          try {
            const { data: roleData } = await supabase
              .from("team_roles")
              .select("name")
              .eq("id", teamRoleId)
              .maybeSingle();
            teamRoleName = roleData?.name || undefined;
            if (teamRoleName) teamRoleNames.push(teamRoleName);
          } catch {
            // Non-critical
          }
        }
        
        setCurrentUser({
          ...data,
          team_role_name: teamRoleName,
          team_role_names: teamRoleNames,
          team_role_id: teamRoleId,
          team_role_ids: teamRoleIds,
        } as CurrentUser);
      } else {
        setCurrentUser(null);
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
      setCurrentUser(null);
    } finally {
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
