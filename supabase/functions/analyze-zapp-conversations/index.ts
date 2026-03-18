import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agent_id, start_date, end_date, analysis_type } = await req.json();

    if (!agent_id) {
      return new Response(
        JSON.stringify({ error: "agent_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch assignments for this agent in the date range
    let assignmentsQuery = supabase
      .from("zapp_conversation_assignments")
      .select("id, zapp_conversation_id, first_message_at, first_response_at, last_client_message_at, assigned_at, closed_at, close_outcome, close_ai_summary, service_duration_minutes, status")
      .eq("agent_id", agent_id)
      .order("created_at", { ascending: false });

    if (start_date) {
      assignmentsQuery = assignmentsQuery.gte("created_at", start_date);
    }
    if (end_date) {
      assignmentsQuery = assignmentsQuery.lte("created_at", end_date);
    }

    const { data: assignments, error: assignmentsError } = await assignmentsQuery.limit(200);

    if (assignmentsError) {
      console.error("Error fetching assignments:", assignmentsError);
      throw new Error("Erro ao buscar atendimentos");
    }

    if (!assignments || assignments.length === 0) {
      return new Response(
        JSON.stringify({ 
          metrics: { total: 0, avg_response_time_min: 0, conversations_analyzed: 0 },
          ai_analysis: null 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Calculate response time metrics
    const responseTimes: number[] = [];
    const outcomes: Record<string, number> = {};
    let totalDuration = 0;
    let durationCount = 0;

    for (const a of assignments) {
      // Response time calculation
      if (a.first_message_at && a.first_response_at) {
        const diff = (new Date(a.first_response_at).getTime() - new Date(a.first_message_at).getTime()) / 60000;
        if (diff >= 0 && diff < 1440) { // Ignore outliers > 24h
          responseTimes.push(diff);
        }
      }

      // Outcomes
      const outcome = a.close_outcome || (a.status === "closed" ? "fechado_sem_resultado" : "em_aberto");
      outcomes[outcome] = (outcomes[outcome] || 0) + 1;

      // Duration
      if (a.service_duration_minutes && a.service_duration_minutes > 0) {
        totalDuration += a.service_duration_minutes;
        durationCount++;
      }
    }

    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    const medianResponseTime = sortedTimes.length > 0
      ? sortedTimes[Math.floor(sortedTimes.length / 2)]
      : 0;
    const p90ResponseTime = sortedTimes.length > 0
      ? sortedTimes[Math.floor(sortedTimes.length * 0.9)]
      : 0;

    // Count fast vs slow responses
    const fastResponses = responseTimes.filter(t => t <= 5).length;
    const slowResponses = responseTimes.filter(t => t > 30).length;

    const metrics = {
      total: assignments.length,
      with_response_data: responseTimes.length,
      avg_response_time_min: Math.round(avgResponseTime * 10) / 10,
      median_response_time_min: Math.round(medianResponseTime * 10) / 10,
      p90_response_time_min: Math.round(p90ResponseTime * 10) / 10,
      fast_responses_pct: responseTimes.length > 0 ? Math.round((fastResponses / responseTimes.length) * 100) : 0,
      slow_responses_pct: responseTimes.length > 0 ? Math.round((slowResponses / responseTimes.length) * 100) : 0,
      avg_duration_min: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
      outcomes,
      closed_count: assignments.filter(a => a.status === "closed").length,
      open_count: assignments.filter(a => a.status !== "closed").length,
    };

    // 3. If AI analysis is requested, fetch messages and analyze
    let aiAnalysis = null;

    if (analysis_type === "full" || analysis_type === "objections" || analysis_type === "quality") {
      // Get conversation IDs
      const convIds = assignments
        .filter(a => a.zapp_conversation_id)
        .slice(0, 20) // Limit to 20 most recent conversations
        .map(a => a.zapp_conversation_id!);

      if (convIds.length > 0) {
        // Fetch messages from these conversations
        const { data: messages, error: messagesError } = await supabase
          .from("zapp_messages")
          .select("content, direction, sender_name, created_at, message_type, zapp_conversation_id")
          .in("zapp_conversation_id", convIds)
          .eq("message_type", "text")
          .not("content", "is", null)
          .order("created_at", { ascending: true })
          .limit(500);

        if (messagesError) {
          console.error("Error fetching messages:", messagesError);
        }

        if (messages && messages.length > 0) {
          // Group messages by conversation
          const convMap: Record<string, string[]> = {};
          for (const m of messages) {
            if (!convMap[m.zapp_conversation_id]) convMap[m.zapp_conversation_id] = [];
            const sender = m.direction === "inbound" ? (m.sender_name || "Lead") : "Vendedor";
            convMap[m.zapp_conversation_id].push(`${sender}: ${m.content}`);
          }

          // Build conversation samples for AI
          const samples = Object.entries(convMap)
            .slice(0, 15)
            .map(([id, msgs], i) => {
              const assignment = assignments.find(a => a.zapp_conversation_id === id);
              const outcome = assignment?.close_outcome || "sem resultado definido";
              return `--- Conversa ${i + 1} (Resultado: ${outcome}) ---\n${msgs.slice(-20).join("\n")}`;
            })
            .join("\n\n");

          const systemPrompt = `Você é um consultor especialista em vendas por WhatsApp. Analise as conversas abaixo de um vendedor e gere um relatório detalhado em português brasileiro.

ESTRUTURA OBRIGATÓRIA:

## 🔍 Objeções Mais Frequentes
Liste as TOP 5 objeções que os leads apresentaram, com:
- A objeção exata (citação)
- Frequência (em quantas conversas apareceu)
- Como o vendedor respondeu (ou não)
- Sugestão de rebatimento eficaz

## 📊 Qualidade do Atendimento (Nota 0-10)
Avalie cada critério:
- **Tempo de abordagem**: Quão rápido o vendedor engaja
- **Personalização**: Se usa nome, contexto do lead
- **Técnica de vendas**: SPIN, rapport, urgência, etc.
- **Follow-up**: Se acompanha leads que não responderam
- **Fechamento**: Se faz tentativas claras de fechar

## ⚠️ Padrões Problemáticos
Comportamentos repetitivos que prejudicam as vendas:
- Mensagens genéricas demais
- Falta de follow-up
- Demora na resposta
- Erros de comunicação

## ✅ Pontos Fortes
O que o vendedor faz bem e deve manter.

## 🎯 Plano de Ação (Top 5)
Ações práticas e específicas para melhorar os resultados.

IMPORTANTE: Baseie-se APENAS nas conversas reais. Cite trechos quando possível.`;

          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Analise estas ${Object.keys(convMap).length} conversas do vendedor:\n\n${samples}` },
              ],
              max_tokens: 4000,
            }),
          });

          if (!aiResponse.ok) {
            if (aiResponse.status === 429) {
              return new Response(
                JSON.stringify({ metrics, ai_analysis: null, error: "Limite de requisições IA excedido. Tente em alguns minutos." }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            if (aiResponse.status === 402) {
              return new Response(
                JSON.stringify({ metrics, ai_analysis: null, error: "Créditos de IA esgotados." }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            const errorText = await aiResponse.text();
            console.error("AI error:", aiResponse.status, errorText);
          } else {
            const aiData = await aiResponse.json();
            aiAnalysis = aiData.choices?.[0]?.message?.content || null;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ metrics, ai_analysis: aiAnalysis, conversations_count: assignments.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-zapp-conversations error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
