import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { BEHAVIOR_PROFILE_DEFAULTS, type BehaviorProfile } from "@/lib/rh/pdaContent";

export type BehaviorProfileRow = BehaviorProfile & { id?: string; sort_order?: number };

/** Perfis comportamentais da conta, com fallback para o conteúdo padrão. */
export function useHRBehaviorProfiles() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const [profiles, setProfiles] = useState<BehaviorProfileRow[]>(BEHAVIOR_PROFILE_DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("hr_behavior_profiles")
      .select("id, profile_key, leadership_style, motivation, communication, strengths, improvements, sort_order")
      .order("sort_order");
    if (data && data.length > 0) {
      setProfiles(
        data.map((r: any) => ({
          id: r.id,
          profile_key: r.profile_key,
          leadership_style: r.leadership_style || "",
          motivation: r.motivation || "",
          communication: r.communication || [],
          strengths: r.strengths || "",
          improvements: r.improvements || "",
          sort_order: r.sort_order,
        })),
      );
    } else {
      setProfiles(BEHAVIOR_PROFILE_DEFAULTS);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const byKey = useCallback(
    (key?: string | null) => profiles.find((p) => p.profile_key === (key || "")) || null,
    [profiles],
  );

  const save = useCallback(
    async (profile: BehaviorProfileRow) => {
      if (!accountId) return false;
      const payload = {
        account_id: accountId,
        profile_key: profile.profile_key,
        leadership_style: profile.leadership_style || null,
        motivation: profile.motivation || null,
        communication: profile.communication,
        strengths: profile.strengths || null,
        improvements: profile.improvements || null,
        sort_order: profile.sort_order ?? 0,
      };
      const { error } = await supabase
        .from("hr_behavior_profiles")
        .upsert(payload, { onConflict: "account_id,profile_key" });
      if (error) {
        toast.error("Não foi possível salvar o perfil");
        return false;
      }
      toast.success("Perfil salvo");
      await fetchProfiles();
      return true;
    },
    [accountId, fetchProfiles],
  );

  return { profiles, byKey, loading, save, refetch: fetchProfiles };
}
