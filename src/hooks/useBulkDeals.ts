import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { Deal } from "@/hooks/useDeals";
import type { Json } from "@/integrations/supabase/types";
import { serializeBulkAction, type BulkDealAction, type BulkDealResult } from "@/lib/sales/bulkDeals";

export function useBulkDeals({ refresh }: { refresh: () => Promise<void> }) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BulkDealResult[]>([]);
  const [total, setTotal] = useState(0);
  const locked = useRef(false);
  const cancelled = useRef(false);

  const run = async (deals: Deal[], action: BulkDealAction): Promise<BulkDealResult[]> => {
    if (locked.current || !currentUser?.account_id || !deals.length) return [];
    locked.current = true;
    cancelled.current = false;
    setRunning(true); setResults([]); setTotal(deals.length);
    let operationId: string | null = null;
    const outcome: BulkDealResult[] = [];
    try {
      const { data, error } = await supabase.rpc("begin_bulk_deal_operation", {
        p_action: serializeBulkAction(action) as Json, p_deal_ids: deals.map(deal => deal.id),
      });
      if (error || !data) throw new Error(error?.message || "Não foi possível iniciar a alteração.");
      operationId = data;
      for (const deal of deals) {
        if (cancelled.current) break;
        const response = await supabase.rpc("apply_bulk_deal_operation_item", { p_operation: operationId, p_deal: deal.id });
        // A transport failure is ambiguous: stop, never automatically resend the operation.
        if (response.error) throw new Error(response.error.message || "A conexão falhou. Confira o histórico antes de tentar novamente.");
        const row = response.data as unknown as BulkDealResult | null;
        if (!row || row.id !== deal.id || typeof row.success !== "boolean") throw new Error("Não foi possível confirmar o resultado. Confira o histórico.");
        outcome.push(row);
        setResults([...outcome]);
      }
      return outcome;
    } finally {
      try {
        if (operationId) {
          const { error } = await supabase.rpc("finish_bulk_deal_operation", { p_operation: operationId });
          if (error) throw new Error("Não foi possível finalizar o histórico. Confira a operação antes de tentar novamente.");
        }
      } finally {
        await queryClient.invalidateQueries({ queryKey: ["bulk-deal-history"] });
        await queryClient.invalidateQueries({ queryKey: ["batch-deal-activity-status"] });
        try { await refresh(); } finally { locked.current = false; setRunning(false); }
      }
    }
  };
  return { run, running, results, total, cancel: () => { cancelled.current = true; }, reset: () => { if (!locked.current) { setResults([]); setTotal(0); } } };
}