import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";

/**
 * Personal stats for the logged Closer used on the Plano de Incentivo page:
 * - record: maximum number of won deals achieved in a single calendar month
 * - recordMonthLabel: which month set the record (e.g. "Mai/2025")
 * - piggyValue: sum of SPIFF prizes won by the user in the given month
 */
export function useCloserPersonalStats(year: number, month0: number) {
  const { currentUser } = useCurrentUser();
  const userId = currentUser?.id;

  const recordQuery = useQuery({
    queryKey: ["closer-record", userId],
    queryFn: async () => {
      if (!userId) return { count: 0, monthLabel: null as string | null };
      const { data, error } = await supabase
        .from("deals")
        .select("won_at")
        .eq("status", "won")
        .eq("responsible_user_id", userId)
        .not("won_at", "is", null);
      if (error) throw error;

      const buckets = new Map<string, number>();
      (data || []).forEach((d: any) => {
        if (!d.won_at) return;
        const dt = new Date(d.won_at);
        const key = `${dt.getFullYear()}-${dt.getMonth()}`;
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      });
      let bestKey = "";
      let bestCount = 0;
      buckets.forEach((c, k) => {
        if (c > bestCount) {
          bestCount = c;
          bestKey = k;
        }
      });
      let monthLabel: string | null = null;
      if (bestKey) {
        const [y, m] = bestKey.split("-").map(Number);
        monthLabel = new Date(y, m, 1).toLocaleDateString("pt-BR", {
          month: "short",
          year: "numeric",
        });
      }
      return { count: bestCount, monthLabel };
    },
    enabled: !!userId,
  });

  const piggyQuery = useQuery({
    queryKey: ["closer-piggy", userId, year, month0],
    queryFn: async () => {
      if (!userId) return 0;
      const start = new Date(year, month0, 1).toISOString();
      const end = new Date(year, month0 + 1, 0, 23, 59, 59).toISOString();
      const { data, error } = await supabase
        .from("spiff_spins")
        .select("prize_amount")
        .eq("user_id", userId)
        .gte("spun_at", start)
        .lte("spun_at", end);
      if (error) throw error;
      return (data || []).reduce((sum: number, r: any) => sum + Number(r.prize_amount || 0), 0);
    },
    enabled: !!userId,
  });

  return {
    record: recordQuery.data?.count ?? 0,
    recordMonthLabel: recordQuery.data?.monthLabel ?? null,
    piggyValue: piggyQuery.data ?? 0,
    loading: recordQuery.isLoading || piggyQuery.isLoading,
  };
}
