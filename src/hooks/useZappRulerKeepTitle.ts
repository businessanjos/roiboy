import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

/** Configuração da conta: régua de relacionamento mantém Dr./Dra. no {primeiro_nome}. Padrão ligado. */
export function useZappRulerKeepTitle() {
  const { currentUser } = useCurrentUser() as any;
  const accountId: string | undefined = currentUser?.account_id;
  const canEdit =
    currentUser?.role === "admin" || currentUser?.role === "super_admin" || currentUser?.is_also_admin === true;
  const qc = useQueryClient();
  const key = ["zapp-account-settings", accountId];

  const { data } = useQuery({
    queryKey: key,
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zapp_account_settings")
        .select("ruler_keep_title")
        .eq("account_id", accountId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.from("zapp_account_settings").upsert({
        account_id: accountId!,
        ruler_keep_title: enabled,
        updated_by: currentUser?.auth_user_id ?? null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: () => toast.error("Não foi possível salvar. Só administradores podem alterar."),
  });

  return {
    enabled: data?.ruler_keep_title !== false,
    canEdit,
    saving: mutation.isPending,
    setEnabled: (v: boolean) => mutation.mutate(v),
  };
}
