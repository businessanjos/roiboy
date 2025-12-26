import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticketId, subject, createdAt, updatedAt, currentStatus, firstResponseAt } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const now = new Date();
    const createdDate = new Date(createdAt);
    const updatedDate = new Date(updatedAt);
    const hoursSinceCreated = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60));
    const hoursSinceUpdate = Math.floor((now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60));

    const systemPrompt = `Você é um assistente especializado em análise de tickets de suporte ao cliente.
Sua tarefa é analisar o ticket e sugerir o status mais apropriado.

Os status disponíveis são:
- "open": Conversa iniciada pelo cliente, aguardando primeira resposta da equipe
- "needs_attention": Cliente sem resposta há mais de 24 horas OU situação urgente
- "in_progress": Equipe já respondeu e está aguardando retorno do cliente
- "resolved": Solicitação foi atendida com sucesso

Regras de decisão:
1. Se não houve primeira resposta (first_response_at = null) E passou mais de 24h → needs_attention
2. Se houve resposta mas cliente não retornou há mais de 48h e parece resolvido → resolved
3. Se houve resposta e aguardando cliente → in_progress
4. Se é uma situação urgente baseada no assunto (cancelamento, problema grave) → needs_attention
5. Ticket recém-criado (< 24h) sem resposta → open`;

    const userPrompt = `Analise este ticket de suporte:

Assunto: ${subject || "Não informado"}
Status atual: ${currentStatus}
Criado há: ${hoursSinceCreated} horas
Última atualização há: ${hoursSinceUpdate} horas
Primeira resposta da equipe: ${firstResponseAt ? "Sim" : "Não"}

Qual deve ser o status deste ticket? Responda APENAS com uma das opções: open, needs_attention, in_progress, resolved`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        max_tokens: 50,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content?.trim().toLowerCase() || "";
    
    // Extract status from AI response
    let suggestedStatus = currentStatus;
    if (aiResponse.includes("needs_attention")) {
      suggestedStatus = "needs_attention";
    } else if (aiResponse.includes("in_progress")) {
      suggestedStatus = "in_progress";
    } else if (aiResponse.includes("resolved")) {
      suggestedStatus = "resolved";
    } else if (aiResponse.includes("open")) {
      suggestedStatus = "open";
    }

    console.log(`Ticket ${ticketId}: AI suggested ${suggestedStatus} (was ${currentStatus})`);

    return new Response(
      JSON.stringify({ 
        suggestedStatus,
        reasoning: aiResponse,
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Error analyzing ticket:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
