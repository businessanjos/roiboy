import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";
import type { CopyObjective } from "./useMarketingCopy";

export interface MarketingSuggestionEvidence {
  sourceType: "idea" | "copy" | "hook" | "trend" | "event" | "profile-content";
  sourceLabel: string;
  reason: string;
}

export interface WeeklyCalendarSuggestionItem {
  date: string;
  dayLabel: string;
  channel: "post" | "email";
  title: string;
  format: string;
  platform: string;
  objective: CopyObjective;
  hook: string;
  cta: string;
  rationale: string;
  evidence: MarketingSuggestionEvidence[];
}

export interface WeeklyCalendarSuggestionResponse {
  summary: string;
  weeklyFocus: string;
  schedule: WeeklyCalendarSuggestionItem[];
}

interface SuggestWeeklyCalendarInput {
  profileId: string;
  platform: "instagram" | "tiktok" | "youtube";
  username: string;
  displayName?: string | null;
}

export function useMarketingWeeklyCalendar(profileId?: string) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const queryClient = useQueryClient();
  const weeklyCalendarKey = ["marketing-weekly-calendar", accountId, profileId ?? "all"];

  const weeklyCalendar = useQuery<WeeklyCalendarSuggestionResponse | null>({
    queryKey: weeklyCalendarKey,
    queryFn: async () => {
      return (queryClient.getQueryData(weeklyCalendarKey) as WeeklyCalendarSuggestionResponse | undefined) ?? null;
    },
    enabled: false,
    initialData: () => {
      return (queryClient.getQueryData(weeklyCalendarKey) as WeeklyCalendarSuggestionResponse | undefined) ?? null;
    },
  });

  const suggestWeeklyCalendar = useMutation({
    mutationFn: async (input: SuggestWeeklyCalendarInput) => {
      if (!accountId) throw new Error("Sem conta");

      const { data, error } = await supabase.functions.invoke("suggest-weekly-marketing-calendar", {
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

      return data as WeeklyCalendarSuggestionResponse;
    },
    onSuccess: (data, input) => {
      queryClient.setQueryData(["marketing-weekly-calendar", accountId, input.profileId], data);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao sugerir calendário semanal"),
  });

  return { suggestWeeklyCalendar, weeklyCalendar };
}