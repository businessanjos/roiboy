
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, sectorId } = await req.json();
    
    if (!text || text.trim().length < 10) {
      return new Response(
        JSON.stringify({ correction: null, hasErrors: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Você é um corretor ortográfico e gramatical de português brasileiro.
Sua tarefa é corrigir APENAS erros de:
- Ortografia
- Gramática
- Pontuação
- Acentuação

REGRAS IMPORTANTES:
1. Preserve COMPLETAMENTE o estilo e tom da mensagem
2. NÃO altere abreviações comuns de WhatsApp: vc, tb, pq, blz, tá, né, mt, q, oq, td, cmg, ctg, pra, pro, etc.
3. NÃO adicione ou remova informação
4. NÃO mude a formatação (negrito, itálico, etc.)
5. Se o texto estiver correto, retorne exatamente "SEM_ERROS"
6. Se houver correções, retorne APENAS o texto corrigido, nada mais

Responda apenas com o texto corrigido ou "SEM_ERROS".`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text }
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded", correction: null }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required", correction: null }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const correctedText = data.choices?.[0]?.message?.content?.trim();

    if (!correctedText || correctedText === "SEM_ERROS" || correctedText === text) {
      return new Response(
        JSON.stringify({ correction: null, hasErrors: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        correction: correctedText, 
        hasErrors: true,
        original: text,
        sectorId 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in correct-message:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", correction: null }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
