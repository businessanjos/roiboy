import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fetchVoiceAndPersona,
  buildBrandVoiceBlock,
  buildPersonaBlock,
  fetchInstagramContext,
  buildInstagramContextBlock,
  fetchAiReviewSignals,
} from "../_shared/marketing-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

async function fetchReferenceContext(supabase: any, accountId: string) {
  const { data } = await supabase
    .from("marketing_references")
    .select("title, notes, tags")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (!data?.length) return "";

  const lines = ["\n\n=== REFERÊNCIAS SALVAS ==="];
  data.forEach((item: any, index: number) => {
    lines.push(`${index + 1}. ${item.title || "Sem título"} · tags ${(item.tags || []).join(", ") || "sem tags"} · notas ${(item.notes || "sem notas").slice(0, 160)}`);
  });
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      accountId,
      text,
      copyType = "caption",
      objective = "educar",
      brief,
      format,
      platform,
      hook,
      profileId,
      profilePlatform,
      profileUsername,
      profileDisplayName,
    } = await req.json();

    if (!accountId || !text?.trim()) {
      return new Response(JSON.stringify({ error: "accountId e text são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { voice, persona } = await fetchVoiceAndPersona(supabase, accountId);
    const reviewSignals = await fetchAiReviewSignals(supabase, accountId, "generate-marketing-copy");
    const referencesContext = await fetchReferenceContext(supabase, accountId);

    let profileContext = "";
    if (profileId && profilePlatform === "instagram") {
      const instagramContext = await fetchInstagramContext(supabase, accountId, profileId);
      profileContext = buildInstagramContextBlock(instagramContext);
    }

    const systemPrompt = `Você é uma líder de revisão editorial e conformidade de marketing. Analise textos antes da publicação, em português do Brasil, considerando clareza, força de hook, aderência ao objetivo, coerência com persona, tom de voz, referências salvas e risco de promessas excessivas.${buildBrandVoiceBlock(voice)}${buildPersonaBlock(persona)}${profileContext}${referencesContext}${reviewSignals}`;

    const userPrompt = `Revise o texto abaixo antes de publicar.

CONTEXTO
- Tipo: ${copyType}
- Objetivo: ${objective}
- Plataforma: ${platform || "não informada"}
- Formato: ${format || "não informado"}
- Hook desejado: ${hook || "não informado"}
- Perfil selecionado: ${profileId ? `@${profileUsername || "perfil"}${profileDisplayName ? ` (${profileDisplayName})` : ""} em ${profilePlatform}` : "não informado"}
- Briefing: ${brief || "não informado"}

TEXTO PARA REVISÃO
${text}

Retorne sua análise chamando a função review_copy com:
- summary: resumo executivo curto
- overallScore: número de 0 a 100
- readyToPublish: boolean
- strengths: lista de 2 a 4 pontos fortes
- issues: lista de problemas com severity (high|medium|low), title, detail, suggestion
- improvedVersion: versão revisada do texto, mantendo a intenção original, mas com melhor qualidade e conformidade
- publishChecklist: lista curta de checagens finais`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        tools: [
          {
            type: "function",
            function: {
              name: "review_copy",
              description: "Avalia qualidade e conformidade de um texto de marketing antes da publicação.",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  overallScore: { type: "number" },
                  readyToPublish: { type: "boolean" },
                  strengths: { type: "array", items: { type: "string" } },
                  issues: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        severity: { type: "string", enum: ["high", "medium", "low"] },
                        title: { type: "string" },
                        detail: { type: "string" },
                        suggestion: { type: "string" },
                      },
                      required: ["severity", "title", "detail", "suggestion"],
                      additionalProperties: false,
                    },
                  },
                  improvedVersion: { type: "string" },
                  publishChecklist: { type: "array", items: { type: "string" } },
                },
                required: ["summary", "overallScore", "readyToPublish", "strengths", "issues", "improvedVersion", "publishChecklist"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "review_copy" } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite atingido. Tente em 1 minuto." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(txt);
    }

    const aiData = await aiRes.json();
    const args = aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("Resposta de revisão inválida");

    const parsed = JSON.parse(args);
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("review-marketing-copy error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});