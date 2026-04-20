import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";

export type HookCategory = "curiosidade" | "promessa" | "polemica" | "historia" | "dado" | "provocacao" | "outro";

export interface MarketingHook {
  id: string;
  account_id: string;
  text: string;
  category: HookCategory | null;
  source: string;
  source_platform: string | null;
  source_post_id: string | null;
  source_url: string | null;
  performance_score: number;
  views: number;
  engagement_rate: number;
  times_used: number;
  is_favorite: boolean;
  created_by_ai: boolean;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export function useMarketingHooks() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;

  const { data: hooks = [], isLoading } = useQuery({
    queryKey: ["marketing-hooks", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("marketing_hooks")
        .select("*")
        .eq("account_id", accountId)
        .order("performance_score", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as MarketingHook[];
    },
    enabled: !!accountId,
  });

  const extractFromPosts = useMutation({
    mutationFn: async (input: { platforms?: string[]; limit?: number } = {}) => {
      if (!accountId) throw new Error("Sem conta");
      const { data, error } = await supabase.functions.invoke("extract-hooks-from-posts", {
        body: { accountId, ...input },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["marketing-hooks", accountId] });
      toast.success(`${data.count} novos hooks extraídos (${data.analyzed || 0} posts analisados)`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createHook = useMutation({
    mutationFn: async (input: Partial<MarketingHook>) => {
      if (!accountId) throw new Error("Sem conta");
      const { error } = await supabase.from("marketing_hooks").insert({
        account_id: accountId,
        text: input.text || "",
        category: input.category,
        source: "manual",
        notes: input.notes,
        tags: input.tags || [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-hooks", accountId] });
      toast.success("Hook salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ id, is_favorite }: { id: string; is_favorite: boolean }) => {
      const { error } = await supabase.from("marketing_hooks").update({ is_favorite }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketing-hooks", accountId] }),
  });

  const deleteHook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_hooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-hooks", accountId] });
      toast.success("Removido");
    },
  });

  const incrementUsage = useMutation({
    mutationFn: async (id: string) => {
      const hook = hooks.find(h => h.id === id);
      if (!hook) return;
      const { error } = await supabase
        .from("marketing_hooks")
        .update({ times_used: (hook.times_used || 0) + 1 })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketing-hooks", accountId] }),
  });

  return { hooks, isLoading, extractFromPosts, createHook, toggleFavorite, deleteHook, incrementUsage };
}
