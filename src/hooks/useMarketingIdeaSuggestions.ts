import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";
import type { IdeaFormat, IdeaPlatform } from "./useMarketingIdeas";

export interface MarketingIdeaSuggestion {
  title: string;
  hook: string;
  format: IdeaFormat;
  platform: IdeaPlatform;
  priorityScore: number;
  priorityLabel: "Alta" | "Média" | "Baixa";
  reason: string;
  reuseFrom: string;
  tags: string[];
}

export interface MarketingIdeaClusterSuggestion {
  name: string;
  rationale: string;
  reuseSignals: string[];
  ideas: MarketingIdeaSuggestion[];
}

export interface MarketingIdeaSuggestionResponse {
  summary: string;
  recommendedFocus: string;
  clusters: MarketingIdeaClusterSuggestion[];
}

interface SuggestIdeasInput {
  profileId: string;
  platform: "instagram" | "tiktok" | "youtube";
  username: string;
  displayName?: string | null;
}

export function useMarketingIdeaSuggestions() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const suggestIdeas = useMutation({
    mutationFn: async (input: SuggestIdeasInput) => {
      if (!accountId) throw new Error("Sem conta");

      const { data, error } = await supabase.functions.invoke("suggest-marketing-ideas", {
        body: {
          accountId,
          profileId: input.profileId,
          platform: input.platform,
          username: input.username,
          displayName: input.displayName,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data as MarketingIdeaSuggestionResponse;
    },
    onError: (e: any) => toast.error(e.message || "Erro ao sugerir ideias com IA"),
  });

  return { suggestIdeas };
}