import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ClientFinancialStatus = "em_dia" | "atrasado" | "inadimplente" | "sem_dados";

interface FinancialStatusResult {
  status: ClientFinancialStatus;
  overdueCount: number;
  overdueAmount: number;
  maxDaysOverdue: number;
  isLoading: boolean;
}

export function useClientFinancialStatus(clientId: string): FinancialStatusResult {
  const { data: overdueData, isLoading } = useQuery({
    queryKey: ["client-financial-status", clientId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      
      const { data, error } = await supabase
        .from("financial_entries")
        .select("id, amount, due_date")
        .eq("client_id", clientId)
        .eq("entry_type", "receivable")
        .in("status", ["pending", "scheduled"])
        .lt("due_date", today);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return useMemo(() => {
    if (isLoading) {
      return {
        status: "sem_dados" as ClientFinancialStatus,
        overdueCount: 0,
        overdueAmount: 0,
        maxDaysOverdue: 0,
        isLoading: true,
      };
    }

    if (!overdueData || overdueData.length === 0) {
      return {
        status: "em_dia" as ClientFinancialStatus,
        overdueCount: 0,
        overdueAmount: 0,
        maxDaysOverdue: 0,
        isLoading: false,
      };
    }

    const today = new Date();
    let maxDaysOverdue = 0;
    let totalAmount = 0;

    overdueData.forEach(entry => {
      const dueDate = new Date(entry.due_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      maxDaysOverdue = Math.max(maxDaysOverdue, daysOverdue);
      totalAmount += entry.amount || 0;
    });

    // Classification logic:
    // - Em dia: No overdue entries
    // - Atrasado: 1-30 days overdue
    // - Inadimplente: 30+ days overdue
    let status: ClientFinancialStatus = "em_dia";
    if (maxDaysOverdue > 30) {
      status = "inadimplente";
    } else if (maxDaysOverdue > 0) {
      status = "atrasado";
    }

    return {
      status,
      overdueCount: overdueData.length,
      overdueAmount: totalAmount,
      maxDaysOverdue,
      isLoading: false,
    };
  }, [overdueData, isLoading]);
}

// Utility function for getting status without hook (for tables/lists)
export async function getClientFinancialStatus(clientId: string): Promise<{
  status: ClientFinancialStatus;
  overdueCount: number;
  overdueAmount: number;
  maxDaysOverdue: number;
}> {
  const today = new Date().toISOString().split("T")[0];
  
  const { data, error } = await supabase
    .from("financial_entries")
    .select("id, amount, due_date")
    .eq("client_id", clientId)
    .eq("entry_type", "receivable")
    .in("status", ["pending", "scheduled"])
    .lt("due_date", today);
  
  if (error || !data || data.length === 0) {
    return {
      status: "em_dia",
      overdueCount: 0,
      overdueAmount: 0,
      maxDaysOverdue: 0,
    };
  }

  const todayDate = new Date();
  let maxDaysOverdue = 0;
  let totalAmount = 0;

  data.forEach(entry => {
    const dueDate = new Date(entry.due_date);
    const daysOverdue = Math.floor((todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    maxDaysOverdue = Math.max(maxDaysOverdue, daysOverdue);
    totalAmount += entry.amount || 0;
  });

  let status: ClientFinancialStatus = "em_dia";
  if (maxDaysOverdue > 30) {
    status = "inadimplente";
  } else if (maxDaysOverdue > 0) {
    status = "atrasado";
  }

  return {
    status,
    overdueCount: data.length,
    overdueAmount: totalAmount,
    maxDaysOverdue,
  };
}
