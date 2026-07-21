const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecentMessage {
  content: string | null;
  is_from_client: boolean;
  sender_name?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, draft, sectorId } = await req.json() as {
      messages: RecentMessage[];
      draft?: string;
      sectorId?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only run for the commercial sector
    if (sectorId && sectorId !== "vendas") {
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only suggest when the last message is from the client (avoids interrupting the agent)
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage?.is_from_client || !lastMessage.content?.trim()) {
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build transcript (last 10 messages)
    const transcript = messages
      .slice(-10)
      .map((m) => {
        const who = m.is_from_client ? "CLIENTE" : "CONSULTOR";
        return `${who}: ${(m.content ?? "").trim()}`;
      })
      .join("\n");

    const systemPrompt = `Você é um assistente de vendas consultivas da Eternum, especializado no mercado brasileiro premium (médicos, dentistas, empresários). Analisa a conversa recente entre CONSULTOR e CLIENTE e propõe 3 respostas curtas, naturais, em português brasileiro, para o CONSULTOR enviar agora ao CLIENTE.

REGRAS:
- 3 sugestões, cada uma entre 1 e 3 frases
- Tom conversacional, humano, sem parecer robô
- Não repita algo que o consultor já disse
- Use SPIN/consultivo: perguntas de descoberta, reforço de valor, quebra de objeção, próximo passo agendado
- Não use emojis excessivos (no máximo 1 quando fizer sentido)
- Se houver rascunho do consultor, refine-o ao invés de ignorar
- Retorne APENAS JSON válido no formato: {"suggestions":["...","...","..."]}`;

    const userPrompt = `Conversa recente:
${transcript}

${draft?.trim() ? `Rascunho atual do consultor (refine): "${draft.trim()}"` : "Sem rascunho ainda."}

Gere 3 sugestões de resposta.`;

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
        response_format: { type: "json_object" },
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
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "";

    let suggestions: string[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.suggestions)) {
        suggestions = parsed.suggestions
          .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
          .slice(0, 3)
          .map((s: string) => s.trim());
      }
    } catch (err) {
      console.error("[suggest-replies] JSON parse failed:", err, raw);
    }

    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[suggest-replies] error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error", suggestions: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
