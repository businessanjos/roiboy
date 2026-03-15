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

    return new Response(
      JSON.stringify({ analysis }),
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
