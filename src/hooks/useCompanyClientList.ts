import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { loadCompanyClients, type ClientListResult, type CompanyProduct } from "@/lib/companyAreaFilters";

export function useCompanyClientList(companyId: string) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  return async (params: URLSearchParams, refresh = false): Promise<ClientListResult<any>> => {
    const accountId = currentUser?.account_id;
    const userId = currentUser?.id;
    if (!accountId || !userId) throw new Error("Usuário não autenticado");
    const readPage = async (pageParams: URLSearchParams): Promise<ClientListResult<any>> => {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-clients?${pageParams}`, {
        headers: { "Content-Type": "application/json", "x-account-id": accountId, "x-session-token": userId },
      });
      if (!response.ok) throw new Error("Erro ao carregar clientes");
      return response.json();
    };
    if (companyId === "all") return readPage(params);
    const base = new URLSearchParams(params);
    base.delete("limit");
    base.delete("offset");
    if (!base.has("sort")) base.set("sort", "recent");
    base.sort();
    const queryKey = ["company-client-list", accountId, userId, companyId, base.toString()];
    if (refresh) await queryClient.invalidateQueries({ queryKey, exact: true, refetchType: "none" });
    const complete = await queryClient.fetchQuery({
      queryKey,
      staleTime: 30000,
      queryFn: async () => {
        const { data: products, error } = await fetchAllRows<CompanyProduct>((from, to) => supabase.from("products")
          .select("id, company_id").eq("account_id", accountId).order("id").range(from, to));
        if (error) throw error;
        return loadCompanyClients(async (offset, limit) => {
          const p = new URLSearchParams(base);
          p.set("offset", String(offset));
          p.set("limit", String(limit));
          return readPage(p);
        }, products, companyId);
      },
    });
    const offset = Math.max(0, Number(params.get("offset") || 0));
    const limit = Math.max(1, Number(params.get("limit") || 20));
    return { ...complete, clients: complete.clients.slice(offset, offset + limit) };
  };
}