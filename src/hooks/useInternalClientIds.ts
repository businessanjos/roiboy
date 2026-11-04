import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchInternalClientIds } from "@/lib/internalClients";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// Array estável: sem isso, cada re-render criaria um novo vazio e as telas
// que dependem dele repetiriam a consulta sem parar.
const NO_IDS: string[] = [];

/**
 * Cadastros de cliente que são a própria equipe (telefone interno). Cache de
 * 5 minutos compartilhado entre as telas que listam ou contam clientes.
 */
export function useInternalClientIds() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["internal-client-ids", accountId],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: () => fetchInternalClientIds(supabase, accountId),
  });

  return { internalClientIds: data ?? NO_IDS, isLoading };
}
