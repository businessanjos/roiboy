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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = new Date().toISOString();
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Busca clientes com contrato ativo de Eternum Club que tenham Instagram
    const { data: contracts, error: contractsError } = await supabase
      .from("client_contracts")
      .select("client_id, status, product_id, end_date")
      .in("product_id", ETERNUM_CLUB_PRODUCT_IDS)
      .in("status", ACTIVE_CONTRACT_STATUSES);

    if (contractsError) throw contractsError;

    const clientIds = Array.from(new Set((contracts || []).map((c) => c.client_id).filter(Boolean)));
    if (clientIds.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "Nenhum cliente ativo de Eternum Club encontrado.", processed: 0, startedAt }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, name, instagram, instagrams")
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
        targets.push({ clientId: c.id, username: u, clientName: c.name || "" });
      }
    }

    const results: Array<{ clientId: string; username: string; ok: boolean; error?: string }> = [];
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
          results.push({ clientId: t.clientId, username: t.username, ok: false, error: `${res.status}: ${txt.slice(0, 200)}` });
        } else {
          results.push({ clientId: t.clientId, username: t.username, ok: true });
        }
      } catch (e: any) {
        results.push({ clientId: t.clientId, username: t.username, ok: false, error: String(e?.message || e) });
      }
      // Pequeno delay para não saturar HikerAPI
      await new Promise((r) => setTimeout(r, 800));
    }

    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.length - okCount;

    return new Response(
      JSON.stringify({
        ok: true,
        startedAt,
        finishedAt: new Date().toISOString(),
        clientsTargeted: clientIds.length,
        accountsProcessed: results.length,
        okCount,
        failCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[sync-eternum-club-instagram] error", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message || e), startedAt }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
