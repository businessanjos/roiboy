import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";

export interface BrandVoice {
  id: string;
  account_id: string;
  personality: string | null;
  tone_keywords: string[];
  forbidden_words: string[];
  signature_phrases: string[];
  example_posts: string[];
  emoji_style: string | null;
  hashtag_strategy: string | null;
  values_and_mission: string | null;
  target_audience: string | null;
  niche: string | null;
  ai_summary: string | null;
  learned_from_instagram_at: string | null;
  posts_analyzed_count: number;
  updated_at: string;
}

export function useMarketingBrandVoice() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;

  const { data: voice, isLoading } = useQuery({
    queryKey: ["marketing-brand-voice", accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const { data, error } = await supabase
        .from("marketing_brand_voice")
        .select("*")
        .eq("account_id", accountId)
        .maybeSingle();
      if (error) throw error;
      return data as BrandVoice | null;
    },
    enabled: !!accountId,
  });

  const learnFromInstagram = useMutation({
    mutationFn: async (input: { instagramUsername?: string; manualPosts?: string[]; niche?: string; targetAudience?: string }) => {
      if (!accountId) throw new Error("Sem conta");
      const { data, error } = await supabase.functions.invoke("learn-brand-voice", {
        body: { accountId, ...input },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["marketing-brand-voice", accountId] });
      toast.success(`Tom de voz aprendido (${data.postsAnalyzed} posts analisados)`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateVoice = useMutation({
    mutationFn: async (updates: Partial<BrandVoice>) => {
      if (!accountId) throw new Error("Sem conta");
      const { error } = await supabase
        .from("marketing_brand_voice")
        .upsert({ account_id: accountId, ...updates }, { onConflict: "account_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-brand-voice", accountId] });
      toast.success("Tom de voz atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { voice, isLoading, learnFromInstagram, updateVoice };
}
