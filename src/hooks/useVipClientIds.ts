import { useQuery } from "@tanstack/react-query";
import { differenceInMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface VipCriteria {
  min_received: number;
  min_ltv_months: number;
  product_ids: string[];
  top_n: number;
}

const DEFAULT_CRITERIA: VipCriteria = {
  min_received: 150000,
  min_ltv_months: 0,
  product_ids: [],
  top_n: 30,
};

interface Row {
  client_id: string;
  total: number;
  received: number;
  product_ids: string[];
  product_names: string[];
  start_date: string | null;
  ltv_months: number;
}

/**
 * Returns a Set of client_ids that are currently classified as VIP,
 * applying the same cascade logic as the VipClients page:
 *   1. Min received value (+ optional LTV / products filter)
 *   2. Fallback: Conselho / Private products
 *   3. Fallback: longest LTV
 * Capped by criteria.top_n.
 */
export function useVipClientIds() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const { data, isLoading } = useQuery({
    queryKey: ["vip-client-ids", accountId],
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Set<string>> => {
      if (!accountId) return new Set();

      const [{ data: criteriaRow }, { data: contracts }, { data: entries }] =
        await Promise.all([
          supabase
            .from("vip_criteria")
            .select("min_received, min_ltv_months, product_ids, top_n")
            .eq("account_id", accountId)
            .maybeSingle(),
          supabase
            .from("client_contracts")
            .select(
              "client_id, value, start_date, status, product_id, products(name)"
            )
            .eq("account_id", accountId)
            .not("status", "in", "(cancelled,dismissed,dropout_7d)"),
          supabase
            .from("financial_entries")
            .select("client_id, amount, status")
            .eq("account_id", accountId)
            .eq("entry_type", "receivable")
            .not("client_id", "is", null),
        ]);

      const criteria: VipCriteria = criteriaRow
        ? {
            min_received: Number(criteriaRow.min_received) || 0,
            min_ltv_months: criteriaRow.min_ltv_months || 0,
            product_ids: criteriaRow.product_ids || [],
            top_n: criteriaRow.top_n || 0,
          }
        : DEFAULT_CRITERIA;

      const map = new Map<string, Row>();
      (contracts || []).forEach((c: any) => {
        const cid = c.client_id;
        if (!cid) return;
        if (!map.has(cid)) {
          map.set(cid, {
            client_id: cid,
            total: 0,
            received: 0,
            product_ids: [],
            product_names: [],
            start_date: c.start_date,
            ltv_months: 0,
          });
        }
        const row = map.get(cid)!;
        row.total += Number(c.value || 0);
        if (c.product_id && !row.product_ids.includes(c.product_id)) {
          row.product_ids.push(c.product_id);
        }
        if (c.products?.name && !row.product_names.includes(c.products.name)) {
          row.product_names.push(c.products.name);
        }
        if (c.start_date && (!row.start_date || c.start_date < row.start_date)) {
          row.start_date = c.start_date;
        }
      });

      (entries || []).forEach((e: any) => {
        const row = map.get(e.client_id);
        if (!row) return;
        if (e.status === "paid") row.received += Number(e.amount || 0);
      });

      const rows = Array.from(map.values())
        .filter((r) => r.total > 0)
        .map((r) => ({
          ...r,
          ltv_months: r.start_date
            ? Math.max(differenceInMonths(new Date(), new Date(r.start_date)), 0)
            : 0,
        }));

      const target = criteria.top_n > 0 ? criteria.top_n : rows.length;
      const matchesProductFilter = (r: Row) => {
        if (criteria.product_ids.length === 0) return true;
        return r.product_ids.some((pid) => criteria.product_ids.includes(pid));
      };

      const selected = new Map<string, Row>();

      // Tier 1
      rows
        .filter(
          (r) =>
            r.received >= criteria.min_received &&
            r.ltv_months >= criteria.min_ltv_months &&
            matchesProductFilter(r)
        )
        .forEach((r) => selected.set(r.client_id, r));

      // Tier 2: Conselho / Private
      if (selected.size < target) {
        const elite = /(conselho|private)/i;
        rows
          .filter(
            (r) =>
              !selected.has(r.client_id) &&
              r.product_names.some((n) => elite.test(n))
          )
          .sort((a, b) => b.received - a.received || b.total - a.total)
          .forEach((r) => {
            if (selected.size < target) selected.set(r.client_id, r);
          });
      }

      // Tier 3: longest LTV
      if (selected.size < target) {
        rows
          .filter((r) => !selected.has(r.client_id))
          .sort((a, b) => b.ltv_months - a.ltv_months || b.received - a.received)
          .forEach((r) => {
            if (selected.size < target) selected.set(r.client_id, r);
          });
      }

      const final = Array.from(selected.values())
        .sort((a, b) => b.received - a.received || b.total - a.total)
        .slice(0, target);

      return new Set(final.map((r) => r.client_id));
    },
  });

  return { vipIds: data ?? new Set<string>(), isLoading };
}
