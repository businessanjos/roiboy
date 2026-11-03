import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface ClientPracticeAreaRow {
  id: string;
  business_niche: string | null;
}

/**
 * Áreas de atuação informadas em cada cliente da conta (`clients.business_niche`).
 * Carrega a lista completa (paginada) para que o gráfico alcance todos os
 * clientes, não apenas os já listados na tela.
 */
export function useClientPracticeAreas() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const query = useQuery({
    queryKey: ["dashboard-client-practice-areas", accountId],
    enabled: !!accountId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    queryFn: async () => {
      const { data, error } = await fetchAllRows<ClientPracticeAreaRow>((from, to) =>
        supabase
          .from("clients")
          .select("id, business_niche")
          .eq("account_id", accountId!)
          .order("id", { ascending: true })
          .range(from, to),
      );
      if (error) throw error;
      return data;
    },
  });

  const rows = query.data ?? [];

  const nicheById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const row of rows) map.set(row.id, row.business_niche ?? null);
    return map;
  }, [rows]);

  return {
    nicheById,
    isLoading: query.isLoading,
    totalClients: rows.length,
  };
}
