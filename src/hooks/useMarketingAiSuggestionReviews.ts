import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";

export type MarketingAiDecision = "accepted" | "edited" | "rejected";

export interface MarketingAiSuggestionReviewInput {
  suggestionType: string;
  sourceFunction: string;
  sourceItemKey?: string | null;
  decision: MarketingAiDecision;
  objective?: string | null;
  profilePlatform?: string | null;
  profileId?: string | null;
  profileUsername?: string | null;
  suggestionPayload: Record<string, any>;
  editedPayload?: Record<string, any> | null;
  inputContext?: Record<string, any>;
  decisionNotes?: string | null;
}

export interface MarketingAiSuggestionReview {
  id: string;
  suggestion_type: string;
  source_function: string;
  source_item_key: string | null;
  decision: MarketingAiDecision;
  objective: string | null;
  profile_platform: string | null;
  profile_id: string | null;
  profile_username: string | null;
  suggestion_payload: Record<string, any>;
  edited_payload: Record<string, any> | null;
  input_context: Record<string, any>;
  decision_notes: string | null;
  reviewed_at: string;
}

export function useMarketingAiSuggestionReviews(sourceFunction?: string) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;

  const { data: reviews = [] } = useQuery({
    queryKey: ["marketing-ai-reviews", accountId, sourceFunction],
    queryFn: async () => {
      if (!accountId) return [];
      let query = supabase
        .from("marketing_ai_suggestion_reviews")
        .select("id, suggestion_type, source_function, source_item_key, decision, objective, profile_platform, profile_id, profile_username, suggestion_payload, edited_payload, input_context, decision_notes, reviewed_at")
        .eq("account_id", accountId)
        .order("reviewed_at", { ascending: false })
        .limit(50);

      if (sourceFunction) {
        query = query.eq("source_function", sourceFunction);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MarketingAiSuggestionReview[];
    },
    enabled: !!accountId,
  });

  const recordReview = useMutation({
    mutationFn: async (input: MarketingAiSuggestionReviewInput) => {
      if (!accountId) throw new Error("Sem conta");

      const payload = {
        account_id: accountId,
        suggestion_type: input.suggestionType,
        source_function: input.sourceFunction,
        source_item_key: input.sourceItemKey || null,
        decision: input.decision,
        objective: input.objective || null,
        profile_platform: input.profilePlatform || null,
        profile_id: input.profileId || null,
        profile_username: input.profileUsername || null,
        suggestion_payload: input.suggestionPayload,
        edited_payload: input.editedPayload || null,
        input_context: input.inputContext || {},
        decision_notes: input.decisionNotes || null,
        created_by: currentUser?.auth_user_id || null,
        reviewed_by: currentUser?.auth_user_id || null,
      };

      const { data, error } = await supabase
        .from("marketing_ai_suggestion_reviews")
        .insert(payload)
        .select("id, suggestion_type, source_function, source_item_key, decision, objective, profile_platform, profile_id, profile_username, suggestion_payload, edited_payload, input_context, decision_notes, reviewed_at")
        .single();

      if (error) throw error;
      return data as MarketingAiSuggestionReview;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-ai-reviews", accountId] });
      toast.success("Decisão registrada");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar decisão"),
  });

  return { reviews, recordReview };
}