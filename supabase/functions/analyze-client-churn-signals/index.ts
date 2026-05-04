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

    // Eventos de risco (no-show, etc.) — últimos 12 meses
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    const { data: riskEvents } = await supabase
      .from("risk_events")
      .select("source, risk_level, reason, evidence_snippet, happened_at")
      .eq("client_id", client_id)
      .gte("happened_at", since.toISOString())
      .order("happened_at", { ascending: false })
      .limit(30);

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

      // Mesmo sem mensagens, calcular risco com base em contratos e eventos de risco
      const cancelled = (contracts || []).some(
        (c: any) => c.status === "cancelled" || c.cancelled_at
      );
      const noShowCount = (riskEvents || []).filter(
        (r: any) => r.source === "event_no_show"
      ).length;

      let overall: "low" | "medium" | "high" | "critical" = "low";
      const fallbackSignals: any[] = [];
      if (cancelled) {
        overall = "critical";
        const c = (contracts || []).find(
          (x: any) => x.status === "cancelled" || x.cancelled_at
        );
        fallbackSignals.push({
          message_id: `contract:${c?.id}`,
          date: c?.cancelled_at || c?.end_date || new Date().toISOString(),
          risk: "critical",
          category: "intencao_cancelar",
          quote: `Contrato cancelado${c?.cancellation_reason ? `: ${c.cancellation_reason}` : ""}`,
          reasoning: "Cliente já efetivou o cancelamento do contrato.",
        });
      } else if (noShowCount >= 2) {
        overall = "high";
      } else if (noShowCount === 1) {
        overall = "medium";
      }

      (riskEvents || []).slice(0, 10).forEach((r: any) => {
        fallbackSignals.push({
          message_id: `risk_event:${r.happened_at}`,
          date: r.happened_at,
          risk: noShowCount >= 2 ? "high" : "medium",
          category: "engajamento",
          quote: r.reason || "Evento de risco",
          reasoning:
            r.source === "event_no_show"
              ? "Não comparecimento a evento é um forte sinal de desengajamento."
              : "Evento de risco registrado pelo sistema.",
        });
      });

      const summaryParts: string[] = [];
      if (cancelled) summaryParts.push("Cliente possui contrato cancelado.");
      if (noShowCount > 0)
        summaryParts.push(
          `Registrou ${noShowCount} não comparecimento${noShowCount > 1 ? "s" : ""} em eventos.`
        );
      summaryParts.push("Nenhuma mensagem de WhatsApp foi encontrada para análise textual.");

      return new Response(
        JSON.stringify({
          signals: fallbackSignals,
          summary: summaryParts.join(" "),
          messages_analyzed: 0,
          overall_risk: overall,
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
          `- contrato ${c.id} status=${c.status} início=${c.start_date} fim=${c.end_date} cancelado_em=${c.cancelled_at || "—"}${c.cancellation_reason ? ` motivo="${c.cancellation_reason}"` : ""}`
      )
      .join("\n") || "(nenhum contrato)";

    const riskEventsContext = (riskEvents || [])
      .map(
        (r: any) =>
          `- ${r.happened_at} [${r.source}] risco=${r.risk_level} ${r.reason || ""}`
      )
      .join("\n") || "(nenhum evento de risco)";

    const hasCancelled = (contracts || []).some(
      (c: any) => c.status === "cancelled" || c.cancelled_at
    );
    const noShowCount = (riskEvents || []).filter(
      (r: any) => r.source === "event_no_show"
    ).length;

    const systemPrompt = `Você é um analista de retenção (Customer Success) especializado em detectar sinais de churn.
Você recebe (1) mensagens de WhatsApp, (2) status de contratos e (3) eventos de risco (ex.: não comparecimento a eventos).
Analise TUDO em conjunto — não olhe apenas mensagens isoladas — e identifique sinais de risco.

Retorne APENAS JSON válido (sem markdown) no formato:
{
  "summary": "Resumo curto (2-4 frases), mencionando contratos e eventos quando relevantes.",
  "overall_risk": "low" | "medium" | "high" | "critical",
  "signals": [
    {
      "message_id": "<id da mensagem OU 'contract:<id>' OU 'risk_event:<happened_at>'>",
      "date": "<ISO date>",
      "risk": "low" | "medium" | "high" | "critical",
      "category": "financeiro" | "insatisfacao" | "engajamento" | "intencao_cancelar" | "operacional" | "outro",
      "quote": "trecho curto (até 180 chars)",
      "reasoning": "por que isso é um sinal de churn (1-2 frases)"
    }
  ]
}

Regras de calibragem do overall_risk (OBRIGATÓRIAS):
- Contrato cancelado → overall_risk = "critical" e inclua sinal explícito de cancelamento.
- 2+ não comparecimentos a eventos em 90 dias → overall_risk no mínimo "high".
- 1 não comparecimento recente → no mínimo "medium".
- Mensagens engajadas NÃO anulam no-shows nem cancelamentos. Combine sinais de forma conservadora (sempre o pior).
- Inclua eventos (no-show, cancelamento) como sinais — não apenas mensagens.
- Máximo 15 sinais; priorize maior risco e mais recentes. "quote" fiel ao texto/evento original.`;

    const userPrompt = `Cliente: ${client?.full_name || "—"}

Contratos:
${contractContext}

Eventos de risco (últimos 12 meses) — total de não comparecimentos: ${noShowCount}${hasCancelled ? " | CONTRATO CANCELADO" : ""}:
${riskEventsContext}

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

    const result = {
      summary: parsed.summary || "",
      overall_risk: parsed.overall_risk || "low",
      signals: Array.isArray(parsed.signals) ? parsed.signals : [],
      messages_analyzed: ordered.length,
    };

    // Persistir análise (best-effort)
    try {
      // Identificar usuário a partir do token
      let createdBy: string | null = null;
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: userData } = await supabase.auth.getUser(token);
        createdBy = userData?.user?.id ?? null;
      }
      await supabase.from("client_churn_analyses").insert({
        client_id,
        summary: result.summary,
        overall_risk: result.overall_risk,
        signals: result.signals,
        messages_analyzed: result.messages_analyzed,
        created_by: createdBy,
      });
    } catch (persistErr) {
      console.error("Falha ao persistir análise de churn:", persistErr);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-client-churn-signals error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
