import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";

/** Month (yyyy-MM) a mentee entered: onboarding > client contract date > first contract > created_at. */
export function pickEntryMonth(c: {
  onboarding_started_at?: string | null;
  contract_start_date?: string | null;
  first_contract_start?: string | null;
  created_at?: string | null;
}): string | null {
  const raw = c.onboarding_started_at || c.contract_start_date || c.first_contract_start || c.created_at;
  return raw ? String(raw).slice(0, 7) : null;
}

/** Revenue months before the entry month are ignored. */
export function isOnOrAfterEntry(month: string, entryMonth: string | null | undefined) {
  return !entryMonth || month >= entryMonth;
}

export async function fetchClientEntryMonths(accountId: string): Promise<Record<string, string>> {
  const [clientsRes, contractsRes] = await Promise.all([
    fetchAllRows<any>((from, to) =>
      supabase
        .from("clients")
        .select("id, onboarding_started_at, contract_start_date, created_at")
        .eq("account_id", accountId)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllRows<any>((from, to) =>
      supabase
        .from("client_contracts")
        .select("id, client_id, start_date")
        .eq("account_id", accountId)
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);
  const firstContract: Record<string, string> = {};
  for (const r of (contractsRes.data ?? []) as any[]) {
    if (!r.client_id || !r.start_date) continue;
    if (!firstContract[r.client_id] || r.start_date < firstContract[r.client_id]) firstContract[r.client_id] = r.start_date;
  }
  const out: Record<string, string> = {};
  for (const c of (clientsRes.data ?? []) as any[]) {
    const m = pickEntryMonth({ ...c, first_contract_start: firstContract[c.id] });
    if (m) out[c.id] = m;
  }
  return out;
}
