import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";

export interface PerformanceInsight {
  id: string;
  platform: string;
  insight_type: string;
  title: string;
  description: string;
  score: number;
  data: any;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

export function useMarketingPerformance() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;

  const { data: insights = [], isLoading } = useQuery({
    queryKey: ["marketing-performance-insights", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("marketing_performance_insights")
        .select("*")
        .eq("account_id", accountId)
        .order("score", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as PerformanceInsight[];
    },
    enabled: !!accountId,
  });

  const analyze = useMutation({
    mutationFn: async () => {
      if (!accountId) throw new Error("Sem conta");
      const { data, error } = await supabase.functions.invoke("analyze-post-performance", {
        body: { accountId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["marketing-performance-insights", accountId] });
      toast.success(`${data.count} insights gerados`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { insights, isLoading, analyze };
}
