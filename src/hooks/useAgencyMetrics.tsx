import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { startOfMonth, endOfMonth, format, eachDayOfInterval } from "date-fns";

const MQL_FIELD_ID = "448404cd-0344-4892-a574-2387b1c17578";
const MQL_VALUES = new Set([
  "sim_acima_30k",
  "SIM - Acima de 30k",
  "SIM - Lead Qualificado / +30K",
]);

export interface AgencyMetricsRange {
  startDate: Date;
  endDate: Date;
}

export interface AgencyCampaign {
  id: string;
  name: string;
  platform: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpl: number;
}

export interface AgencyMetrics {
  spend: number;
  leads: number;
  mql: number;
  vendas: number;
  cpl: number;
  cac: number;
  roas: number; // requires won revenue; computed if available
  ticketMedio: number;
  funnel: { lead: number; mql: number; vendas: number };
  campaigns: AgencyCampaign[];
  daily: { date: string; spend: number; leads: number; mql: number; vendas: number }[];
}

export function useAgencyMetrics(agencyId?: string, range?: AgencyMetricsRange) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const now = new Date();
  const rStart = range?.startDate ?? startOfMonth(now);
  const rEnd = range?.endDate ?? endOfMonth(now);

  return useQuery<AgencyMetrics>({
    queryKey: ["agency-metrics", agencyId ?? "all", accountId, rStart.toISOString(), rEnd.toISOString()],
    enabled: !!accountId,
    queryFn: async () => {
      const sb: any = supabase;

      // Campaigns (filtered by agency if provided)
      let campaignsQuery = sb
        .from("marketing_ad_sets")
        .select("id, name, platform, status, spend, impressions, clicks, conversions, cpl, agency_id")
        .order("spend", { ascending: false });
      if (agencyId) campaignsQuery = campaignsQuery.eq("agency_id", agencyId);
      else campaignsQuery = campaignsQuery.eq("account_id", accountId);
      const { data: campaigns = [] } = await campaignsQuery;

      let spend = 0,
        leads = 0,
        impressions = 0;
      for (const c of campaigns as any[]) {
        spend += Number(c.spend) || 0;
        leads += Number(c.conversions) || 0;
        impressions += Number(c.impressions) || 0;
      }

      // Deals tagged to this agency in the date range
      let dealsQuery = sb
        .from("deals")
        .select("id, status, amount, created_at")
        .eq("account_id", accountId)
        .gte("created_at", rStart.toISOString())
        .lte("created_at", rEnd.toISOString());
      if (agencyId) dealsQuery = dealsQuery.eq("agency_id", agencyId);
      const { data: deals = [] } = await dealsQuery;

      const dealIds = (deals as any[]).map((d) => d.id);
      const mqlSet = new Set<string>();
      if (dealIds.length) {
        for (let i = 0; i < dealIds.length; i += 500) {
          const chunk = dealIds.slice(i, i + 500);
          const { data: fvs = [] } = await sb
            .from("deal_field_values")
            .select("deal_id, value_text")
            .eq("field_id", MQL_FIELD_ID)
            .in("deal_id", chunk);
          for (const fv of fvs as any[]) {
            if (MQL_VALUES.has(fv.value_text)) mqlSet.add(fv.deal_id);
          }
        }
      }

      let vendas = 0;
      let receita = 0;
      for (const d of deals as any[]) {
        if (d.status === "won") {
          vendas++;
          receita += Number(d.amount) || 0;
        }
      }
      const leadsRange = (deals as any[]).length;
      const mql = mqlSet.size;
      const cpl = leads > 0 ? spend / leads : 0;
      const cac = vendas > 0 ? spend / vendas : 0;
      const roas = spend > 0 ? receita / spend : 0;
      const ticketMedio = vendas > 0 ? receita / vendas : 0;

      // Daily series — only for the requested range, aggregating deals/mql/vendas (campaign daily not avail)
      const days = eachDayOfInterval({ start: rStart, end: rEnd });
      const dailyMap: Record<string, { spend: number; leads: number; mql: number; vendas: number }> = {};
      days.forEach((d) => (dailyMap[format(d, "yyyy-MM-dd")] = { spend: 0, leads: 0, mql: 0, vendas: 0 }));
      for (const d of deals as any[]) {
        const k = format(new Date(d.created_at), "yyyy-MM-dd");
        if (!dailyMap[k]) continue;
        dailyMap[k].leads++;
        if (mqlSet.has(d.id)) dailyMap[k].mql++;
        if (d.status === "won") dailyMap[k].vendas++;
      }
      const daily = days.map((d) => {
        const k = format(d, "yyyy-MM-dd");
        return { date: k, ...dailyMap[k] };
      });

      return {
        spend,
        leads,
        mql,
        vendas,
        cpl,
        cac,
        roas,
        ticketMedio,
        funnel: { lead: leadsRange, mql, vendas },
        campaigns: campaigns as AgencyCampaign[],
        daily,
      };
    },
  });
}
