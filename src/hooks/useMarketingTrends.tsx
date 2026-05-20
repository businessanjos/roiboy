import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";

export interface MarketingTrend {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  source: string;
  source_url: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  creator_handle: string | null;
  creator_followers: number | null;
  views_count: number | null;
  likes_count: number | null;
  comments_count: number | null;
  audio_title: string | null;
  platform: string | null;
  hype_score: number | null;
  tags: string[];
  ai_adaptation: string | null;
  ai_analysis: any;
  captured_at: string;
  expires_at: string | null;
  is_archived: boolean;
}

export function useMarketingTrends() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;

  const { data: trends = [], isLoading } = useQuery({
    queryKey: ["marketing-trends", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("marketing_trends")
        .select("*")
        .eq("account_id", accountId)
        .eq("is_archived", false)
        .order("captured_at", { ascending: false })
        .order("hype_score", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return data as MarketingTrend[];
    },
    enabled: !!accountId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const refreshTrends = async () => {
    await queryClient.invalidateQueries({ queryKey: ["marketing-trends"] });
    await queryClient.refetchQueries({ queryKey: ["marketing-trends", accountId], type: "active" });
  };

  const discover = useMutation({
    mutationFn: async (input: { niche?: string; platform?: string; customQuery?: string; extraContext?: string }) => {
      if (!accountId) throw new Error("Sem conta");
      const { data, error } = await supabase.functions.invoke("discover-trends", {
        body: { accountId, ...input },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async (data) => {
      await refreshTrends();
      toast.success(`${data.count} tendências descobertas`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const discoverApify = useMutation({
    mutationFn: async (input: { platform: string; hashtags: string[]; maxItems?: number }) => {
      if (!accountId) throw new Error("Sem conta");
      const { data, error } = await supabase.functions.invoke("discover-trends-apify", {
        body: { accountId, ...input },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async (data) => {
      await refreshTrends();
      toast.success(`${data.count} virais capturados via Apify`);
    },
    onError: (e: any) => toast.error(e.message),
  });


  const archiveTrend = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_trends").update({ is_archived: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketing-trends", accountId] }),
  });

  const deleteTrend = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_trends").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-trends", accountId] });
      toast.success("Removido");
    },
  });

  return { trends, isLoading, discover, discoverApify, archiveTrend, deleteTrend };
}
