import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ImpersonatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  account_id: string;
  account_name: string;
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonatedUser: ImpersonatedUser | null;
  startImpersonation: (userId: string) => Promise<void>;
  stopImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);

  const startImpersonation = useCallback(async (userId: string) => {
    try {
      // Fetch the user we want to impersonate
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, name, email, role, avatar_url, account_id")
        .eq("id", userId)
        .single();

      if (userError || !userData) {
        throw new Error("Usuário não encontrado");
      }

      // Fetch the account name
      const { data: accountData } = await supabase
        .from("accounts")
        .select("name")
        .eq("id", userData.account_id)
        .single();

      setImpersonatedUser({
        ...userData,
        account_name: accountData?.name || "Conta desconhecida",
      });
    } catch (error) {
      console.error("Error starting impersonation:", error);
      throw error;
    }
  }, []);

  const stopImpersonation = useCallback(() => {
    setImpersonatedUser(null);
  }, []);

  return (
    <ImpersonationContext.Provider
      value={{
        isImpersonating: !!impersonatedUser,
        impersonatedUser,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    throw new Error("useImpersonation must be used within an ImpersonationProvider");
  }
  return context;
}
