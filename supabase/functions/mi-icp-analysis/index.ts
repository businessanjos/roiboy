import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateRequest,
  unauthorizedResponse,
} from "../_shared/api-key-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-account-id, x-session-token",
};

// Regiões brasileiras
const REGIONS: Record<string, string> = {
  AC: "Norte", AP: "Norte", AM: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
  PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};

const TICKET_BANDS = [
  { label: "Até R$ 20k", max: 20000 },
  { label: "R$ 20k - R$ 50k", max: 50000 },
  { label: "R$ 50k - R$ 100k", max: 100000 },
  { label: "R$ 100k - R$ 200k", max: 200000 },
  { label: "Acima de R$ 200k", max: Infinity },
];

function ticketBand(v: number) {
  return TICKET_BANDS.find((b) => v <= b.max)?.label ?? "N/D";
}

type Row = {
  client_id: string;
  city: string | null;
  state: string | null;
  country: string | null;
  gender: string | null;
  education: string | null;
  education_specialty: string | null;
  initial_revenue: number | null;
  current_revenue: number | null;
  product: string | null;
  product_color: string | null;
  value: number | null;
  start_date: string | null;
  end_date: string | null;
  cancelled_at: string | null;
  status: string;
  cancellation_reason: string | null;
};

function distributionOf<T>(rows: T[], key: (r: T) => string | null | undefined, topN = 10) {
  const map = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
    total++;
  }
  const arr = Array.from(map, ([label, count]) => ({
    label,
    count,
    pct: total ? Math.round((count / total) * 1000) / 10 : 0,
  }));
  arr.sort((a, b) => b.count - a.count);
  return { total, items: arr.slice(0, topN) };
}

function avg(nums: number[]) {
  const v = nums.filter((n) => Number.isFinite(n));
  if (!v.length) return 0;
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
}

function median(nums: number[]) {
  const v = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return 0;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
}

function daysBetween(a: string | null, b: string | null) {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let auth = await authenticateRequest(req, supabase);
    if (!auth.authenticated) {
      const accountId = req.headers.get("x-account-id");
      const sessionToken = req.headers.get("x-session-token");
      if (accountId && sessionToken) {
        const { data: user } = await supabase
          .from("users")
          .select("id, account_id")
          .eq("account_id", accountId)
          .eq("id", sessionToken)
          .single();
        if (user) {
          auth = {
            authenticated: true,
            userId: user.id,
            accountId: user.account_id,
            method: "jwt",
          };
        }
      }
    }
    if (!auth.authenticated) return unauthorizedResponse(corsHeaders, auth.error);

    const accountId = auth.accountId!;

    // Buscar contratos com clientes e produtos
    const { data: contracts, error: contractsError } = await supabase
      .from("client_contracts")
      .select(
        `id, client_id, status, start_date, end_date, cancelled_at, value,
         cancellation_reason,
         product:products(name, color),
         client:clients(city, state, country, gender, education, education_specialty,
           initial_revenue, current_revenue, status)`
      )
      .eq("account_id", accountId);

    if (contractsError) throw contractsError;

    const activeStatuses = new Set(["active", "paused", "suspended", "suspended_bonus"]);
    const churnedStatuses = new Set([
      "cancelled", "dismissed", "dropout_7d", "dismissal_termination", "ended",
    ]);

    const rows: Row[] = (contracts ?? []).map((c: any) => ({
      client_id: c.client_id,
      city: c.client?.city ?? null,
      state: c.client?.state ?? null,
      country: c.client?.country ?? null,
      gender: c.client?.gender ?? null,
      education: c.client?.education ?? null,
      education_specialty: c.client?.education_specialty ?? null,
      initial_revenue: c.client?.initial_revenue ?? null,
      current_revenue: c.client?.current_revenue ?? null,
      product: c.product?.name ?? null,
      product_color: c.product?.color ?? null,
      value: c.value != null ? Number(c.value) : null,
      start_date: c.start_date,
      end_date: c.end_date,
      cancelled_at: c.cancelled_at,
      status: c.status,
      cancellation_reason: c.cancellation_reason,
    }));

    const active = rows.filter((r) => activeStatuses.has(r.status));
    const churned = rows.filter((r) => churnedStatuses.has(r.status));

    // Distinct clients for headline counts
    const activeClientIds = new Set(active.map((r) => r.client_id));
    const churnedClientIds = new Set(
      churned.filter((r) => !activeClientIds.has(r.client_id)).map((r) => r.client_id)
    );

    const buildProfile = (list: Row[]) => {
      const values = list.map((r) => r.value ?? 0).filter((v) => v > 0);
      const tenures = list
        .map((r) => daysBetween(r.start_date, r.cancelled_at ?? r.end_date ?? new Date().toISOString()))
        .filter((v): v is number => v != null && v >= 0);

      return {
        headcount: list.length,
        avgTicket: avg(values),
        medianTicket: median(values),
        totalValue: values.reduce((a, b) => a + b, 0),
        avgTenureDays: avg(tenures),
        medianTenureDays: median(tenures),
        byProduct: distributionOf(list, (r) => r.product, 10),
        byRegion: distributionOf(list, (r) => (r.state ? REGIONS[r.state] : null), 10),
        byState: distributionOf(list, (r) => r.state, 15),
        byCity: distributionOf(list, (r) => (r.city ? `${r.city} / ${r.state ?? "?"}` : null), 15),
        byCountry: distributionOf(list, (r) => r.country || "Brasil", 10),
        byGender: distributionOf(list, (r) => r.gender, 5),
        byEducation: distributionOf(list, (r) => r.education, 10),
        bySpecialty: distributionOf(list, (r) => r.education_specialty, 10),
        byTicketBand: distributionOf(
          list,
          (r) => (r.value != null && r.value > 0 ? ticketBand(r.value) : null),
          10
        ),
        byCancellationReason: distributionOf(list, (r) => r.cancellation_reason, 10),
      };
    };

    const icp = buildProfile(active);
    const antiIcp = buildProfile(churned);

    // Comparativo: features onde churned diverge de active (sinais de risco)
    const riskSignals: Array<{
      dimension: string;
      label: string;
      activePct: number;
      churnPct: number;
      delta: number;
    }> = [];

    const compare = (dim: string, aDist: any, cDist: any) => {
      const aMap = new Map(aDist.items.map((i: any) => [i.label, i.pct]));
      for (const item of cDist.items) {
        const aPct = (aMap.get(item.label) as number) ?? 0;
        const delta = Math.round((item.pct - aPct) * 10) / 10;
        if (Math.abs(delta) >= 3 && item.count >= 3) {
          riskSignals.push({
            dimension: dim,
            label: item.label,
            activePct: aPct,
            churnPct: item.pct,
            delta,
          });
        }
      }
    };
    compare("Produto", icp.byProduct, antiIcp.byProduct);
    compare("Região", icp.byRegion, antiIcp.byRegion);
    compare("Estado", icp.byState, antiIcp.byState);
    compare("Faixa de ticket", icp.byTicketBand, antiIcp.byTicketBand);
    riskSignals.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    // Cobertura de dados
    const totalClientsSampled = new Set(rows.map((r) => r.client_id)).size;
    const coverage = {
      total_clients_sampled: totalClientsSampled,
      with_city: active.filter((r) => r.city).length,
      with_state: active.filter((r) => r.state).length,
      with_gender: active.filter((r) => r.gender).length,
      with_specialty: active.filter((r) => r.education_specialty).length,
      with_revenue: active.filter((r) => r.initial_revenue || r.current_revenue).length,
    };

    return new Response(
      JSON.stringify({
        generated_at: new Date().toISOString(),
        summary: {
          active_clients: activeClientIds.size,
          churned_clients: churnedClientIds.size,
          churn_rate:
            activeClientIds.size + churnedClientIds.size > 0
              ? Math.round(
                  (churnedClientIds.size /
                    (activeClientIds.size + churnedClientIds.size)) *
                    1000
                ) / 10
              : 0,
        },
        icp,
        antiIcp,
        riskSignals: riskSignals.slice(0, 20),
        coverage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    console.error("mi-icp-analysis error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
