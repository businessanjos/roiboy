import { useQuery } from "@tanstack/react-query";
import { subMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { clientScopeIds, clientScopeKey } from "@/lib/dashboard/clientScope";

export interface WonToOnboardingStats {
  avg_days: number | null;
  median_days: number | null;
  sample_count: number;
  min_days: number | null;
  max_days: number | null;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Percentil 0.5 (PERCENTILE_CONT) com interpolação linear, como no banco. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor((sorted.length - 1) / 2);
  const frac = (sorted.length - 1) % 2;
  return frac === 0 ? sorted[mid] : (sorted[mid] + sorted[mid + 1]) / 2;
}

/**
 * Tempo médio entre fechar o negócio e iniciar o onboarding.
 *
 * Sem escopo, usa a função do banco. Com `clientIds` (filtro de formação),
 * refaz o mesmo cálculo apenas para os clientes do escopo: primeiro negócio
 * ganho de cada cliente dentro da janela, comparado com a data de início do
 * onboarding do cadastro.
 */
export function useWonToOnboardingTime(
  accountId?: string,
  monthsBack: number = 6,
  clientIds?: string[] | null,
) {
  return useQuery({
    queryKey: ["won-to-onboarding-time", accountId, monthsBack, clientScopeKey(clientIds)],
    enabled: !!accountId,
    queryFn: async (): Promise<WonToOnboardingStats> => {
      const scope = clientScopeIds(clientIds);

      if (scope) {
        const cutoff = subMonths(new Date(), monthsBack).toISOString();

        const { data: dealRows, error: dealsError } = await fetchAllRows<{
          client_id: string;
          won_at: string;
        }>((from, to) =>
          supabase
            .from("deals")
            .select("client_id, won_at")
            .eq("account_id", accountId!)
            .eq("status", "won")
            .not("client_id", "is", null)
            .not("won_at", "is", null)
            .gte("won_at", cutoff)
            .order("id", { ascending: true })
            .range(from, to),
        );
        if (dealsError) throw dealsError;

        // Primeiro negócio ganho por cliente dentro da janela, só no escopo.
        const firstWon = new Map<string, number>();
        for (const deal of dealRows || []) {
          if (!scope.has(deal.client_id)) continue;
          const wonMs = new Date(deal.won_at).getTime();
          const current = firstWon.get(deal.client_id);
          if (current === undefined || wonMs < current) firstWon.set(deal.client_id, wonMs);
        }

        const clientIdsInScope = Array.from(firstWon.keys());
        const entryById = new Map<string, number>();
        for (let i = 0; i < clientIdsInScope.length; i += 200) {
          const batch = clientIdsInScope.slice(i, i + 200);
          const { data, error } = await supabase
            .from("clients")
            .select("id, onboarding_started_at")
            .in("id", batch)
            .not("onboarding_started_at", "is", null);
          if (error) throw error;
          for (const client of data || []) {
            if (client.onboarding_started_at) {
              entryById.set(client.id, new Date(client.onboarding_started_at).getTime());
            }
          }
        }

        const days: number[] = [];
        for (const [clientId, wonMs] of firstWon.entries()) {
          const entryMs = entryById.get(clientId);
          if (entryMs === undefined || entryMs < wonMs) continue;
          days.push((entryMs - wonMs) / 86400000);
        }

        return {
          avg_days: days.length ? round2(days.reduce((sum, d) => sum + d, 0) / days.length) : null,
          median_days: days.length ? round2(median(days)!) : null,
          sample_count: days.length,
          min_days: days.length ? round2(Math.min(...days)) : null,
          max_days: days.length ? round2(Math.max(...days)) : null,
        };
      }

      const { data, error } = await (supabase.rpc as any)("get_avg_won_to_onboarding_days", {
        p_account_id: accountId!,
        p_months_back: monthsBack,
      });
      if (error) throw error;
      const row = (data as any[])?.[0];
      return {
        avg_days: row?.avg_days != null ? Number(row.avg_days) : null,
        median_days: row?.median_days != null ? Number(row.median_days) : null,
        sample_count: row?.sample_count ?? 0,
        min_days: row?.min_days != null ? Number(row.min_days) : null,
        max_days: row?.max_days != null ? Number(row.max_days) : null,
      };
    },
  });
}
