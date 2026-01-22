import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInsightsFilters } from "./useInsightsFilters";
import { startOfMonth, endOfMonth, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DealWithStage {
  id: string;
  value: number | null;
  status: string;
  won_at: string | null;
  lost_at: string | null;
  created_at: string;
  stage_id: string | null;
  responsible_user_id: string | null;
  stage?: {
    name: string;
    color: string;
  } | null;
  responsible_user?: {
    name: string;
  } | null;
}

export function useInsightsData() {
  const { filters } = useInsightsFilters();

  // Total Won Value (Valor Total Ganho)
  const totalWonValueQuery = useQuery({
    queryKey: ["insights", "total-won-value", filters.startDate, filters.endDate, filters.userId, filters.productId],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select("value")
        .eq("status", "won")
        .gte("won_at", filters.startDate)
        .lte("won_at", filters.endDate);

      if (filters.userId !== "all") {
        query = query.eq("responsible_user_id", filters.userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;
    },
  });

  // Conversion Rate (Taxa de Conversão)
  const conversionRateQuery = useQuery({
    queryKey: ["insights", "conversion-rate", filters.startDate, filters.endDate, filters.userId],
    queryFn: async () => {
      let totalQuery = supabase
        .from("deals")
        .select("*", { count: "exact", head: true })
        .gte("created_at", filters.startDate)
        .lte("created_at", filters.endDate);

      let wonQuery = supabase
        .from("deals")
        .select("*", { count: "exact", head: true })
        .eq("status", "won")
        .gte("won_at", filters.startDate)
        .lte("won_at", filters.endDate);

      if (filters.userId !== "all") {
        totalQuery = totalQuery.eq("responsible_user_id", filters.userId);
        wonQuery = wonQuery.eq("responsible_user_id", filters.userId);
      }

      const [{ count: total }, { count: won }] = await Promise.all([totalQuery, wonQuery]);

      if (!total || total === 0) return 0;
      return Number(((won || 0) / total * 100).toFixed(1));
    },
  });

  // Average Ticket (Ticket Médio)
  const avgTicketQuery = useQuery({
    queryKey: ["insights", "avg-ticket", filters.startDate, filters.endDate, filters.userId],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select("value")
        .eq("status", "won")
        .gte("won_at", filters.startDate)
        .lte("won_at", filters.endDate);

      if (filters.userId !== "all") {
        query = query.eq("responsible_user_id", filters.userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) return 0;
      const total = data.reduce((sum, d) => sum + (d.value || 0), 0);
      return total / data.length;
    },
  });

  // Total Deals Count
  const totalDealsQuery = useQuery({
    queryKey: ["insights", "total-deals", filters.startDate, filters.endDate, filters.userId],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select("*", { count: "exact", head: true })
        .gte("created_at", filters.startDate)
        .lte("created_at", filters.endDate);

      if (filters.userId !== "all") {
        query = query.eq("responsible_user_id", filters.userId);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  // Revenue by Month (Faturamento por Mês)
  const revenueByMonthQuery = useQuery({
    queryKey: ["insights", "revenue-by-month", filters.startDate, filters.endDate, filters.userId],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select("value, won_at")
        .eq("status", "won")
        .gte("won_at", filters.startDate)
        .lte("won_at", filters.endDate);

      if (filters.userId !== "all") {
        query = query.eq("responsible_user_id", filters.userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by month
      const grouped: Record<string, number> = {};
      data?.forEach((deal) => {
        if (deal.won_at) {
          const monthKey = format(parseISO(deal.won_at), "yyyy-MM");
          grouped[monthKey] = (grouped[monthKey] || 0) + (deal.value || 0);
        }
      });

      // Convert to array and sort
      return Object.entries(grouped)
        .map(([month, value]) => ({
          month,
          label: format(parseISO(`${month}-01`), "MMM/yy", { locale: ptBR }),
          value,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));
    },
  });

  // Deals by Stage (Negócios por Etapa)
  const dealsByStageQuery = useQuery({
    queryKey: ["insights", "deals-by-stage", filters.stageId, filters.userId],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select(`
          id,
          value,
          stage_id,
          stage:deal_stages(name, color)
        `)
        .eq("status", "open");

      if (filters.userId !== "all") {
        query = query.eq("responsible_user_id", filters.userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by stage
      const grouped: Record<string, { name: string; color: string; count: number; value: number }> = {};
      data?.forEach((deal) => {
        const stageData = deal.stage as { name: string; color: string } | null;
        const stageName = stageData?.name || "Sem Etapa";
        const stageColor = stageData?.color || "#94a3b8";
        
        if (!grouped[stageName]) {
          grouped[stageName] = { name: stageName, color: stageColor, count: 0, value: 0 };
        }
        grouped[stageName].count += 1;
        grouped[stageName].value += deal.value || 0;
      });

      return Object.values(grouped);
    },
  });

  // Top Products (Ranking de Produtos)
  const topProductsQuery = useQuery({
    queryKey: ["insights", "top-products", filters.startDate, filters.endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contracts")
        .select(`
          value,
          product_id,
          product:products(name, color)
        `)
        .in("status", ["active", "completed"])
        .gte("start_date", filters.startDate);

      if (error) throw error;

      // Group by product
      const grouped: Record<string, { name: string; color: string; value: number; count: number }> = {};
      data?.forEach((contract) => {
        const productData = contract.product as { name: string; color: string | null } | null;
        const productName = productData?.name || "Sem Produto";
        const productColor = productData?.color || "#94a3b8";
        
        if (!grouped[productName]) {
          grouped[productName] = { name: productName, color: productColor, value: 0, count: 0 };
        }
        grouped[productName].value += contract.value || 0;
        grouped[productName].count += 1;
      });

      return Object.values(grouped)
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    },
  });

  // Sales by User (Vendas por Vendedor)
  const salesByUserQuery = useQuery({
    queryKey: ["insights", "sales-by-user", filters.startDate, filters.endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(`
          value,
          responsible_user_id,
          responsible_user:users!deals_responsible_user_id_fkey(name, avatar_url)
        `)
        .eq("status", "won")
        .gte("won_at", filters.startDate)
        .lte("won_at", filters.endDate);

      if (error) throw error;

      // Group by user
      const grouped: Record<string, { name: string; value: number; count: number }> = {};
      data?.forEach((deal) => {
        const userData = deal.responsible_user as { name: string; avatar_url: string | null } | null;
        const userName = userData?.name || "Sem Responsável";
        
        if (!grouped[userName]) {
          grouped[userName] = { name: userName, value: 0, count: 0 };
        }
        grouped[userName].value += deal.value || 0;
        grouped[userName].count += 1;
      });

      return Object.values(grouped)
        .sort((a, b) => b.value - a.value);
    },
  });

  // Lost Reasons (Motivos de Perda)
  const lostReasonsQuery = useQuery({
    queryKey: ["insights", "lost-reasons", filters.startDate, filters.endDate, filters.userId],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select("lost_reason, value")
        .eq("status", "lost")
        .gte("lost_at", filters.startDate)
        .lte("lost_at", filters.endDate);

      if (filters.userId !== "all") {
        query = query.eq("responsible_user_id", filters.userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by reason
      const grouped: Record<string, { reason: string; count: number; value: number }> = {};
      data?.forEach((deal) => {
        const reason = deal.lost_reason || "Não informado";
        if (!grouped[reason]) {
          grouped[reason] = { reason, count: 0, value: 0 };
        }
        grouped[reason].count += 1;
        grouped[reason].value += deal.value || 0;
      });

      return Object.values(grouped)
        .sort((a, b) => b.count - a.count);
    },
  });

  return {
    totalWonValue: totalWonValueQuery.data || 0,
    totalWonValueLoading: totalWonValueQuery.isLoading,
    
    conversionRate: conversionRateQuery.data || 0,
    conversionRateLoading: conversionRateQuery.isLoading,
    
    avgTicket: avgTicketQuery.data || 0,
    avgTicketLoading: avgTicketQuery.isLoading,
    
    totalDeals: totalDealsQuery.data || 0,
    totalDealsLoading: totalDealsQuery.isLoading,
    
    revenueByMonth: revenueByMonthQuery.data || [],
    revenueByMonthLoading: revenueByMonthQuery.isLoading,
    
    dealsByStage: dealsByStageQuery.data || [],
    dealsByStageLoading: dealsByStageQuery.isLoading,
    
    topProducts: topProductsQuery.data || [],
    topProductsLoading: topProductsQuery.isLoading,
    
    salesByUser: salesByUserQuery.data || [],
    salesByUserLoading: salesByUserQuery.isLoading,
    
    lostReasons: lostReasonsQuery.data || [],
    lostReasonsLoading: lostReasonsQuery.isLoading,

    // Refetch all
    refetchAll: () => {
      totalWonValueQuery.refetch();
      conversionRateQuery.refetch();
      avgTicketQuery.refetch();
      totalDealsQuery.refetch();
      revenueByMonthQuery.refetch();
      dealsByStageQuery.refetch();
      topProductsQuery.refetch();
      salesByUserQuery.refetch();
      lostReasonsQuery.refetch();
    },
  };
}
