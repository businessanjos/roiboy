// Generate Event Day Summary via Lovable AI Gateway
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você é um editor sênior do Eternum Club, responsável por transformar a transcrição bruta de um dia de evento em um RESUMO EDITORIAL de altíssima qualidade, no mesmo padrão dos materiais oficiais entregues aos sócios.

REGRAS DE ESTILO (OBRIGATÓRIAS):
- Português do Brasil, tom direto, elegante, sem floreios.
- Identifique os blocos temáticos (aulas, conversas, painéis) e dê a cada um um TÍTULO curto e impactante.
- Extraia CITAÇÕES literais (ou muito próximas do literal) dos palestrantes — sempre com o nome de quem falou. Os palestrantes principais são Everton Pieri e Bruna Pieri, mas pode haver convidados.
- Marque 3 a 8 frases-chave como "highlight" (frases de impacto, princípios, leis do jogo).
- Quando aparecerem listas, frameworks, métodos numerados ou tabelas → use bloco "list".
- Nunca invente conteúdo. Só estruture e edite o que está na transcrição.
- Nada de "Resumo:", "Conclusão:", "Neste módulo aprendemos…" — escreva como uma revista premium, não como um aluno fazendo resumo escolar.

SAÍDA: APENAS um JSON válido, sem markdown, sem texto antes ou depois. Schema:
{
  "title": "DIA X",
  "subtitle": "(opcional — tema do dia)",
  "sections": [
    {
      "heading": "Título da seção",
      "blocks": [
        { "type": "paragraph", "text": "..." },
        { "type": "quote", "author": "Bruna Pieri", "text": "..." },
        { "type": "highlight", "text": "..." },
        { "type": "list", "title": "(opcional)", "items": ["...", "..."] }
      ]
    }
  ]
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { summary_id, transcript_text, day_number, model } = await req.json();
    if (!summary_id || !transcript_text || transcript_text.trim().length < 50) {
      return new Response(JSON.stringify({ error: "summary_id e transcript_text (>=50 chars) são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const chosenModel = model || "google/gemini-2.5-pro";

    const userPrompt = `Esta é a transcrição completa do DIA ${day_number || 1} do evento. Gere o resumo editorial completo no formato JSON pedido.\n\n--- TRANSCRIÇÃO ---\n${transcript_text}\n--- FIM ---`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Falha na IA: " + errText.slice(0, 300) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify({ error: "IA não retornou conteúdo" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: any;
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content;
    } catch (e) {
      // try to extract JSON block
      const m = String(content).match(/\{[\s\S]*\}/);
      if (!m) {
        return new Response(JSON.stringify({ error: "Resposta da IA não é JSON válido", raw: String(content).slice(0, 500) }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      parsed = JSON.parse(m[0]);
    }

    const usage = aiJson?.usage || {};

    const { error: updErr } = await admin
      .from("event_summaries")
      .update({
        generated_content: parsed,
        status: "generated",
        ai_model: chosenModel,
        ai_tokens_input: usage.prompt_tokens ?? null,
        ai_tokens_output: usage.completion_tokens ?? null,
      })
      .eq("id", summary_id);

    if (updErr) {
      console.error("Update error", updErr);
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, content: parsed, usage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Unhandled", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
