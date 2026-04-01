import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CONSULTANT_IDS = [
  "01391bfa-5120-4d43-aedd-93e024c78094",
  "e0017d78-21d4-413a-befc-5197df7ad666",
  "3f3b5466-4479-48f8-bfe4-d9c4281ddab8",
  "81da2302-4770-4fd1-9200-c2a8cb3325f3",
];

const CANCEL_STATUSES = [
  "cancelled",
  "distrato_cancelamento",
  "distrato_demissao",
  "desistencia_7d",
  "dismissed",
  "dropout_7d",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch cancelled contracts
    const { data: contracts, error: contractsError } = await supabase
      .from("client_contracts")
      .select(
        `id, client_id, value, status, cancellation_reason, cancellation_justification,
         cancelled_at, status_changed_at, start_date, end_date,
         client:clients(id, full_name, phone_e164, responsible_user_id),
         product:products(name)`
      )
      .in("status", CANCEL_STATUSES)
      .is("parent_contract_id", null)
      .order("cancelled_at", { ascending: false });

    if (contractsError) throw contractsError;

    // Filter by consultant
    const filteredContracts = (contracts || []).filter((c: any) => {
      return c.client?.responsible_user_id && CONSULTANT_IDS.includes(c.client.responsible_user_id);
    });

    if (filteredContracts.length === 0) {
      return new Response(
        JSON.stringify({ insights: "Nenhum contrato cancelado encontrado para as consultoras filtradas." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get client IDs and fetch conversations + messages
    const clientIds = [...new Set(filteredContracts.map((c: any) => c.client_id))];

    // Fetch conversations linked to these clients
    const { data: conversations } = await supabase
      .from("zapp_conversations")
      .select("id, client_id, contact_name")
      .in("client_id", clientIds)
      .eq("is_group", false);

    const conversationIds = (conversations || []).map((c: any) => c.id);
    const convClientMap: Record<string, string> = {};
    (conversations || []).forEach((c: any) => {
      convClientMap[c.id] = c.client_id;
    });

    // Fetch last 30 messages per conversation (limit total to avoid token overflow)
    let allMessages: any[] = [];
    if (conversationIds.length > 0) {
      // Fetch messages in batches to avoid too large queries
      const batchSize = 50;
      for (let i = 0; i < conversationIds.length; i += batchSize) {
        const batch = conversationIds.slice(i, i + batchSize);
        const { data: msgs } = await supabase
          .from("zapp_messages")
          .select("zapp_conversation_id, content, direction, sent_at, message_type, transcription")
          .in("zapp_conversation_id", batch)
          .not("content", "is", null)
          .order("sent_at", { ascending: false })
          .limit(500);
        if (msgs) allMessages.push(...msgs);
      }
    }

    // Group messages by client
    const messagesByClient: Record<string, any[]> = {};
    allMessages.forEach((m) => {
      const clientId = convClientMap[m.zapp_conversation_id];
      if (clientId) {
        if (!messagesByClient[clientId]) messagesByClient[clientId] = [];
        messagesByClient[clientId].push(m);
      }
    });

    // 3. Fetch followups/timeline
    const { data: followups } = await supabase
      .from("client_followups")
      .select("client_id, content, type, created_at, title")
      .in("client_id", clientIds)
      .order("created_at", { ascending: false })
      .limit(500);

    const followupsByClient: Record<string, any[]> = {};
    (followups || []).forEach((f: any) => {
      if (!followupsByClient[f.client_id]) followupsByClient[f.client_id] = [];
      followupsByClient[f.client_id].push(f);
    });

    // 4. Build summary for AI analysis (limit tokens)
    const clientSummaries = filteredContracts.slice(0, 50).map((contract: any) => {
      const clientId = contract.client_id;
      const clientName = contract.client?.full_name || "Desconhecido";
      const msgs = (messagesByClient[clientId] || []).slice(0, 20);
      const fups = (followupsByClient[clientId] || []).slice(0, 5);

      const messagesSummary = msgs
        .map(
          (m: any) =>
            `[${m.direction === "outgoing" ? "EQUIPE" : "CLIENTE"}] ${m.content || m.transcription || "(mídia)"}`
        )
        .join("\n");

      const followupSummary = fups
        .map((f: any) => `[${f.type}] ${f.title || ""}: ${f.content || ""}`.slice(0, 200))
        .join("\n");

      return `
=== CLIENTE: ${clientName} ===
Produto: ${contract.product?.name || "N/A"}
Valor: R$ ${contract.value}
Início: ${contract.start_date}
Cancelamento: ${contract.cancelled_at || contract.status_changed_at || "N/A"}
Motivo registrado: ${contract.cancellation_reason || "Não informado"}
Justificativa: ${contract.cancellation_justification || "Não informada"}

ÚLTIMAS MENSAGENS WHATSAPP:
${messagesSummary || "(sem mensagens)"}

ANOTAÇÕES/TIMELINE:
${followupSummary || "(sem anotações)"}
`;
    });

    const totalCancelled = filteredContracts.length;
    const totalValue = filteredContracts.reduce((s: number, c: any) => s + (c.value || 0), 0);

    // 5. Send to AI for analysis
    const systemPrompt = `Você é um analista de retenção de clientes especializado em programas de consultoria/mentoria.
Analise os dados de clientes que cancelaram e forneça insights acionáveis.

Responda em português brasileiro (pt-BR).

Estruture sua resposta em EXATAMENTE estas seções (use os emojis e títulos exatos):

🔍 **PADRÕES IDENTIFICADOS**
Liste os 3-5 padrões mais comuns que levaram ao cancelamento.

⚠️ **SINAIS DE ALERTA PRÉ-CHURN**
Quais comportamentos/sinais nas conversas indicavam que o cliente ia cancelar?

💬 **ANÁLISE DE SENTIMENTO**
Como estava o tom das conversas antes do cancelamento? Houve mudança perceptível?

🕐 **TIMING CRÍTICO**
Em que momento do ciclo de vida do cliente o churn é mais provável?

📊 **ANÁLISE POR MOTIVO**
Cruzando os motivos registrados com as conversas reais, os motivos batem? O que está por trás?

🎯 **RECOMENDAÇÕES PRÁTICAS**
5 ações concretas que a equipe pode implementar AGORA para reduzir o churn.

📈 **SCORE DE PREVENIBILIDADE**
De 0 a 100, qual % desses cancelamentos poderiam ter sido evitados com ação proativa? Justifique.`;

    const userPrompt = `DADOS GERAIS:
- Total de cancelamentos analisados: ${totalCancelled}
- Valor total perdido: R$ ${totalValue.toFixed(2)}
- Consultoras: Dayara Grecco, Andréia Barros, Michele Santos, Ana Sant'Anna

DADOS DETALHADOS DOS CLIENTES:
${clientSummaries.join("\n---\n")}

Analise esses dados e forneça insights profundos sobre os padrões de churn.`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          stream: false,
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const insights = aiData.choices?.[0]?.message?.content || "Não foi possível gerar insights.";

    return new Response(
      JSON.stringify({
        insights,
        meta: {
          contractsAnalyzed: totalCancelled,
          clientsWithMessages: Object.keys(messagesByClient).length,
          totalMessages: allMessages.length,
          totalValue,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-churn-conversations error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
