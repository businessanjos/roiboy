import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MessageRow {
  client_id: string;
  direction: string | null;
  content: string | null;
  sent_at: string;
}

/**
 * Varre as mensagens de WhatsApp das últimas horas e cria, para cada cliente
 * que conversou, um registro em client_checkins com um resumo em uma frase
 * gerado por IA (quem procurou + o que foi pedido).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const body = await req.json().catch(() => ({}));
    const hours = Math.min(Math.max(Number(body?.hours) || 24, 1), 168);
    const clientFilter: string | null = body?.client_id ?? null;

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const since = new Date(Date.now() - hours * 3600_000).toISOString();

    // Conversas individuais (não grupos) já vinculadas a um cliente
    // IMPORTANTE: somente conversas do RoyZapp de Customer Success (setor "operacoes").
    // Conversas do time comercial (setor "vendas") NÃO geram check-in na timeline.
    let convQuery = supabase
      .from("zapp_conversations")
      .select("id, client_id")
      .not("client_id", "is", null)
      .eq("is_group", false)
      .eq("sector_id", "operacoes")
      .gte("last_message_at", since)
      .limit(2000);
    if (clientFilter) convQuery = convQuery.eq("client_id", clientFilter);

    const { data: conversations, error: convErr } = await convQuery;
    if (convErr) throw convErr;

    const convToClient = new Map<string, string>();
    for (const c of (conversations || []) as any[]) convToClient.set(c.id, c.client_id);

    const byClient = new Map<string, MessageRow[]>();
    const convIds = [...convToClient.keys()];

    for (let i = 0; i < convIds.length; i += 100) {
      const chunk = convIds.slice(i, i + 100);
      const { data: messages, error: msgErr } = await supabase
        .from("zapp_messages")
        .select("zapp_conversation_id, direction, content, transcription, sent_at, is_deleted")
        .in("zapp_conversation_id", chunk)
        .gte("sent_at", since)
        .order("sent_at", { ascending: true })
        .limit(5000);
      if (msgErr) throw msgErr;

      for (const m of (messages || []) as any[]) {
        if (m.is_deleted) continue;
        const text: string = (m.content || m.transcription || "").trim();
        if (text.length < 2) continue;
        const clientId = convToClient.get(m.zapp_conversation_id);
        if (!clientId) continue;
        const list = byClient.get(clientId) || [];
        list.push({
          client_id: clientId,
          direction: m.direction === "inbound" ? "client_to_team" : "team_to_client",
          content: text,
          sent_at: m.sent_at,
        });
        byClient.set(clientId, list);
      }
    }

    for (const [k, v] of byClient) {
      v.sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
      byClient.set(k, v);
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [clientId, msgs] of byClient) {
      try {
        const { data: client } = await supabase
          .from("clients")
          .select("id, account_id, full_name")
          .eq("id", clientId)
          .maybeSingle();
        if (!client?.account_id) {
          skipped++;
          continue;
        }

        const lastAt = msgs[msgs.length - 1].sent_at;
        const dayKey = new Date(lastAt).toISOString().slice(0, 10);

        // Evita duplicar o resumo do mesmo dia
        const { data: existing } = await supabase
          .from("client_checkins")
          .select("id")
          .eq("client_id", clientId)
          .eq("source", "ai_whatsapp")
          .gte("happened_at", `${dayKey}T00:00:00Z`)
          .lte("happened_at", `${dayKey}T23:59:59Z`)
          .maybeSingle();
        if (existing) {
          skipped++;
          continue;
        }

        const firstClientMsg = msgs.find((m) => m.direction === "client_to_team");
        const initiatedBy = msgs[0].direction === "client_to_team" || firstClientMsg === msgs[0]
          ? "cliente"
          : "consultor";

        const transcript = msgs
          .slice(-60)
          .map(
            (m) =>
              `${m.direction === "client_to_team" ? "Cliente" : "Consultor"}: ${(m.content || "").slice(0, 400)}`
          )
          .join("\n");

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content:
                  "Você resume conversas de WhatsApp entre um consultor de Customer Success e o cliente de uma mentoria. Responda SEMPRE com UMA única frase em português do Brasil, no máximo 200 caracteres, objetiva, dizendo o que foi pedido ou conversado. Sem emojis, sem aspas, sem prefixos.",
              },
              {
                role: "user",
                content: `Conversa com ${client.full_name}:\n\n${transcript}\n\nResuma em uma frase o que foi pedido/conversado.`,
              },
            ],
          }),
        });

        if (!aiRes.ok) {
          errors.push(`${clientId}: IA ${aiRes.status}`);
          continue;
        }

        const aiJson = await aiRes.json();
        const summary: string = (aiJson?.choices?.[0]?.message?.content || "").trim().slice(0, 300);
        if (!summary) {
          skipped++;
          continue;
        }

        const { error: insErr } = await supabase.from("client_checkins").insert({
          account_id: client.account_id,
          client_id: clientId,
          user_id: null,
          happened_at: lastAt,
          initiated_by: initiatedBy,
          channel: "whatsapp",
          kind: "contato",
          summary,
          source: "ai_whatsapp",
          message_count: msgs.length,
        });
        if (insErr) {
          if (!String(insErr.message).includes("duplicate")) errors.push(`${clientId}: ${insErr.message}`);
          skipped++;
          continue;
        }
        created++;
      } catch (e) {
        errors.push(`${clientId}: ${(e as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, clients: byClient.size, created, skipped, errors: errors.slice(0, 20) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[cs-whatsapp-daily-summary]", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
