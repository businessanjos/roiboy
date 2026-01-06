import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accountId, sectorId } = await req.json();

    if (!accountId) {
      return new Response(
        JSON.stringify({ error: "accountId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch successful feedback entries (positive feedback + was used)
    let query = supabase
      .from("ai_suggestion_feedback")
      .select("*")
      .eq("account_id", accountId)
      .eq("feedback", "positive")
      .eq("was_used", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (sectorId) {
      query = query.eq("sector_id", sectorId);
    }

    const { data: successfulFeedback, error: feedbackError } = await query;

    if (feedbackError) {
      console.error("Error fetching feedback:", feedbackError);
      throw feedbackError;
    }

    if (!successfulFeedback || successfulFeedback.length < 5) {
      console.log("Not enough feedback data to analyze");
      return new Response(
        JSON.stringify({ message: "Not enough data to analyze", patternsCreated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Group feedback by sector
    const feedbackBySector: Record<string, any[]> = {};
    for (const fb of successfulFeedback) {
      if (!feedbackBySector[fb.sector_id]) {
        feedbackBySector[fb.sector_id] = [];
      }
      feedbackBySector[fb.sector_id].push(fb);
    }

    let totalPatternsCreated = 0;

    // Analyze each sector separately
    for (const [sector, feedbackList] of Object.entries(feedbackBySector)) {
      if (feedbackList.length < 3) continue;

      const systemPrompt = `Você é um analista de comunicação empresarial.
Analise estas mensagens de SUCESSO (feedback positivo + usadas pelo atendente) e extraia padrões de comunicação eficazes.

Para cada padrão identificado, retorne:
{
  "patterns": [
    {
      "pattern_type": "greeting|objection|closing|followup|support|negotiation",
      "trigger_context": "descrição do contexto que dispara esse padrão",
      "effective_response": "a resposta que funcionou bem",
      "why_it_works": "explicação breve de por que funciona"
    }
  ]
}

Foque em:
- Tom de voz (formal, amigável, técnico)
- Estrutura da mensagem
- Palavras-chave que geram engajamento
- Técnicas de persuasão ou resolução

Limite a 5 padrões mais relevantes.
Responda APENAS com o JSON, nada mais.`;

      const userContent = `Mensagens de sucesso do setor ${sector}:
${feedbackList.slice(0, 20).map((fb, i) => 
  `${i + 1}. Sugestão usada: "${fb.suggested_text}"${fb.final_text_sent ? ` (editada para: "${fb.final_text_sent}")` : ""}`
).join("\n")}`;

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
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        console.error("AI gateway error for sector", sector, response.status);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();

      if (!content) continue;

      try {
        // Extract JSON
        let jsonStr = content;
        if (content.includes("```")) {
          const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match) jsonStr = match[1];
        }

        const parsed = JSON.parse(jsonStr);
        const patterns = parsed.patterns || [];

        // Save patterns to database
        for (const pattern of patterns) {
          const { error: insertError } = await supabase
            .from("ai_effective_patterns")
            .insert({
              account_id: accountId,
              sector_id: sector,
              pattern_type: pattern.pattern_type,
              trigger_context: pattern.trigger_context,
              effective_response: pattern.effective_response,
              why_it_works: pattern.why_it_works,
              success_score: 70, // Initial score
              times_used: feedbackList.length,
              positive_outcomes: feedbackList.length,
              is_active: true,
            });

          if (insertError) {
            console.error("Error inserting pattern:", insertError);
          } else {
            totalPatternsCreated++;
          }
        }

        console.log(`Created ${patterns.length} patterns for sector ${sector}`);
      } catch (e) {
        console.error("Error parsing patterns for sector", sector, e);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        patternsCreated: totalPatternsCreated,
        sectorsAnalyzed: Object.keys(feedbackBySector).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-conversation-patterns:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
