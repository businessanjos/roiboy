const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript } = await req.json();

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: "transcript é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Você é um especialista em vendas e coaching comercial. Analise a transcrição de uma call de vendas e retorne uma análise COMPLETA e DETALHADA em português brasileiro.

ESTRUTURA OBRIGATÓRIA DA ANÁLISE:

## 📊 Resumo Geral
- Duração estimada da call
- Resultado (venda fechada, follow-up, perdida, etc.)
- Nota geral do vendedor (0-10)

## 🚫 Objeções Identificadas
Para CADA objeção encontrada:
- **Objeção:** O que o lead disse
- **Momento:** Em que contexto surgiu
- **Como o vendedor reagiu:** O que fez (ou não fez)
- **Rebatimento sugerido:** Como deveria ter respondido

## ❌ Erros do Vendedor
Liste TODOS os erros identificados com descrição, problema e solução.

## ✅ Pontos Fortes
O que o vendedor fez bem.

## 🎯 Diagnóstico de Perdas
- Por que a venda não avançou
- Principal gap de habilidade
- Nível de preparo (1-10)

## 📝 Script Melhorado
Reescreva as partes mais críticas como deveriam ter sido conduzidas.

## 🔑 Top 3 Ações Imediatas
Ações práticas e específicas para a próxima call.

IMPORTANTE: Seja DIRETO e ESPECÍFICO. Use exemplos reais da transcrição.`;

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
          { role: "user", content: `Analise esta transcrição de call de vendas:\n\n${transcript}` },
        ],
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("Erro ao processar análise com IA");
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "Não foi possível gerar a análise.";

    // Second pass: extract structured ICP signals via tool calling.
    // Best-effort — if it fails, we still return the analysis.
    let icp_signals: Record<string, unknown> | null = null;
    try {
      const icpResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: "Você extrai sinais de ICP de uma transcrição de call de vendas. Retorne SEMPRE em português, conciso e factual. Quando não houver evidência, retorne null ou array vazio — NUNCA invente. Para 'niche_combined' SEMPRE construa profissão + área (ex: 'Médico que atua com emagrecimento', 'Biomédica que atua com harmonização facial') quando houver pelo menos uma pista de profissão E de área." },
            { role: "user", content: `Transcrição da call:\n\n${transcript.substring(0, 14000)}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "save_icp_signals",
              description: "Salva sinais de ICP extraídos da call.",
              parameters: {
                type: "object",
                properties: {
                  profession: { type: ["string", "null"], description: "Profissão principal (ex: Médico, Dentista, Biomédica, Empresário)" },
                  specialty: { type: ["string", "null"], description: "Especialidade/área de atuação (ex: Emagrecimento, Harmonização facial)" },
                  niche_combined: { type: ["string", "null"], description: "Profissão + especialidade em uma frase (ex: 'Médico que atua com emagrecimento')" },
                  business_model: { type: ["string", "null"], description: "Modelo de negócio (ex: Clínica própria, Consultório alugado, E-commerce)" },
                  team_size: { type: ["string", "null"] },
                  revenue_range: { type: ["string", "null"], description: "Faixa de faturamento mensal mencionada" },
                  ticket_range: { type: ["string", "null"], description: "Ticket médio que o lead pratica com clientes" },
                  decision_role: { type: ["string", "null"] },
                  main_pains: { type: "array", items: { type: "string" } },
                  main_objections: { type: "array", items: { type: "string" } },
                  triggers_that_worked: { type: "array", items: { type: "string" } },
                  city: { type: ["string", "null"] },
                  state: { type: ["string", "null"] },
                  age_estimate: { type: ["string", "null"] },
                },
                required: ["profession", "specialty", "niche_combined", "main_pains", "main_objections"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "save_icp_signals" } },
        }),
      });
      if (icpResp.ok) {
        const icpData = await icpResp.json();
        const argsStr = icpData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (argsStr) icp_signals = JSON.parse(argsStr);
      } else {
        console.warn("ICP extraction non-ok:", icpResp.status);
      }
    } catch (e) {
      console.warn("ICP extraction failed (ignored):", e);
    }

    return new Response(
      JSON.stringify({ analysis, icp_signals }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-sales-call error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
