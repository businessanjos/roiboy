import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

/** Formações extras cadastradas pela conta (fora da lista padrão do código). */
export function useEducationOptions() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const queryClient = useQueryClient();

  const { data: options = [], isLoading } = useQuery({
    queryKey: ["education-options", accountId],
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("education_options")
        .select("id, name")
        .eq("account_id", accountId!)
        .order("name");
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
  });

  const addOption = async (name: string): Promise<string | null> => {
    const clean = name.trim();
    if (!clean || !accountId) return null;
    const { data, error } = await supabase
      .from("education_options")
      .insert({ account_id: accountId, name: clean, created_by: currentUser?.auth_user_id ?? null })
      .select("id, name")
      .single();
    if (error) {
      // Já existe (duplicado em paralelo): busca o registro existente.
      if ((error as { code?: string }).code === "23505") {
        const { data: existing } = await supabase
          .from("education_options")
          .select("id, name")
          .eq("account_id", accountId)
          .ilike("name", clean)
          .maybeSingle();
        return existing?.name ?? clean;
      }
      throw error;
    }
    queryClient.invalidateQueries({ queryKey: ["education-options", accountId] });
    return data?.name ?? clean;
  };

  return { options, isLoading, addOption };
}
