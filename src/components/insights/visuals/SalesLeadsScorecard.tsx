import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { FONT_SCALE_MULTIPLIERS } from "../visual-builder/types";
import { Users, Trophy, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface SalesLeadsScorecardProps {
  fontScale?: string;
  valueColor?: string;
}

export function SalesLeadsScorecard({ fontScale = "normal", valueColor }: SalesLeadsScorecardProps) {
  const m = FONT_SCALE_MULTIPLIERS[fontScale as keyof typeof FONT_SCALE_MULTIPLIERS] || 1;
  const { currentUser } = useCurrentUser();
  const { filters } = useInsightsFilters();

  const { data, isLoading } = useQuery({
    queryKey: ["insights", "sales-leads-unified", filters.startDate, filters.endDate, filters.userId, currentUser?.account_id],
    queryFn: async () => {
      if (!currentUser?.account_id) return { leads: 0, won: 0 };

      // Count total leads created in period
      let leadsQuery = supabase
        .from("deals")
        .select("*", { count: "exact", head: true })
        .eq("account_id", currentUser.account_id)
        .gte("created_at", filters.startDate)
        .lte("created_at", filters.endDate);

      // Count won deals in period
      let wonQuery = supabase
        .from("deals")
        .select("*", { count: "exact", head: true })
        .eq("account_id", currentUser.account_id)
        .eq("status", "won")
        .gte("won_at", filters.startDate)
        .lte("won_at", filters.endDate);

      if (filters.userId && filters.userId !== "all") {
        leadsQuery = leadsQuery.eq("responsible_user_id", filters.userId);
        wonQuery = wonQuery.eq("responsible_user_id", filters.userId);
      }

      const [leadsResult, wonResult] = await Promise.all([leadsQuery, wonQuery]);

      return {
        leads: leadsResult.count || 0,
        won: wonResult.count || 0,
      };
    },
    enabled: !!currentUser?.account_id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Skeleton className="h-12 w-24" />
      </div>
    );
  }

  const leads = data?.leads || 0;
  const won = data?.won || 0;
  const conversionRate = leads > 0 ? Math.round((won / leads) * 100) : 0;

  const valueSize = Math.round(32 * m);
  const denominatorSize = Math.round(18 * m);
  const labelSize = Math.round(11 * m);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-3 py-2">
      {/* Main ratio */}
      <div className="flex items-baseline justify-center gap-0.5">
        <span className="font-bold text-primary leading-none" style={{ fontSize: `${valueSize}px` }}>
          {won}
        </span>
        <span className="font-normal text-muted-foreground leading-none" style={{ fontSize: `${denominatorSize}px` }}>
          /{leads}
        </span>
      </div>

      {/* Subtitle */}
      <div className="flex items-center gap-3 text-muted-foreground" style={{ fontSize: `${labelSize}px` }}>
        <span className="flex items-center gap-1">
          <Trophy className="h-3 w-3" />
          {won} {won === 1 ? 'venda' : 'vendas'}
        </span>
        <span className="w-px h-3 bg-border inline-block" />
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {leads} leads
        </span>
        <span className="w-px h-3 bg-border inline-block" />
        <span className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          {conversionRate}%
        </span>
      </div>
    </div>
  );
}
