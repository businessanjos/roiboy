import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";

export interface PersonaAbStats {
  total: number;
  decided: number;
  chosenA: number;
  chosenB: number;
  chosenNone: number;
  thumbsUpA: number;
  thumbsDownA: number;
  thumbsUpB: number;
  thumbsDownB: number;
  savedWithoutEditA: number;
  savedWithoutEditB: number;
  // Métricas derivadas
  acceptRateA: number; // chosenA / decided
  acceptRateB: number;
  thumbsUpRateA: number; // upA / (upA + downA)
  thumbsUpRateB: number;
  byField: Record<string, { a: number; b: number; total: number }>;
}

export function usePersonaAbStats(days = 30) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  return useQuery({
    queryKey: ["persona-ab-stats", accountId, days],
    queryFn: async (): Promise<PersonaAbStats> => {
      if (!accountId) {
        return emptyStats();
      }
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("marketing_persona_ab_tests")
        .select("field, chosen_variant, explicit_feedback_a, explicit_feedback_b, saved_without_edit")
        .eq("account_id", accountId)
        .gte("created_at", since);
      if (error) throw error;
      return aggregate(data || []);
    },
    enabled: !!accountId,
    staleTime: 30_000,
  });
}

function emptyStats(): PersonaAbStats {
  return {
    total: 0, decided: 0, chosenA: 0, chosenB: 0, chosenNone: 0,
    thumbsUpA: 0, thumbsDownA: 0, thumbsUpB: 0, thumbsDownB: 0,
    savedWithoutEditA: 0, savedWithoutEditB: 0,
    acceptRateA: 0, acceptRateB: 0, thumbsUpRateA: 0, thumbsUpRateB: 0,
    byField: {},
  };
}

function aggregate(rows: any[]): PersonaAbStats {
  const s = emptyStats();
  s.total = rows.length;
  for (const r of rows) {
    if (r.chosen_variant) {
      s.decided += 1;
      if (r.chosen_variant === "a") s.chosenA += 1;
      else if (r.chosen_variant === "b") s.chosenB += 1;
      else s.chosenNone += 1;
    }
    if (r.explicit_feedback_a === "up") s.thumbsUpA += 1;
    if (r.explicit_feedback_a === "down") s.thumbsDownA += 1;
    if (r.explicit_feedback_b === "up") s.thumbsUpB += 1;
    if (r.explicit_feedback_b === "down") s.thumbsDownB += 1;
    if (r.saved_without_edit === true) {
      if (r.chosen_variant === "a") s.savedWithoutEditA += 1;
      if (r.chosen_variant === "b") s.savedWithoutEditB += 1;
    }
    const f = r.field || "?";
    s.byField[f] = s.byField[f] || { a: 0, b: 0, total: 0 };
    s.byField[f].total += 1;
    if (r.chosen_variant === "a") s.byField[f].a += 1;
    if (r.chosen_variant === "b") s.byField[f].b += 1;
  }
  s.acceptRateA = s.decided ? +(s.chosenA / s.decided * 100).toFixed(1) : 0;
  s.acceptRateB = s.decided ? +(s.chosenB / s.decided * 100).toFixed(1) : 0;
  const totalA = s.thumbsUpA + s.thumbsDownA;
  const totalB = s.thumbsUpB + s.thumbsDownB;
  s.thumbsUpRateA = totalA ? +(s.thumbsUpA / totalA * 100).toFixed(1) : 0;
  s.thumbsUpRateB = totalB ? +(s.thumbsUpB / totalB * 100).toFixed(1) : 0;
  return s;
}
