import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ConsultantGoal } from "./useConsultantGoals";

/**
 * Computes the real-world metric value (renewal_rate, churn_rate or nps)
 * for a given consultant + product + month, aggregating data from
 * renewal_outcomes, client_contracts and vnps_snapshots — all linked to
 * the consultant via clients.responsible_user_id.
 */
async function fetchMetric(
  user_id: string,
  product_id: string,
  year: number,
  month: number,
  metric: string
): Promise<number> {
  const { data, error } = await supabase.rpc("compute_consultant_metric", {
    p_user_id: user_id,
    p_product_id: product_id,
    p_year: year,
    p_month: month,
    p_metric: metric,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/**
 * Fetches the 12 monthly real values for every goal of a consultant.
 * Returns a map keyed by `${goal_id}:${month}`.
 */
export function useComputedMetrics(goals: ConsultantGoal[], year: number) {
  const goalKeys = goals.map((g) => `${g.id}:${g.product_id}:${g.metric_type}`).join("|");
  return useQuery({
    queryKey: ["computed-consultant-metrics", year, goalKeys],
    enabled: goals.length > 0,
    queryFn: async () => {
      const result: Record<string, number> = {};
      const tasks: Promise<void>[] = [];
      for (const g of goals) {
        for (let month = 1; month <= 12; month++) {
          tasks.push(
            fetchMetric(g.user_id, g.product_id, year, month, g.metric_type).then(
              (v) => {
                result[`${g.id}:${month}`] = v;
              }
            )
          );
        }
      }
      await Promise.all(tasks);
      return result;
    },
    staleTime: 60_000,
  });
}
