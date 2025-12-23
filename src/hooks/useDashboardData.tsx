import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { subMonths, format, startOfMonth, endOfMonth, parseISO, isBefore, addYears, differenceInDays } from "date-fns";

interface ClientWithScore {
  id: string;
  full_name: string;
  phone_e164: string;
  status: "active" | "paused" | "churn_risk" | "churned" | "no_contract";
  roizometer: number;
  escore: number;
  quadrant: "highE_lowROI" | "lowE_highROI" | "lowE_lowROI" | "highE_highROI";
  trend: "up" | "flat" | "down";
  last_risk?: string;
  recommendation?: string;
  vnps_score?: number;
  vnps_class?: "promoter" | "neutral" | "detractor";
  product_ids?: string[];
  hasActiveContract?: boolean;
}

interface Product {
  id: string;
  name: string;
}

interface LifeEvent {
  id: string;
  client_id: string;
  client_name: string;
  event_type: string;
  title: string;
  event_date: string | null;
  is_recurring: boolean;
  source: string;
  daysUntil?: number;
  nextDate?: Date;
}

interface ContractData {
  id: string;
  status: string;
  status_changed_at: string | null;
  start_date: string;
  value: number;
  client_id: string;
}

interface ROIStats {
  totalROIEvents: number;
  tangibleCount: number;
  intangibleCount: number;
  highImpactCount: number;
  recentCategories: { category: string; count: number }[];
}

interface RiskStats {
  totalRiskEvents: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
}

// Fetch all products
export function useProducts() {
  return useQuery({
    queryKey: ["dashboard-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return (data || []) as Product[];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Fetch all clients with scores in a single optimized query
export function useClientsWithScores() {
  return useQuery({
    queryKey: ["dashboard-clients-optimized"],
    queryFn: async () => {
      // Fetch all clients
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id, full_name, phone_e164, status")
        .order("created_at", { ascending: false });

      if (clientsError) throw clientsError;
      if (!clientsData || clientsData.length === 0) return [];

      const clientIds = clientsData.map(c => c.id);

      // Batch fetch all related data in parallel
      const [
        clientProductsRes,
        activeContractsRes,
        scoresRes,
        vnpsRes,
        risksRes,
        recsRes
      ] = await Promise.all([
        supabase.from("client_products").select("client_id, product_id"),
        supabase.from("client_contracts").select("client_id").eq("status", "active"),
        supabase.from("score_snapshots")
          .select("client_id, roizometer, escore, quadrant, trend, computed_at")
          .in("client_id", clientIds)
          .order("computed_at", { ascending: false }),
        supabase.from("vnps_snapshots")
          .select("client_id, vnps_score, vnps_class, computed_at")
          .in("client_id", clientIds)
          .order("computed_at", { ascending: false }),
        supabase.from("risk_events")
          .select("client_id, reason, happened_at")
          .in("client_id", clientIds)
          .order("happened_at", { ascending: false }),
        supabase.from("recommendations")
          .select("client_id, action_text, created_at")
          .in("client_id", clientIds)
          .eq("status", "open")
          .order("created_at", { ascending: false })
      ]);

      // Build maps for fast lookup
      const clientProductsMap: Record<string, string[]> = {};
      (clientProductsRes.data || []).forEach((cp: any) => {
        if (!clientProductsMap[cp.client_id]) {
          clientProductsMap[cp.client_id] = [];
        }
        clientProductsMap[cp.client_id].push(cp.product_id);
      });

      const activeContractsSet = new Set(
        (activeContractsRes.data || []).map((c: any) => c.client_id)
      );

      // Take latest score per client
      const scoresMap: Record<string, any> = {};
      (scoresRes.data || []).forEach((s: any) => {
        if (!scoresMap[s.client_id]) {
          scoresMap[s.client_id] = s;
        }
      });

      // Take latest vnps per client
      const vnpsMap: Record<string, any> = {};
      (vnpsRes.data || []).forEach((v: any) => {
        if (!vnpsMap[v.client_id]) {
          vnpsMap[v.client_id] = v;
        }
      });

      // Take latest risk per client
      const risksMap: Record<string, string> = {};
      (risksRes.data || []).forEach((r: any) => {
        if (!risksMap[r.client_id]) {
          risksMap[r.client_id] = r.reason;
        }
      });

      // Take latest recommendation per client
      const recsMap: Record<string, string> = {};
      (recsRes.data || []).forEach((r: any) => {
        if (!recsMap[r.client_id]) {
          recsMap[r.client_id] = r.action_text;
        }
      });

      // Map clients with their data
      const clientsWithScores: ClientWithScore[] = clientsData.map((client) => {
        const score = scoresMap[client.id];
        const vnps = vnpsMap[client.id];
        
        return {
          id: client.id,
          full_name: client.full_name,
          phone_e164: client.phone_e164,
          status: client.status as ClientWithScore["status"],
          roizometer: score?.roizometer ?? 0,
          escore: score?.escore ?? 0,
          quadrant: (score?.quadrant as ClientWithScore["quadrant"]) ?? "lowE_lowROI",
          trend: (score?.trend as ClientWithScore["trend"]) ?? "flat",
          last_risk: risksMap[client.id],
          recommendation: recsMap[client.id],
          vnps_score: vnps?.vnps_score,
          vnps_class: vnps?.vnps_class as ClientWithScore["vnps_class"],
          product_ids: clientProductsMap[client.id] || [],
          hasActiveContract: activeContractsSet.has(client.id),
        };
      });

      return clientsWithScores;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Fetch upcoming life events
export function useUpcomingLifeEvents() {
  return useQuery({
    queryKey: ["dashboard-life-events"],
    queryFn: async () => {
      const { data: eventsData, error } = await supabase
        .from("client_life_events")
        .select("*, clients!inner(full_name)")
        .not("event_date", "is", null)
        .order("event_date", { ascending: true });

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcoming = (eventsData || [])
        .map((event: any) => {
          const eventDate = new Date(event.event_date);
          let nextDate = new Date(eventDate);
          
          if (event.is_recurring) {
            nextDate.setFullYear(today.getFullYear());
            if (isBefore(nextDate, today)) {
              nextDate = addYears(nextDate, 1);
            }
          }
          
          const daysUntil = differenceInDays(nextDate, today);
          
          return {
            ...event,
            client_name: event.clients?.full_name || "Cliente",
            daysUntil,
            nextDate,
          };
        })
        .filter((e: any) => e.daysUntil >= 0 && e.daysUntil <= 30)
        .sort((a: any, b: any) => a.daysUntil - b.daysUntil)
        .slice(0, 10);

      return upcoming as LifeEvent[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Fetch ROI stats
export function useROIStats() {
  return useQuery({
    queryKey: ["dashboard-roi-stats"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: roiEvents, error } = await supabase
        .from("roi_events")
        .select("roi_type, category, impact")
        .gte("happened_at", thirtyDaysAgo.toISOString());

      if (error) throw error;

      const categoryCount: Record<string, number> = {};
      let tangible = 0;
      let intangible = 0;
      let highImpact = 0;

      (roiEvents || []).forEach((e: any) => {
        if (e.roi_type === "tangible") tangible++;
        else intangible++;
        if (e.impact === "high") highImpact++;
        categoryCount[e.category] = (categoryCount[e.category] || 0) + 1;
      });

      const recentCategories = Object.entries(categoryCount)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalROIEvents: roiEvents?.length || 0,
        tangibleCount: tangible,
        intangibleCount: intangible,
        highImpactCount: highImpact,
        recentCategories,
      } as ROIStats;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Fetch Risk stats
export function useRiskStats() {
  return useQuery({
    queryKey: ["dashboard-risk-stats"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: riskEvents, error } = await supabase
        .from("risk_events")
        .select("risk_level")
        .gte("happened_at", thirtyDaysAgo.toISOString());

      if (error) throw error;

      let high = 0, medium = 0, low = 0;
      (riskEvents || []).forEach((e: any) => {
        if (e.risk_level === "high") high++;
        else if (e.risk_level === "medium") medium++;
        else low++;
      });

      return {
        totalRiskEvents: riskEvents?.length || 0,
        highRiskCount: high,
        mediumRiskCount: medium,
        lowRiskCount: low,
      } as RiskStats;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Fetch contract data for charts
export function useContractData() {
  return useQuery({
    queryKey: ["dashboard-contracts"],
    queryFn: async () => {
      const twelveMonthsAgo = subMonths(new Date(), 12);
      
      const { data, error } = await supabase
        .from("client_contracts")
        .select("id, status, status_changed_at, start_date, value, client_id")
        .or(`start_date.gte.${format(twelveMonthsAgo, "yyyy-MM-dd")},status_changed_at.gte.${twelveMonthsAgo.toISOString()}`)
        .order("start_date", { ascending: true });

      if (error) throw error;
      return (data || []) as ContractData[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Combined hook for all dashboard data
export function useDashboardData() {
  const productsQuery = useProducts();
  const clientsQuery = useClientsWithScores();
  const lifeEventsQuery = useUpcomingLifeEvents();
  const roiStatsQuery = useROIStats();
  const riskStatsQuery = useRiskStats();
  const contractsQuery = useContractData();

  const isLoading = 
    productsQuery.isLoading || 
    clientsQuery.isLoading || 
    lifeEventsQuery.isLoading || 
    roiStatsQuery.isLoading || 
    riskStatsQuery.isLoading ||
    contractsQuery.isLoading;

  const refetchAll = () => {
    productsQuery.refetch();
    clientsQuery.refetch();
    lifeEventsQuery.refetch();
    roiStatsQuery.refetch();
    riskStatsQuery.refetch();
    contractsQuery.refetch();
  };

  return {
    products: productsQuery.data || [],
    clients: clientsQuery.data || [],
    upcomingEvents: lifeEventsQuery.data || [],
    roiStats: roiStatsQuery.data || null,
    riskStats: riskStatsQuery.data || null,
    contractData: contractsQuery.data || [],
    isLoading,
    refetchAll,
  };
}
