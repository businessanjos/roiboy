import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export interface Company {
  id: string;
  legal_name: string;
  trade_name: string | null;
  document: string;
  is_default: boolean;
  is_active: boolean;
}

interface CompanyContextValue {
  companies: Company[];
  currentCompanyId: string | null;
  currentCompany: Company | null;
  setCurrentCompanyId: (id: string | null) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const STORAGE_KEY = "roy:current_company_id";

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompanyId, setCurrentCompanyIdState] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null)
  );
  const [loading, setLoading] = useState(false);

  const setCurrentCompanyId = useCallback((id: string | null) => {
    setCurrentCompanyIdState(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("id, legal_name, trade_name, document, is_default, is_active")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("legal_name", { ascending: true });
    setLoading(false);
    if (error) {
      console.error("Error loading companies:", error);
      return;
    }
    const list = (data || []) as Company[];
    setCompanies(list);

    // Pick default if nothing selected or selected disappeared
    setCurrentCompanyIdState((prev) => {
      if (prev && list.some((c) => c.id === prev)) return prev;
      const def = list.find((c) => c.is_default) || list[0];
      const next = def?.id ?? null;
      if (typeof window !== "undefined") {
        if (next) localStorage.setItem(STORAGE_KEY, next);
        else localStorage.removeItem(STORAGE_KEY);
      }
      return next;
    });
  }, [accountId]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const currentCompany = companies.find((c) => c.id === currentCompanyId) ?? null;

  return (
    <CompanyContext.Provider
      value={{
        companies,
        currentCompanyId,
        currentCompany,
        setCurrentCompanyId,
        loading,
        refresh: fetchCompanies,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}
