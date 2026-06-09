import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildBrandVoiceBlock,
  buildPersonaBlock,
  fetchVoiceAndPersona,
} from "../_shared/marketing-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const FIELD_INSTRUCTIONS: Record<string, { label: string; guidance: string }> = {
  travel_impact: {
    label: "Posicionamento / impacto da viagem",
    guidance:
      "Escreva 3-5 linhas com a narrativa que essa viagem reforça, conteúdos a produzir (lives, stories, reels), gatilhos de posicionamento e impacto esperado na audiência. Tom direto, estratégico, sem clichês.",
  },
  goals: {
    label: "Objetivos",
    guidance:
      "Liste 3-5 objetivos claros e mensuráveis para essa ação de marketing (resultado de negócio, percepção de marca, engajamento, conteúdo gerado). Use bullets curtos começando com verbo no infinitivo.",
  },
  notes: {
    label: "Notas internas",
    guidance:
      "Escreva notas internas úteis para o time: pontos de atenção, dependências, ideias de execução, riscos, próximos passos. Pode usar bullets. Direto, sem floreio.",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { accountId, field, context } = await req.json();
    if (!accountId || !field) {
      return new Response(JSON.stringify({ error: "accountId e field são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fieldCfg = FIELD_INSTRUCTIONS[field];
    if (!fieldCfg) {
      return new Response(JSON.stringify({ error: `Campo não suportado: ${field}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { voice, persona } = await fetchVoiceAndPersona(supabase, accountId);

    const ctx = context || {};
    const contextLines = [
      ctx.title ? `- Título: ${ctx.title}` : "",
      ctx.event_type ? `- Tipo: ${ctx.event_type}` : "",
      ctx.scheduled_at ? `- Data início: ${ctx.scheduled_at}` : "",
      ctx.ends_at ? `- Data fim: ${ctx.ends_at}` : "",
      ctx.description ? `- Descrição: ${ctx.description}` : "",
      ctx.goals && field !== "goals" ? `- Objetivos já preenchidos: ${ctx.goals}` : "",
      ctx.notes && field !== "notes" ? `- Notas já preenchidas: ${ctx.notes}` : "",
      ctx.travel_destination ? `- Destino: ${ctx.travel_destination}` : "",
      ctx.travel_reason ? `- Motivo da viagem: ${ctx.travel_reason}` : "",
      ctx.travel_audience ? `- Público: ${ctx.travel_audience}` : "",
      ctx.travel_companions ? `- Quem vai: ${ctx.travel_companions}` : "",
      ctx.travel_impact && field !== "travel_impact"
        ? `- Posicionamento já preenchido: ${ctx.travel_impact}`
        : "",
      ctx.current ? `- Texto atual no campo (melhore/expanda em vez de descartar): ${ctx.current}` : "",
    ].filter(Boolean).join("\n");

    const systemPrompt = `Você é um(a) estrategista sênior de marketing da marca. Gera APENAS o conteúdo final do campo solicitado, em português do Brasil, pronto para colar no formulário. Sem preâmbulos, sem "aqui está", sem markdown de título. Respeite tom de voz e persona. Seja específico e acionável.`;

    const userPrompt = `Campo a preencher: ${fieldCfg.label}
Instruções para esse campo: ${fieldCfg.guidance}

=== CONTEXTO DO EVENTO ===
${contextLines || "(pouco contexto preenchido — use o tom de voz e persona como referência principal)"}
${buildBrandVoiceBlock(voice)}
${buildPersonaBlock(persona)}

Devolva SOMENTE o texto final do campo "${fieldCfg.label}".`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições de IA atingido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos do Lovable AI esgotados. Adicione créditos em Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      throw new Error(`AI gateway error [${response.status}]: ${errorText}`);
    }

    const result = await response.json();
    const text = result?.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("suggest-marketing-event-field error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
