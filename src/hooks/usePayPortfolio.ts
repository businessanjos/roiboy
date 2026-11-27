import { useQuery } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { PayPortfolio } from "@/lib/sales/payPortfolio";

/** Gestão comercial/financeira: a mesma regra que o servidor confere antes de ler a carteira. */
export function useCanSeePayPortfolio() {
  const { currentUser } = useCurrentUser();
  return useQuery({
    queryKey: ["can-see-pay-portfolio", currentUser?.id],
    enabled: Boolean(currentUser),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return false;
      const { data } = await (supabase as any).rpc("can_manage_spiff_payments", { _auth_user_id: auth.user.id });
      return data === true;
    },
  });
}

const REFRESH_MS = 15 * 60 * 1000;

/** Carteira inteira do Clínica Ryka lida no RykaPay; a leitura é pesada, então fica guardada e só renova a cada 15 min. */
export function usePayPortfolio(active: boolean, autoRefresh: boolean) {
  const { currentUser } = useCurrentUser();
  return useQuery<PayPortfolio>({
    queryKey: ["pay-portfolio", currentUser?.account_id],
    enabled: Boolean(active && currentUser),
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
      return data as PayPortfolio;
    },
    staleTime: REFRESH_MS,
    gcTime: 60 * 60 * 1000,
    refetchInterval: autoRefresh ? REFRESH_MS : false,
    refetchIntervalInBackground: autoRefresh,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
