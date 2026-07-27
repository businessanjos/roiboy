import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { format, startOfMonth, subMonths } from "date-fns";

export interface AdTrendPoint {
  key: string; // yyyy-MM-dd ou yyyy-MM
  label: string;
  spend: number;
  leads: number;
  cpl: number;
  clicks: number;
  impressions: number;
}

export interface AdSpendTrend {
  daily: AdTrendPoint[];
  monthly: AdTrendPoint[];
  hasData: boolean;
}

export interface AdSpendTrendRange {
  startDate: Date;
  endDate: Date;
}

const emptyBucket = () => ({ spend: 0, leads: 0, clicks: 0, impressions: 0 });

export function useAdSpendTrend(range?: AdSpendTrendRange) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const userId = currentUser?.id;

  const now = new Date();
  const rStart = range?.startDate ?? startOfMonth(now);
  const rEnd = range?.endDate ?? now;
  // Série mensal sempre olha 12 meses para trás (decisão de verba de longo prazo)
  const monthlyStart = startOfMonth(subMonths(now, 11));

  return useQuery({
    queryKey: [
      "marketing-ad-spend-trend",
      accountId,
      userId,
      format(rStart, "yyyy-MM-dd"),
      format(rEnd, "yyyy-MM-dd"),
    ],
    enabled: !!accountId,
    staleTime: 60_000,
    queryFn: async (): Promise<AdSpendTrend> => {
      const orFilter = [
        `account_id.eq.${accountId}`,
        userId ? `user_id.eq.${userId}` : null,
      ]
        .filter(Boolean)
        .join(",");

      const fromDate = monthlyStart < rStart ? monthlyStart : rStart;

      const { data: rows = [] } = await (supabase as any)
        .from("marketing_ad_daily_stats")
        .select("stat_date, spend, conversions, clicks, impressions, account_id, user_id")
        .or(orFilter)
        .gte("stat_date", format(fromDate, "yyyy-MM-dd"))
        .lte("stat_date", format(rEnd, "yyyy-MM-dd"))
        .order("stat_date", { ascending: true });

      const dailyMap = new Map<string, ReturnType<typeof emptyBucket>>();
      const monthlyMap = new Map<string, ReturnType<typeof emptyBucket>>();

      const rangeStartKey = format(rStart, "yyyy-MM-dd");
      const rangeEndKey = format(rEnd, "yyyy-MM-dd");

      for (const r of rows as any[]) {
        const day: string = r.stat_date;
        const month = day.slice(0, 7);
        const spend = Number(r.spend) || 0;
        const leads = Number(r.conversions) || 0;
        const clicks = Number(r.clicks) || 0;
        const impressions = Number(r.impressions) || 0;

        if (day >= rangeStartKey && day <= rangeEndKey) {
          const d = dailyMap.get(day) || emptyBucket();
          d.spend += spend;
          d.leads += leads;
          d.clicks += clicks;
          d.impressions += impressions;
          dailyMap.set(day, d);
        }

        const m = monthlyMap.get(month) || emptyBucket();
        m.spend += spend;
        m.leads += leads;
        m.clicks += clicks;
        m.impressions += impressions;
        monthlyMap.set(month, m);
      }

      const toPoint = (key: string, label: string, b: ReturnType<typeof emptyBucket>): AdTrendPoint => ({
        key,
        label,
        spend: +b.spend.toFixed(2),
        leads: b.leads,
        clicks: b.clicks,
        impressions: b.impressions,
        cpl: b.leads > 0 ? +(b.spend / b.leads).toFixed(2) : 0,
      });

      const daily = Array.from(dailyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, b]) => toPoint(key, format(new Date(`${key}T12:00:00`), "dd/MM"), b));

      // 12 meses completos, preenchendo lacunas com zero
      const monthly: AdTrendPoint[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = subMonths(now, i);
        const key = format(d, "yyyy-MM");
        monthly.push(toPoint(key, format(d, "MMM/yy"), monthlyMap.get(key) || emptyBucket()));
      }

      return {
        daily,
        monthly,
        hasData: (rows as any[]).length > 0,
      };
    },
  });
}
