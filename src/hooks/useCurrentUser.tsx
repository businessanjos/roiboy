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
      const { data } = await supabase
        .from("users")
        .select("id, name, email, role, avatar_url, account_id, auth_user_id")
        .maybeSingle();
      
      if (data) {
        setCurrentUser(data as CurrentUser);
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
