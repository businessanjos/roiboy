import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { EditableKpiPack } from "@/constants/kpiSuggestions";

export type OfferContentSettings = {
  kpi_packs: EditableKpiPack[] | null;
  company_intro: string | null;
  next_steps: string | null;
  signer_name: string | null;
  signer_role: string | null;
};

const EMPTY: OfferContentSettings = { kpi_packs: null, company_intro: null, next_steps: null, signer_name: null, signer_role: null };

/** Padrões da carta-proposta por conta. Campos nulos = padrão original do sistema. */
export function useOfferContentSettings() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const qc = useQueryClient();
  const key = ["offer-content-settings", accountId];

  const query = useQuery({
    queryKey: key,
    enabled: !!accountId,
    queryFn: async (): Promise<OfferContentSettings> => {
      const { data, error } = await (supabase as any)
        .from("hr_offer_content_settings")
        .select("kpi_packs, company_intro, next_steps, signer_name, signer_role")
        .eq("account_id", accountId)
        .maybeSingle();
      if (error) throw error;
      return (data as OfferContentSettings) ?? EMPTY;
    },
  });

  const save = async (patch: Partial<OfferContentSettings>) => {
    if (!accountId) return;
    const next = { ...(query.data ?? EMPTY), ...patch };
    const { error } = await (supabase as any).from("hr_offer_content_settings").upsert({
      account_id: accountId,
      ...next,
      updated_by: currentUser?.id ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    qc.setQueryData(key, next);
  };

  return { settings: query.data ?? EMPTY, isLoading: query.isLoading, save };
}
