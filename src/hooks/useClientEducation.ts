import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { buildEducationOptions, type EducationOption } from "@/lib/dashboard/clientEducation";

interface ClientEducationRow {
  id: string;
  education: string | null;
}

/**
 * Formação informada em cada cliente da conta.
 * Carrega a lista completa (paginada) para que o filtro do dashboard alcance
 * todos os caminhos de dados, não apenas os clientes já listados na tela.
 */
export function useClientEducation() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const query = useQuery({
    queryKey: ["dashboard-client-education", accountId],
    enabled: !!accountId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    queryFn: async () => {
      const { data, error } = await fetchAllRows<ClientEducationRow>((from, to) =>
        supabase
          .from("clients")
          .select("id, education")
          .eq("account_id", accountId!)
          .order("id", { ascending: true })
          .range(from, to),
      );
      if (error) throw error;
      const { data: contracts, error: cErr } = await fetchAllRows<{ client_id: string }>((from, to) =>
        supabase
          .from("client_contracts")
          .select("client_id")
          .eq("account_id", accountId!)
          .eq("status", "active")
          .order("id", { ascending: true })
          .range(from, to),
      );
      if (cErr) throw cErr;
      return { rows: data, activeIds: new Set(contracts.map((c) => c.client_id)) };
    },
  });

  const rows = query.data?.rows ?? [];
  const activeIds = query.data?.activeIds;

  const educationById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const row of rows) map.set(row.id, row.education ?? null);
    return map;
  }, [rows]);

  // Contagem igual à tela "Área da saúde na Mentoria": só clientes com contrato ativo.
  const options: EducationOption[] = useMemo(
    () =>
      buildEducationOptions(
        rows.filter((row) => activeIds?.has(row.id)).map((row) => row.education),
      ),
    [rows, activeIds],
  );

  return {
    educationById,
    options,
    isLoading: query.isLoading,
    totalClients: rows.length,
  };
}
