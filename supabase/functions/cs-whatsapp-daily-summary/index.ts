import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AiBlockedError, brtDayKey, summarizeClientDay } from "../_shared/clientDailySummary.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Rotina noturna: para cada cliente com mensagens nas últimas horas
 * (conversa individual de CS ou grupo vinculado), gera/atualiza 1 resumo
 * por dia de Brasília. Dias sem mensagens não chamam a IA; dias já
 * resumidos sem mensagens novas são pulados.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const hours = Math.min(Math.max(Number(body?.hours) || 24, 1), 168);
    const clientFilter: string | null = body?.client_id ?? null;
    const maxClients = 300;
    const since = new Date(Date.now() - hours * 3600_000).toISOString();

    const clientDays = new Map<string, Set<string>>();
    const add = (cid: string, at: string) => {
      const set = clientDays.get(cid) || new Set<string>();
      set.add(brtDayKey(at));
      // também o dia anterior para fechar o dia que acabou de terminar
      set.add(brtDayKey(new Date(Date.now() - 24 * 3600_000)));
      clientDays.set(cid, set);
    };

    let q = supabase.from("zapp_conversations").select("client_id, last_message_at")
      .not("client_id", "is", null).eq("is_group", false).eq("sector_id", "operacoes")
      .gte("last_message_at", since).limit(2000);
    if (clientFilter) q = q.eq("client_id", clientFilter);
    const { data: indiv, error: e1 } = await q;
    if (e1) throw e1;
    for (const c of indiv || []) add(c.client_id, c.last_message_at);

    const { data: groups, error: e2 } = await supabase.from("zapp_conversations")
      .select("id, last_message_at").eq("is_group", true).gte("last_message_at", since).limit(2000);
    if (e2) throw e2;
    const gIds = (groups || []).map((g: any) => g.id);
    for (let i = 0; i < gIds.length; i += 100) {
      let lq = supabase.from("zapp_group_clients").select("client_id, conversation_id").in("conversation_id", gIds.slice(i, i + 100));
      if (clientFilter) lq = lq.eq("client_id", clientFilter);
      const { data: links } = await lq;
      for (const l of links || []) {
        const g = groups!.find((x: any) => x.id === l.conversation_id);
        if (g) add(l.client_id, g.last_message_at);
      }
    }

    const today = brtDayKey(new Date());
    const counts = { created: 0, updated: 0, unchanged: 0, empty: 0 };
    const errors: string[] = [];
    let paused: string | null = null;
    let processed = 0;

    outer: for (const [clientId, days] of clientDays) {
      if (processed >= maxClients) break;
      processed++;
      for (const day of [...days].sort()) {
        if (day > today) continue;
        try {
          const r = await summarizeClientDay(supabase, LOVABLE_API_KEY, clientId, day);
          counts[r.result]++;
        } catch (e) {
          if (e instanceof AiBlockedError) { paused = e.message; break outer; }
          errors.push(`${clientId}/${day}: ${(e as Error).message}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, clients: clientDays.size, processed, ...counts, paused, errors: errors.slice(0, 20) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[cs-whatsapp-daily-summary]", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
