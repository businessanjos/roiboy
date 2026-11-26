import { useQuery } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import type { PayResult } from "@/lib/rykaPay";

export function useRykaPaySubscriptions(target: { dealId?: string; clientId?: string }, active = true) {
  const { currentUser } = useCurrentUser();
  return useQuery<PayResult>({
    queryKey: ["rykapay-subscriptions", currentUser?.account_id, currentUser?.id, target.dealId, target.clientId],
    enabled: Boolean(active && currentUser && (target.dealId || target.clientId)),
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.functions.invoke("rykapay-read", { body: target, signal });
      if (error) {
        let message = "Não foi possível consultar o RykaPay. Tente novamente.";
        if (error instanceof FunctionsHttpError) {
          const details = await error.context.json().catch(() => null);
          if (typeof details?.error === "string") message = details.error;
        }
        throw new Error(message);
      }
      if (!data || !Array.isArray(data.subscriptions)) throw new Error("Resposta de assinaturas indisponível.");
      return data as PayResult;
    },
    staleTime: 10000,
    gcTime: 0,
    refetchInterval: query => query.state.data?.state === "needs_document" || query.state.data?.state === "needs_product" ? false : 30000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
    retry: false,
  });
}