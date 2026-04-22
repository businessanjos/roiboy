import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";

export interface HighlightItem {
  label: string;
  count?: number;
  avg_engagement?: number;
}

export interface InstagramHighlightsCacheRow {
  id: string;
  account_id: string;
  profile_id: string;
  username: string | null;
  formats: HighlightItem[];
  themes: HighlightItem[];
  hashtags: HighlightItem[];
  posts_analyzed: number;
  computed_at: string;
  source: string;
}

export function useInstagramHighlightsCache(profileId?: string | null) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;

  const { data, isLoading } = useQuery({
    queryKey: ["instagram-highlights-cache", accountId, profileId ?? "default"],
    queryFn: async () => {
      if (!accountId) return null;
      let q = supabase
        .from("instagram_highlights_cache" as any)
        .select("*")
        .eq("account_id", accountId);
      if (profileId) q = q.eq("profile_id", profileId);
      const { data, error } = await q
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as InstagramHighlightsCacheRow) || null;
    },
    enabled: !!accountId,
    staleTime: 60_000,
  });

  const refreshNow = useMutation({
    mutationFn: async () => {
      if (!accountId) throw new Error("Sem conta");
      const { data, error } = await supabase.functions.invoke("refresh-instagram-highlights", {
        body: { accountId, profileId: profileId || undefined, source: "manual" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Destaques atualizados");
      queryClient.invalidateQueries({ queryKey: ["instagram-highlights-cache", accountId] });
    },
    onError: (e: any) => toast.error(e.message || "Falha ao atualizar destaques"),
  });

  return { highlights: data, isLoading, refreshNow };
}
