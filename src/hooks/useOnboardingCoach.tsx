import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CoachInsight {
  priority: "urgent" | "high" | "medium" | "low";
  next_action: string;
  why: string;
  risks: string[];
  suggested_message: string;
  confidence: number;
  cached?: boolean;
}

type Mode = "next_step" | "risk_analysis" | "welcome_message" | "summary";

export function useOnboardingCoach() {
  const [insight, setInsight] = useState<CoachInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async (clientId: string, mode: Mode = "next_step", forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("onboarding-ai-coach", {
        body: { clientId, mode, forceRefresh },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      setInsight(data as CoachInsight);
      return data as CoachInsight;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao consultar IA";
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setInsight(null);
    setError(null);
  };

  return { insight, loading, error, ask, reset, setInsight };
}
