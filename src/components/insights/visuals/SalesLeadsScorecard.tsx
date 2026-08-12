import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInsightsFilters, mergeGlobalDealFilter } from "@/hooks/useInsightsFilters";
import { FONT_SCALE_MULTIPLIERS, VisualConfig, getDealFilters } from "../visual-builder/types";
import { applyVisualFilters, selectUnmirroredFilters } from "@/lib/insights/applyFilters";
import { filterByDealFields } from "@/hooks/useDealFieldFilter";
import { Users, Trophy, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface SalesLeadsScorecardProps {
  fontScale?: string;
  valueColor?: string;
  config?: VisualConfig;
}

type DealRow = {
  id: string;
  status: string | null;
  created_at: string;
  won_at: string | null;
  pipeline_id: string | null;
  responsible_user_id: string | null;
  deal_stages?: { name: string } | null;
  pipelines?: { name: string } | null;
  users?: { name: string } | null;
};

async function fetchAllDeals(
  accountId: string,
  filters: any,
  pipelineId: string,
  dateField: "created_at" | "won_at"
): Promise<DealRow[]> {
  const rows: DealRow[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    let query = supabase
      .from("deals")
      .select(
        `id, status, created_at, won_at, pipeline_id, responsible_user_id,
         deal_stages!deals_stage_id_fkey(name),
         pipelines!deals_pipeline_id_fkey(name),
         users!deals_responsible_user_id_fkey(name)`
      )
      .eq("account_id", accountId)
      .is("deleted_at", null);

    if (dateField === "won_at") {
      query = query.eq("status", "won").not("won_at", "is", null);
    }
    if (filters.startDate) query = query.gte(dateField, filters.startDate);
    if (filters.endDate) query = query.lte(dateField, filters.endDate);
    if (filters.userId && filters.userId !== "all") query = query.eq("responsible_user_id", filters.userId);
    if (filters.stageId && filters.stageId !== "all") query = query.eq("stage_id", filters.stageId);
    if (pipelineId && pipelineId !== "all") query = query.eq("pipeline_id", pipelineId);

    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) {
      console.error("SalesLeadsScorecard: erro ao buscar negócios", error);
      break;
    }
    rows.push(...((data as any[]) || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

export function SalesLeadsScorecard({ fontScale = "normal", valueColor, config }: SalesLeadsScorecardProps) {
  const m = FONT_SCALE_MULTIPLIERS[fontScale as keyof typeof FONT_SCALE_MULTIPLIERS] || 1;
  const { currentUser } = useCurrentUser();
  const { filters } = useInsightsFilters();

  const { data, isLoading } = useQuery({
    queryKey: [
      "insights",
      "sales-leads-unified",
      filters.startDate,
      filters.endDate,
      filters.userId,
      filters.stageId,
      filters.pipelineId,
      filters.globalFieldFilter,
      config?.filters,
      config?.dealFieldFilter,
      config?.dealFieldFilters,
      currentUser?.account_id,
    ],
    queryFn: async () => {
      if (!currentUser?.account_id) return { leads: 0, won: 0 };
      const accountId = currentUser.account_id;
      const pipelineId = filters.pipelineId || "";

      const dealFieldFilters = mergeGlobalDealFilter(getDealFilters(config as any), filters.globalFieldFilter);
      const unifiedFilters = selectUnmirroredFilters(config?.filters);

      const applyAll = async (rows: DealRow[]) => {
        let result = rows;
        if (dealFieldFilters.length) {
          result = (await filterByDealFields(result as any, accountId, dealFieldFilters)) as DealRow[];
        }
        if (unifiedFilters.length) {
          result = (await applyVisualFilters(result as any, accountId, unifiedFilters, "deals")) as DealRow[];
        }
        return result;
      };

      const [leadRows, wonRows] = await Promise.all([
        fetchAllDeals(accountId, filters, pipelineId, "created_at"),
        fetchAllDeals(accountId, filters, pipelineId, "won_at"),
      ]);

      const [leadsFiltered, wonFiltered] = await Promise.all([applyAll(leadRows), applyAll(wonRows)]);

      return { leads: leadsFiltered.length, won: wonFiltered.length };
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
        <span className="font-bold leading-none" style={{ fontSize: `${valueSize}px`, color: valueColor || 'hsl(var(--primary))' }}>
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
