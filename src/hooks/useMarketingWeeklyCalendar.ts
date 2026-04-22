import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";
import type { CopyObjective } from "./useMarketingCopy";

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

export function useMarketingWeeklyCalendar() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

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
    onError: (e: any) => toast.error(e.message || "Erro ao sugerir calendário semanal"),
  });

  return { suggestWeeklyCalendar };
}