import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export interface OmieCompany {
  id: string;
  cnpj: string | null;
  legal_name: string | null;
  trade_name: string | null;
  color: string | null;
  is_default: boolean;
  is_enabled: boolean;
  has_credentials: boolean;
}

interface Ctx {
  companies: OmieCompany[];
  selectedId: string | null;
  selected: OmieCompany | null;
  setSelectedId: (id: string | null) => void;
  loading: boolean;
  refresh: () => void;
}

const FinancialCompanyContext = createContext<Ctx | null>(null);

const LS_KEY = "financial.selected_company_id";

export function FinancialCompanyProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const [selectedId, setSelectedIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LS_KEY);
    } catch {
      return null;
    }
  });

  const { data, isLoading, refetch } = useQuery({
    enabled: !!accountId,
    queryKey: ["omie-companies", accountId],
    queryFn: async (): Promise<OmieCompany[]> => {
      const { data, error } = await supabase
        .from("omie_settings")
        .select("id, cnpj, legal_name, trade_name, color, is_default, is_enabled, app_key, app_secret")
        .eq("account_id", accountId!)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        cnpj: r.cnpj,
        legal_name: r.legal_name,
        trade_name: r.trade_name,
        color: r.color,
        is_default: !!r.is_default,
        is_enabled: !!r.is_enabled,
        has_credentials: !!(r.app_key && r.app_secret),
      }));
    },
  });

  const companies = data || [];

  // Auto-select default if nothing chosen, or if chosen one disappears
  useEffect(() => {
    if (companies.length === 0) return;
    const exists = selectedId && companies.find((c) => c.id === selectedId);
    if (!exists) {
      const def = companies.find((c) => c.is_default) || companies[0];
      setSelectedIdState(def.id);
      try {
        localStorage.setItem(LS_KEY, def.id);
      } catch {
        /* noop */
      }
    }
  }, [companies, selectedId]);

  const setSelectedId = (id: string | null) => {
    setSelectedIdState(id);
    try {
      if (id) localStorage.setItem(LS_KEY, id);
      else localStorage.removeItem(LS_KEY);
    } catch {
      /* noop */
    }
  };

  const selected = useMemo(
    () => companies.find((c) => c.id === selectedId) || null,
    [companies, selectedId]
  );

  return (
    <FinancialCompanyContext.Provider
      value={{ companies, selectedId, selected, setSelectedId, loading: isLoading, refresh: refetch }}
    >
      {children}
    </FinancialCompanyContext.Provider>
  );
}

export function useFinancialCompany() {
  const ctx = useContext(FinancialCompanyContext);
  if (!ctx) throw new Error("useFinancialCompany must be used inside FinancialCompanyProvider");
  return ctx;
}

/** Safe variant: returns null when used outside the provider (e.g. global header on non-financial routes). */
export function useFinancialCompanyOptional() {
  return useContext(FinancialCompanyContext);
}
