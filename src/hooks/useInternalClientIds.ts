import { useQuery } from "@tanstack/react-query";
import { fetchInternalClientIds } from "@/lib/internalClients";

// Array estável: sem isso, cada re-render criaria um novo vazio e as telas
// que dependem dele repetiriam a consulta sem parar.
const NO_IDS: string[] = [];

/**
 * Cadastros de cliente que são a própria equipe (telefone interno). Cache de
 * 5 minutos compartilhado entre as telas que listam ou contam clientes.
 */
export function useInternalClientIds() {
  const { data, isLoading } = useQuery({
    queryKey: ["internal-client-ids"],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: () => fetchInternalClientIds(),
  });

  return { internalClientIds: data ?? NO_IDS, isLoading };
}
