import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sector-specific prompts
const sectorPrompts: Record<string, string> = {
  vendas: `Você é um assistente de vendas especializado na metodologia SPIN Selling.

METODOLOGIA SPIN - Aplique conforme a fase da conversa:

**SITUAÇÃO (início da conversa)**
- Faça perguntas para entender o contexto atual do cliente
- Exemplos: "Como funciona hoje...", "Quantas pessoas...", "Há quanto tempo..."
- Use quando: cliente ainda não compartilhou informações sobre sua situação

**PROBLEMA (após entender situação)**
- Identifique dores, dificuldades e desafios
- Exemplos: "Qual o maior desafio...", "O que te impede de...", "Onde está a dificuldade..."
- Use quando: você já sabe a situação mas não identificou os problemas

**IMPLICAÇÃO (após identificar problemas)**
- Explore consequências e impactos dos problemas
- Exemplos: "Quanto isso representa em perdas...", "Como isso afeta...", "Se continuar assim..."
- Use quando: cliente já revelou problemas, hora de criar urgência

**NECESSIDADE (após criar urgência)**
- Faça o cliente visualizar a solução e seus benefícios
- Exemplos: "Se você pudesse resolver isso...", "Qual seria o ganho de...", "Imagina ter..."
- Use quando: cliente entendeu as implicações, pronto para ver a solução

REGRAS:
- Analise as últimas mensagens para identificar em qual fase SPIN está
- Sugira perguntas/respostas adequadas à fase atual
- Progrida naturalmente pelas fases
- Use tom consultivo, não agressivo
- Foque em descobrir necessidades antes de apresentar soluções
- Inclua a fase SPIN atual na resposta`,
  operacoes: `Você é um assistente de atendimento ao cliente. Suas sugestões devem:
- Focar em resolver problemas rapidamente
- Demonstrar empatia e compreensão
- Ser claras e objetivas
- Transmitir profissionalismo e confiança`,
  financas: `Você é um assistente financeiro. Suas sugestões devem:
- Ser claras sobre valores e prazos
- Manter tom profissional mas acolhedor
- Oferecer opções de negociação quando apropriado
- Ser precisas com informações`,
  marketing: `Você é um assistente de marketing. Suas sugestões devem:
- Ser engajantes e criativas
- Promover eventos e campanhas naturalmente
- Usar linguagem atrativa
- Incentivar participação`,
  diretoria: `Você é um assistente executivo. Suas sugestões devem:
- Manter tom formal e profissional
- Ser concisas e diretas
- Demonstrar autoridade e conhecimento
- Focar em relacionamento estratégico`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, clientName, sectorId, accountId, customPrompt } = await req.json();

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch effective patterns for this sector
    let effectivePatterns: any[] = [];
    if (accountId && sectorId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: patterns } = await supabase
          .from("ai_effective_patterns")
          .select("pattern_type, trigger_context, effective_response, success_score")
          .eq("account_id", accountId)
          .eq("sector_id", sectorId)
          .eq("is_active", true)
          .order("success_score", { ascending: false })
          .limit(5);

        if (patterns) {
          effectivePatterns = patterns;
        }
      } catch (e) {
        console.error("Error fetching patterns:", e);
      }
    }

    // Build context from messages
    const recentMessages = messages.slice(-5).map((m: any) => ({
      from: m.is_from_client ? (clientName || "Cliente") : "Você",
      content: m.content,
    }));

    // Build the system prompt
    const sectorSpecific = sectorPrompts[sectorId] || sectorPrompts.operacoes;
    
    let patternsContext = "";
    if (effectivePatterns.length > 0) {
      patternsContext = `\n\nPADRÕES DE SUCESSO ANTERIORES (use como inspiração):
${effectivePatterns.map((p, i) => `${i + 1}. [${p.pattern_type}] "${p.effective_response}"`).join("\n")}`;
    }

    const systemPrompt = `${sectorSpecific}

${customPrompt || ""}

Gere 2-3 sugestões de resposta curtas e naturais para a próxima mensagem.
As respostas devem ser em português brasileiro e soar naturais para WhatsApp.
Cada sugestão deve ter no máximo 150 caracteres.
${patternsContext}

FORMATO DE RESPOSTA (JSON):
{
  "current_spin_phase": "situation|problem|implication|need|closing" (apenas para setor vendas, baseado na análise da conversa),
  "suggestions": [
    { "text": "sugestão 1", "type": "situation|problem|implication|need|closing|objection|greeting|followup|support" },
    { "text": "sugestão 2", "type": "..." }
  ]
}

Responda APENAS com o JSON, nada mais.`;

    const userContent = `Contexto da conversa com ${clientName || "cliente"}:
${recentMessages.map((m: any) => `${m.from}: ${m.content}`).join("\n")}

Gere sugestões de resposta:`;

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
          { role: "user", content: userContent }
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded", suggestions: [] }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required", suggestions: [] }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse JSON response
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = content;
      if (content.includes("```")) {
        const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) jsonStr = match[1];
      }
      
      const parsed = JSON.parse(jsonStr);
      const suggestions = parsed.suggestions || [];
      const currentSpinPhase = parsed.current_spin_phase || null;

      return new Response(
        JSON.stringify({ 
          suggestions: suggestions.map((s: any, i: number) => ({
            id: `suggestion-${Date.now()}-${i}`,
            text: s.text,
            type: s.type || "general",
          })),
          sectorId,
          currentSpinPhase,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (e) {
      console.error("Error parsing suggestions:", e, content);
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error in suggest-replies:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", suggestions: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
