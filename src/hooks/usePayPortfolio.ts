import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { PayPortfolio } from "@/lib/sales/payPortfolio";
import { readPortfolioCache, writePortfolioCache } from "@/lib/sales/payPortfolioCache";

/** Gestão, ou quem recebeu o item "Assinaturas" no Perfil de Permissão: a mesma regra que o servidor confere antes de ler a carteira. */
export function useCanSeePayPortfolio() {
  const { currentUser } = useCurrentUser();
  return useQuery({
    queryKey: ["can-see-pay-portfolio", currentUser?.id],
    enabled: Boolean(currentUser),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("can_view_pay_portfolio");
      return data === true;
    },
  });
}

const REFRESH_MS = 15 * 60 * 1000;

const generatedMs = (data: PayPortfolio | null | undefined) => {
  const at = data ? Date.parse(data.generatedAt) : NaN;
  return Number.isFinite(at) ? at : 0;
};

/**
 * Carteira do Clínica Ryka lida no RykaPay. A leitura é pesada, então a tela nunca espera por ela:
 * abre com a última leitura guardada (no navegador e no servidor, compartilhada por quem tem o mesmo alcance)
 * e só relê o RykaPay por trás quando essa leitura tem mais de 15 min, ou no botão Atualizar.
 */
export function usePayPortfolio(active: boolean, autoRefresh: boolean) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const userId = currentUser?.id as string | undefined;
  const enabled = Boolean(active && currentUser);
  const liveKey = ["pay-portfolio", currentUser?.account_id, userId];

  // Última leitura guardada no servidor: rápida, e a RLS só entrega a do alcance de quem pede.
  const stored = useQuery({
    queryKey: ["pay-portfolio-stored", currentUser?.account_id, userId],
    enabled,
    staleTime: 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pay_portfolio_snapshots")
        .select("data")
        .maybeSingle();
      const snapshot = (data?.data ?? null) as PayPortfolio | null;
      if (snapshot && Array.isArray(snapshot.clinics)) {
        const current = qc.getQueryData<PayPortfolio>(liveKey);
        if (generatedMs(snapshot) > generatedMs(current)) {
          qc.setQueryData(liveKey, snapshot, { updatedAt: generatedMs(snapshot) });
          writePortfolioCache(userId, snapshot);
        }
        return snapshot;
      }
      return null;
    },
  });
  const storedSettled = stored.isFetched || stored.isError;

  const live = useQuery<PayPortfolio>({
    queryKey: liveKey,
    initialData: () => readPortfolioCache(userId)?.data,
    initialDataUpdatedAt: () => readPortfolioCache(userId)?.at,
    // Só consulta o RykaPay depois de saber o que já está guardado.
    enabled: enabled && storedSettled,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.functions.invoke("rykapay-portfolio", { body: {}, signal });
      if (error) {
        let message = "Não foi possível consultar o RykaPay. Tente novamente.";
        if (error instanceof FunctionsHttpError) {
          const details = await error.context.json().catch(() => null);
          if (typeof details?.error === "string") message = details.error;
        }
        throw new Error(message);
      }
      if (!data || !Array.isArray(data.clinics)) throw new Error("Painel de assinaturas indisponível.");
      writePortfolioCache(userId, data as PayPortfolio);
      return data as PayPortfolio;
    },
    staleTime: REFRESH_MS,
    gcTime: 60 * 60 * 1000,
    refetchInterval: autoRefresh ? REFRESH_MS : false,
    refetchIntervalInBackground: autoRefresh,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return {
    data: live.data,
    /** Ainda sem nada para mostrar: só acontece na primeira leitura de todas. */
    isLoading: enabled && !live.data && !live.isError && (!storedSettled || live.isFetching || live.isPending),
    /** Lendo o RykaPay (por trás, quando já há dados na tela). */
    isFetching: live.isFetching,
    isError: live.isError,
    error: live.error,
    refetch: () => live.refetch(),
  };
}
