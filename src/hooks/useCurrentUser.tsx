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
      
      // Then fetch the user profile using auth_user_id
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email, role, avatar_url, account_id, auth_user_id, is_also_admin")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching user profile:", error);
      }
      
      if (data) {
        setCurrentUser(data as CurrentUser);
      } else {
        setCurrentUser(null);
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
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

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        fetchUser();
      } else if (event === "SIGNED_OUT") {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
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
