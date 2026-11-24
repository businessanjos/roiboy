import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { buildCompanyActivityScope, type CompanyScopeDeal } from "@/lib/sales/companyActivityScope";

export function useSalesCompanyScope(companyId: string, enabled = true) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const query = useQuery({
    queryKey: ["sales-company-activity-scope", accountId, currentUser?.id],
    enabled: enabled && !!accountId && companyId !== "all",
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await fetchAllRows<CompanyScopeDeal>((from, to) => supabase.from("deals")
        .select("id, company_id, client_id, lead_id").eq("account_id", accountId).is("deleted_at", null).order("id").range(from, to));
      if (error) throw error;
      return data;
    },
    staleTime: 30000,
  });
  const scope = useMemo(() => buildCompanyActivityScope(query.data || []), [query.data]);
  return { ...query, scope };
}