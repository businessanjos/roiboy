import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchInternalClientSplit } from "@/lib/internalClients";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// Array estável: sem isso, cada re-render criaria um novo vazio e as telas
// que dependem dele repetiriam a consulta sem parar.
const NO_IDS: string[] = [];
const NO_SPLIT = { all: NO_IDS, hidden: NO_IDS };

/**
 * Cadastros de cliente que são a própria equipe (telefone interno). Cache de
 * 5 minutos compartilhado entre as telas que listam ou contam clientes.
 *
 * - `internalClientIds`  : nenhum deles é cliente (contagens e métricas).
 * - `hiddenClientIds`    : esses somem da lista de clientes.
 * - `internalMarkedIds`  : continuam na lista, mas marcados "Interno".
 */
export function useInternalClientIds() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["internal-client-ids", accountId],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: () => fetchInternalClientSplit(supabase, accountId),
  });

  const split = data ?? NO_SPLIT;
  const hidden = new Set(split.hidden);

  return {
    internalClientIds: split.all.length ? split.all : NO_IDS,
    hiddenClientIds: split.hidden.length ? split.hidden : NO_IDS,
    internalMarkedIds: split.all.length
      ? split.all.filter((id) => !hidden.has(id))
      : NO_IDS,
    isLoading,
  };
}
