// Sincronização diária do Instagram dos clientes com contrato ativo de Eternum Club
// Disparada por cron job às 11h UTC (08h BRT). Pode ser invocada manualmente também.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Eternum Club + Ren. Eternum Club
const ETERNUM_CLUB_PRODUCT_IDS = [
  "b8c50eca-6fd9-41ac-a1d3-f78086daaea7",
  "6f74bb43-a1be-410f-a708-6abab066bb38",
];

const ACTIVE_CONTRACT_STATUSES = ["active", "ativo", "renewed", "renovado"];

async function runSync(startedAt: string) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const { data: contracts, error: contractsError } = await supabase
      .from("client_contracts")
      .select("client_id, status, product_id, end_date")
      .in("product_id", ETERNUM_CLUB_PRODUCT_IDS)
      .in("status", ACTIVE_CONTRACT_STATUSES);
    if (contractsError) throw contractsError;

    const clientIds = Array.from(new Set((contracts || []).map((c) => c.client_id).filter(Boolean)));
    if (clientIds.length === 0) {
      console.log("[sync-eternum-club-instagram] no active clients", { startedAt });
      return;
    }

    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, full_name, instagram, instagrams")
      .in("id", clientIds);
    if (clientsError) throw clientsError;

    const targets: Array<{ clientId: string; username: string; clientName: string }> = [];
    for (const c of clients || []) {
      const handles: string[] = [];
      if (c.instagram) handles.push(String(c.instagram));
      if (Array.isArray(c.instagrams)) handles.push(...c.instagrams.map((x: any) => String(x)));
      const cleaned = handles
        .map((h) => h.trim().replace(/^@/, "").toLowerCase())
        .filter((h) => h.length > 0);
      const unique = Array.from(new Set(cleaned));
      for (const u of unique) {
        targets.push({ clientId: c.id, username: u, clientName: c.full_name || "" });
      }
    }

    let okCount = 0;
    let failCount = 0;
    for (const t of targets) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/instagram-public-snapshot`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE}`,
          },
          body: JSON.stringify({ username: t.username, clientId: t.clientId }),
        });
        if (!res.ok) {
          const txt = await res.text();
          failCount++;
          console.warn(`[sync-eternum-club-instagram] fail ${t.username}: ${res.status} ${txt.slice(0, 200)}`);
        } else {
          okCount++;
        }
      } catch (e: any) {
        failCount++;
        console.warn(`[sync-eternum-club-instagram] error ${t.username}:`, e?.message || e);
      }
      await new Promise((r) => setTimeout(r, 800));
    }

    console.log("[sync-eternum-club-instagram] done", {
      startedAt,
      finishedAt: new Date().toISOString(),
      clientsTargeted: clientIds.length,
      accountsProcessed: targets.length,
      okCount,
      failCount,
    });
  } catch (e: any) {
    console.error("[sync-eternum-club-instagram] fatal", e);
  }
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = new Date().toISOString();
  // Executa em background para não estourar o timeout de 150s do edge runtime.
  // @ts-ignore EdgeRuntime is provided by Supabase
  EdgeRuntime.waitUntil(runSync(startedAt));

  return new Response(
    JSON.stringify({
      ok: true,
      queued: true,
      startedAt,
      message: "Sincronização iniciada em background. Acompanhe nos logs da função.",
    }),
    { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
