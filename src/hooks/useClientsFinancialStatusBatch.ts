import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FinancialRisk = "critical" | "high" | "warning" | "ok";

export interface BatchClientFinancialStatus {
  client_id: string;
  overdue_amount: number;
  overdue_count: number;
  oldest_overdue_days: number;
  next_due_date: string | null;
  pending_amount: number;
  risk: FinancialRisk;
}

function classify(s: Omit<BatchClientFinancialStatus, "risk" | "client_id">): FinancialRisk {
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
 * Hook em batch: status financeiro de muitos clientes em uma query única,
 * lendo direto de financial_entries (alimentado por Operações + Omie).
 */
export function useClientsFinancialStatusBatch(clientIds: string[]) {
  const ids = [...new Set(clientIds.filter(Boolean))].sort();
  const key = ids.length;

  return useQuery({
    queryKey: ["clients-financial-status-batch", key, ids[0], ids[ids.length - 1]],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const map = new Map<string, BatchClientFinancialStatus>();
      if (ids.length === 0) return map;

      // Chunk em 200 ids para não estourar URL
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const byClient = new Map<
        string,
        { overdue_amount: number; overdue_count: number; oldest_overdue_days: number; next_due_date: string | null; pending_amount: number }
      >();

      for (const chunk of chunks) {
        const { data, error } = await supabase
          .from("financial_entries")
          .select("client_id, amount, due_date, status")
          .eq("entry_type", "receivable")
          .in("client_id", chunk)
          .in("status", ["pending", "overdue", "partially_paid"]);
        if (error) throw error;

        for (const row of data || []) {
          if (!row.client_id) continue;
          const due = new Date(row.due_date as string);
          const isOverdue = due < today || row.status === "overdue";
          const cur = byClient.get(row.client_id) || {
            overdue_amount: 0,
            overdue_count: 0,
            oldest_overdue_days: 0,
            next_due_date: null as string | null,
            pending_amount: 0,
          };
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
      }

      for (const [client_id, s] of byClient) {
        map.set(client_id, { client_id, ...s, risk: classify(s) });
      }
      return map;
    },
  });
}
