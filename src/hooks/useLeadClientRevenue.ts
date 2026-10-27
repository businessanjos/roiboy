import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LeadForRevenue {
  id: string;
  converted_to_client_id: string | null;
  phone: string | null;
}

/**
 * Mapa leadId -> faturamento atual (R$/mês) do cliente vinculado.
 * Vincula por `converted_to_client_id` e, na falta, por telefone
 * (comparação por dígitos, tolerando +55 e DDD).
 */
export function useLeadClientRevenue(
  leads: LeadForRevenue[],
  accountId?: string | null
): Record<string, number> {
  const [revenueMap, setRevenueMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!accountId || leads.length === 0) {
      setRevenueMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, current_revenue, phone_e164")
        .eq("account_id", accountId)
        .not("current_revenue", "is", null);
      if (cancelled) return;
      if (error || !data) {
        setRevenueMap({});
        return;
      }
      const digits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");
      const byId = new Map<string, number>();
      const byPhone = new Map<string, number>();
      for (const c of data) {
        const rev = Number(c.current_revenue) || 0;
        if (!rev) continue;
        byId.set(c.id, rev);
        const d = digits(c.phone_e164);
        if (d) {
          byPhone.set(d, rev);
          if (d.length >= 11) byPhone.set(d.slice(-11), rev);
        }
      }
      const map: Record<string, number> = {};
      for (const lead of leads) {
        if (lead.converted_to_client_id && byId.has(lead.converted_to_client_id)) {
          map[lead.id] = byId.get(lead.converted_to_client_id)!;
          continue;
        }
        const d = digits(lead.phone);
        if (!d) continue;
        const rev = byPhone.get(d) ?? (d.length >= 11 ? byPhone.get(d.slice(-11)) : undefined);
        if (rev) map[lead.id] = rev;
      }
      if (!cancelled) setRevenueMap(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [leads, accountId]);

  return revenueMap;
}
