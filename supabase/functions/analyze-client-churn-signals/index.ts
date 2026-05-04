import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { client_id } = await req.json();
    if (!client_id) {
      return new Response(JSON.stringify({ error: "client_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Cliente + contrato vigente (para contexto)
    const { data: client } = await supabase
      .from("clients")
      .select("id, full_name, phone_e164, additional_phones")
      .eq("id", client_id)
      .maybeSingle();

    const { data: contracts } = await supabase
      .from("client_contracts")
      .select("id, status, start_date, end_date, cancelled_at, cancellation_reason")
      .eq("client_id", client_id)
      .order("start_date", { ascending: false })
      .limit(5);

    // Conversas do cliente
    const { data: conversations } = await supabase
      .from("zapp_conversations")
      .select("id")
      .eq("client_id", client_id)
      .eq("is_group", false);

    const convIds = (conversations || []).map((c: any) => c.id);

    let messages: any[] = [];
    if (convIds.length > 0) {
      const { data: msgs } = await supabase
        .from("zapp_messages")
        .select("id, content, transcription, direction, sent_at, message_type")
        .in("zapp_conversation_id", convIds)
        .or("content.not.is.null,transcription.not.is.null")
        .order("sent_at", { ascending: false })
        .limit(800);
      messages = msgs || [];
    }

    if (messages.length === 0) {
      // Fallback: buscar threads candidatas por nome / telefone do cliente
      const candidates: any[] = [];
      const fullName = (client?.full_name || "").trim();
      const tokens = fullName
        .split(/\s+/)
        .filter((t: string) => t.length >= 4)
        .slice(0, 3);

      // Busca por nome (cada token isoladamente, ILIKE)
      for (const tk of tokens) {
        const { data: byName } = await supabase
          .from("zapp_conversations")
          .select("id, contact_name, phone_e164, last_message_at, client_id, lead_id")
          .ilike("contact_name", `%${tk}%`)
          .is("client_id", null)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(8);
        (byName || []).forEach((r) => {
          if (!candidates.find((c) => c.id === r.id))
            candidates.push({ ...r, match: `nome contém "${tk}"` });
        });
      }

      // Busca por telefone (últimos 8 dígitos)
      const phones = [
        client?.phone_e164,
        ...((client?.additional_phones as string[]) || []),
      ].filter(Boolean);
      for (const ph of phones) {
        const digits = String(ph).replace(/\D/g, "");
        if (digits.length < 8) continue;
        const tail = digits.slice(-8);
        const { data: byPhone } = await supabase
          .from("zapp_conversations")
          .select("id, contact_name, phone_e164, last_message_at, client_id, lead_id")
          .ilike("phone_e164", `%${tail}%`)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(5);
        (byPhone || []).forEach((r) => {
          if (!candidates.find((c) => c.id === r.id))
            candidates.push({ ...r, match: `telefone termina em ${tail}` });
        });
      }

      return new Response(
        JSON.stringify({
          signals: [],
          summary:
            candidates.length > 0
              ? "Não há conversa de WhatsApp vinculada a este cliente, mas encontramos threads candidatas que talvez devam ser associadas."
              : "Nenhuma mensagem de WhatsApp encontrada para este cliente.",
          messages_analyzed: 0,
          overall_risk: "low",
          candidates,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Apenas mensagens do cliente (incoming) + algumas saídas para contexto
    // Para o prompt, ordenamos asc
    const ordered = [...messages].reverse();

    const lines = ordered
      .map((m: any, idx: number) => {
        const text = (m.content || m.transcription || "").replace(/\s+/g, " ").trim();
        if (!text) return null;
        const who = m.direction === "outgoing" ? "EQUIPE" : "CLIENTE";
        const date = m.sent_at ? new Date(m.sent_at).toISOString() : "";
        return `#${idx} [${date}] ${who} (id=${m.id}): ${text.slice(0, 400)}`;
      })
      .filter(Boolean)
      .join("\n");

    const contractContext = (contracts || [])
      .map(
        (c: any) =>
          `- contrato ${c.id} status=${c.status} início=${c.start_date} fim=${c.end_date} cancelado_em=${c.cancelled_at || "—"}`
      )
      .join("\n") || "(nenhum contrato)";

    const systemPrompt = `Você é um analista de retenção (Customer Success) especializado em detectar sinais precoces de churn em conversas de WhatsApp.
Analise as mensagens do cliente e identifique trechos que indiquem risco de cancelamento, insatisfação, dificuldade financeira, intenção de pausar/sair, frustração com resultado, ou perda de engajamento.

Retorne APENAS JSON válido (sem markdown, sem comentários) no formato:
{
  "summary": "Resumo curto (2-4 frases) sobre o estado de risco do cliente.",
  "overall_risk": "low" | "medium" | "high" | "critical",
  "signals": [
    {
      "message_id": "<id da mensagem>",
      "date": "<ISO date>",
      "risk": "low" | "medium" | "high" | "critical",
      "category": "financeiro" | "insatisfacao" | "engajamento" | "intencao_cancelar" | "operacional" | "outro",
      "quote": "trecho curto (até 180 chars) da mensagem",
      "reasoning": "por que isso é um sinal de churn (1-2 frases)"
    }
  ]
}

Regras:
- Liste no máximo 15 sinais, priorizando os de maior risco e mais recentes.
- Apenas mensagens reais do CLIENTE devem virar sinais (ignore EQUIPE como sinal, mas use como contexto).
- Se não houver sinais relevantes, devolva signals vazio e overall_risk "low".
- A "quote" deve ser fiel ao texto original.`;

    const userPrompt = `Cliente: ${client?.full_name || "—"}
Contratos:
${contractContext}

Mensagens (ordem cronológica):
${lines}`;

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      }
    );

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      throw new Error(`AI error ${aiResp.status}: ${t.slice(0, 200)}`);
    }

    const aiData = await aiResp.json();
    const raw = aiData?.choices?.[0]?.message?.content || "{}";

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { summary: raw, signals: [] };
    }

    return new Response(
      JSON.stringify({
        summary: parsed.summary || "",
        overall_risk: parsed.overall_risk || "low",
        signals: Array.isArray(parsed.signals) ? parsed.signals : [],
        messages_analyzed: ordered.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-client-churn-signals error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
