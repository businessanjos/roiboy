import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";

export type CopyType = "hook" | "caption" | "script" | "cta" | "title" | "bio" | "email" | "other";
export type CopyObjective = "educar" | "converter" | "reter";

export interface CopyHistoryItem {
  id: string;
  copy_type: CopyType;
  prompt: string;
  output: string;
  context: any;
  is_favorite: boolean;
  created_at: string;
  idea_id: string | null;
}

export function useMarketingCopy() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["marketing-copy-history", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("marketing_copy_history")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as CopyHistoryItem[];
    },
    enabled: !!accountId,
  });

  const generateCopy = useMutation({
    mutationFn: async (input: {
      copyType: CopyType;
      brief: string;
      objective?: CopyObjective;
      ideaId?: string;
      format?: string;
      platform?: string;
      hook?: string;
      useBrandVoice?: boolean;
      profileId?: string;
      profilePlatform?: string;
      profileUsername?: string;
      profileDisplayName?: string;
    }) => {
      if (!accountId) throw new Error("Sem conta");
      const { data, error } = await supabase.functions.invoke("generate-marketing-copy", {
        body: { accountId, ...input },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { output: string; record: CopyHistoryItem };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-copy-history", accountId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ id, is_favorite }: { id: string; is_favorite: boolean }) => {
      const { error } = await supabase.from("marketing_copy_history").update({ is_favorite }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketing-copy-history", accountId] }),
  });

  const deleteCopy = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_copy_history").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-copy-history", accountId] });
      toast.success("Removido");
    },
  });

  return { history, isLoading, generateCopy, toggleFavorite, deleteCopy };
}
