import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FinancialRisk = "critical" | "high" | "warning" | "ok";

export interface ClientFinancialStatus {
  client_id: string;
  overdue_amount: number;
  overdue_count: number;
  oldest_overdue_days: number;
  next_due_date: string | null;
  pending_amount: number;
  risk: FinancialRisk;
}

function classify(s: Omit<ClientFinancialStatus, "risk" | "client_id">): FinancialRisk {
  if (s.overdue_count === 0) {
    if (s.next_due_date) {
      const days = Math.floor(
        (new Date(s.next_due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      if (days >= 0 && days <= 7) return "warning";
    }
    return "ok";
  }
  if (s.oldest_overdue_days > 30 || s.overdue_amount > 5000) return "critical";
  return "high";
}

/**
 * Batch hook: fornece status financeiro (overdue/pending) de uma lista de clientes
 * lendo direto de financial_entries (alimentado por Operações + Omie).
 */
export function useClientFinancialStatus(clientIds: string[]) {
  const ids = [...new Set(clientIds.filter(Boolean))].sort();
  const key = ids.join(",");

  return useQuery({
    queryKey: ["client-financial-status", key],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const map = new Map<string, ClientFinancialStatus>();
      if (ids.length === 0) return map;

      // Pega entries em status pending/overdue/partially_paid receivables vinculados a esses clientes
      const { data, error } = await supabase
        .from("financial_entries")
        .select("client_id, amount, due_date, status, payment_date")
        .eq("entry_type", "receivable")
        .in("client_id", ids)
        .in("status", ["pending", "overdue", "partially_paid"]);

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const byClient = new Map<
        string,
        { overdue_amount: number; overdue_count: number; oldest_overdue_days: number; next_due_date: string | null; pending_amount: number }
      >();

      for (const row of data || []) {
        if (!row.client_id) continue;
        const due = new Date(row.due_date as string);
        const isOverdue = due < today || row.status === "overdue";
        const cur =
          byClient.get(row.client_id) ||
          { overdue_amount: 0, overdue_count: 0, oldest_overdue_days: 0, next_due_date: null as string | null, pending_amount: 0 };

        if (isOverdue) {
          cur.overdue_amount += Number(row.amount) || 0;
          cur.overdue_count += 1;
          const days = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
          if (days > cur.oldest_overdue_days) cur.oldest_overdue_days = days;
        } else {
          cur.pending_amount += Number(row.amount) || 0;
          if (!cur.next_due_date || due < new Date(cur.next_due_date)) {
            cur.next_due_date = row.due_date as string;
          }
        }
        byClient.set(row.client_id, cur);
      }

      for (const [client_id, s] of byClient) {
        map.set(client_id, { client_id, ...s, risk: classify(s) });
      }
      // Clientes sem entries pendentes ficam fora do map → tratados como "ok" pelo consumer
      return map;
    },
  });
}
