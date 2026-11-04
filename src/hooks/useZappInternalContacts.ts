import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildInternalCoreSet } from "@/lib/zappInternalContacts";

/**
 * Números da própria equipe: registro manual (zapp_internal_contacts) e
 * telefones dos colaboradores. A RLS já devolve apenas a conta do usuário,
 * então a consulta não precisa filtrar conta. Falha em uma das tabelas não
 * derruba a outra — o conjunto fica só com o que veio.
 */
export function useZappInternalContacts() {
  const { data, isLoading } = useQuery({
    queryKey: ["zapp-internal-contact-cores"],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<Set<string>> => {
      const [registered, collaborators] = await Promise.all([
        supabase.from("zapp_internal_contacts").select("phone_e164"),
        supabase.from("hr_collaborators").select("phone"),
      ]);
      const phones = [
        ...((registered.data as { phone_e164: string }[] | null) ?? []).map(
          (row) => row.phone_e164,
        ),
        ...((collaborators.data as { phone: string | null }[] | null) ?? []).map(
          (row) => row.phone,
        ),
      ];
      return buildInternalCoreSet(phones);
    },
  });

  return { internalCores: data ?? new Set<string>(), isLoading };
}
