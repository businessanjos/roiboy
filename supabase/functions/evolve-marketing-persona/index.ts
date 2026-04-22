import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildBrandVoiceBlock,
  buildPersonaBlock,
  buildInstagramContextBlock,
  fetchAiReviewSignals,
  fetchInstagramContext,
  fetchVoiceAndPersona,
} from "../_shared/marketing-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

async function fetchTiktokContext(supabase: any, accountId: string, profileId: string) {
  const { data: profile } = await supabase
    .from("tiktok_profiles")
    .select("id, username, display_name, followers_count, account_id")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile || profile.account_id !== accountId) return "";

  const { data: posts } = await supabase
    .from("tiktok_posts")
    .select("caption, category, hashtags, sound_name, views, likes, comments, shares, engagement_rate, ai_objective")
    .eq("profile_id", profileId)
    .order("engagement_rate", { ascending: false, nullsFirst: false })
    .limit(10);

  const lines = ["\n\n=== PERFORMANCE DO TIKTOK SELECIONADO ===", `Perfil: @${profile.username}`];
  (posts || []).forEach((post: any, index: number) => {
    lines.push(`${index + 1}. ${post.category || "sem categoria"} · objetivo ${post.ai_objective || "n/a"} · ${Number(post.engagement_rate || 0).toFixed(2)}% eng · ${post.views || 0} views · ${(post.caption || "").replace(/\s+/g, " ").slice(0, 120)}`);
  });
  return lines.join("\n");
}

async function fetchYoutubeContext(supabase: any, accountId: string, profileId: string) {
  const { data: channel } = await supabase
    .from("youtube_channels")
    .select("id, username, display_name, subscribers_count, account_id")
    .eq("id", profileId)
    .maybeSingle();

  if (!channel || channel.account_id !== accountId) return "";

  const { data: videos } = await supabase
    .from("youtube_videos")
    .select("title, caption, category, video_type, views, likes, comments, engagement_rate, ai_objective")
    .eq("channel_id", profileId)
    .order("engagement_rate", { ascending: false, nullsFirst: false })
    .limit(10);

  const lines = ["\n\n=== PERFORMANCE DO YOUTUBE SELECIONADO ===", `Canal: @${channel.username}`];
  (videos || []).forEach((video: any, index: number) => {
    lines.push(`${index + 1}. ${video.video_type || "video"} · ${video.category || "sem categoria"} · objetivo ${video.ai_objective || "n/a"} · ${Number(video.engagement_rate || 0).toFixed(2)}% eng · ${video.views || 0} views · ${(video.caption || video.title || "").replace(/\s+/g, " ").slice(0, 120)}`);
  });
  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { accountId, currentPersona, profileId, profilePlatform, profileUsername, profileDisplayName } = await req.json();
    if (!accountId) {
      return new Response(JSON.stringify({ error: "accountId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [{ voice, persona }, ideasRes, copyRes, hooksRes, trendsRes] = await Promise.all([
      fetchVoiceAndPersona(supabase, accountId),
      supabase.from("marketing_ideas").select("title, description, hook, format, platform, priority, status, tags").eq("account_id", accountId).order("updated_at", { ascending: false }).limit(40),
      supabase.from("marketing_copy_history").select("copy_type, prompt, output, context, created_at").eq("account_id", accountId).order("created_at", { ascending: false }).limit(30),
      supabase.from("marketing_hooks").select("text, category, performance_score, source_platform, notes, tags").eq("account_id", accountId).order("performance_score", { ascending: false }).limit(20),
      supabase.from("marketing_trends").select("title, description, platform, score, tags, ai_adaptation").eq("account_id", accountId).order("score", { ascending: false, nullsFirst: false }).limit(20),
    ]);

    let profileContext = "";
    const reviewSignals = await fetchAiReviewSignals(supabase, accountId, "evolve-marketing-persona");
    if (profileId && profilePlatform === "instagram") {
      const instagramContext = await fetchInstagramContext(supabase, accountId, profileId);
      profileContext = buildInstagramContextBlock(instagramContext);
    } else if (profileId && profilePlatform === "tiktok") {
      profileContext = await fetchTiktokContext(supabase, accountId, profileId);
    } else if (profileId && profilePlatform === "youtube") {
      profileContext = await fetchYoutubeContext(supabase, accountId, profileId);
    }

    const currentPersonaBlock = currentPersona
      ? `\n\n=== PERSONA ATUAL SALVA ===\n${Object.entries(currentPersona)
          .filter(([key, value]) => !["id", "account_id", "created_at", "updated_at", "is_default", "name", "avatar_emoji", "ai_summary", "learned_from_clients_at", "clients_analyzed_count"].includes(key))
          .filter(([, value]) => Array.isArray(value) ? value.length > 0 : !!String(value || "").trim())
          .map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
          .join("\n")}`
      : "\n\n=== PERSONA ATUAL SALVA ===\nAinda muito incompleta ou vazia.";

    const ideasContext = (ideasRes.data || []).length
      ? (ideasRes.data || []).map((idea: any, index: number) => `${index + 1}. ${idea.title} · ${idea.platform}/${idea.format} · ${idea.status}${idea.hook ? ` · hook: ${idea.hook}` : ""}${idea.description ? ` · ${String(idea.description).slice(0, 130)}` : ""}`).join("\n")
      : "Nenhuma ideia salva.";

    const copyContext = (copyRes.data || []).length
      ? (copyRes.data || []).map((item: any, index: number) => `${index + 1}. ${item.copy_type} · prompt: ${String(item.prompt || "").slice(0, 100)} · saída: ${String(item.output || "").slice(0, 140)}`).join("\n")
      : "Nenhuma copy salva.";

    const hooksContext = (hooksRes.data || []).length
      ? (hooksRes.data || []).map((hook: any, index: number) => `${index + 1}. ${hook.text} · ${hook.category || "outro"} · ${hook.source_platform || hook.source || "n/a"} · score ${hook.performance_score || 0}`).join("\n")
      : "Nenhum hook salvo.";

    const trendsContext = (trendsRes.data || []).length
      ? (trendsRes.data || []).map((trend: any, index: number) => `${index + 1}. ${trend.title} · score ${trend.score || 0}${trend.platform ? ` · ${trend.platform}` : ""}${trend.ai_adaptation ? ` · ${trend.ai_adaptation}` : ""}`).join("\n")
      : "Nenhuma trend salva.";

    const systemPrompt = `Você é um estrategista de marketing sênior especializado em evolução de persona.

Sua tarefa é completar, revisar e evoluir a persona com base em dados reais já salvos.

Regras obrigatórias:
- Não invente uma persona desconectada do histórico existente.
- Preserve o que já faz sentido na persona atual e proponha melhorias objetivas.
- Priorize linguagem, dores, desejos e objeções coerentes com os conteúdos e hooks que já performam.
- recommendations deve trazer orientações acionáveis, não genéricas.
- suggestedUpdates deve preencher apenas campos que merecem melhoria, revisão ou aprofundamento.
- Para campos de lista, retorne arrays curtos e específicos.
- completionScore deve ser inteiro de 0 a 100.`;

    const userPrompt = `PERFIL ATIVO:
- Plataforma: ${profilePlatform || "não informado"}
- Username: ${profileUsername ? `@${profileUsername}` : "não informado"}
- Nome: ${profileDisplayName || profileUsername || "não informado"}

${buildBrandVoiceBlock(voice)}
${buildPersonaBlock(persona)}
${profileContext}
${reviewSignals}
${currentPersonaBlock}

=== IDEIAS JÁ SALVAS ===
${ideasContext}

=== COPIES JÁ SALVAS ===
${copyContext}

=== HOOKS JÁ SALVOS ===
${hooksContext}

=== TRENDS JÁ SALVAS ===
${trendsContext}

Analise a persona atual, a consistência com o histórico do projeto e proponha uma evolução prática.`;

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
        tools: [{
          type: "function",
          function: {
            name: "evolve_persona",
            description: "Retorna análise evolutiva e sugestões estruturadas para a persona.",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string" },
                completionScore: { type: "integer" },
                strengths: { type: "array", items: { type: "string" } },
                gaps: { type: "array", items: { type: "string" } },
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      detail: { type: "string" },
                      priority: { type: "string", enum: ["alta", "média", "baixa"] },
                    },
                    required: ["title", "detail", "priority"],
                    additionalProperties: false,
                  },
                },
                suggestedUpdates: {
                  type: "object",
                  properties: {
                    profession: { type: "string" },
                    education: { type: "string" },
                    age_range: { type: "string" },
                    gender: { type: "string" },
                    location: { type: "string" },
                    business_type: { type: "string" },
                    business_size: { type: "string" },
                    revenue_range: { type: "string" },
                    years_in_business: { type: "string" },
                    pains: { type: "array", items: { type: "string" } },
                    desires: { type: "array", items: { type: "string" } },
                    objections: { type: "array", items: { type: "string" } },
                    emotional_triggers: { type: "array", items: { type: "string" } },
                    vocabulary: { type: "array", items: { type: "string" } },
                    channels: { type: "array", items: { type: "string" } },
                    references_consumed: { type: "array", items: { type: "string" } },
                    daily_routine: { type: "string" },
                    biggest_dream: { type: "string" },
                    biggest_fear: { type: "string" },
                    notes: { type: "string" },
                  },
                  additionalProperties: false,
                },
              },
              required: ["summary", "completionScore", "strengths", "gaps", "recommendations", "suggestedUpdates"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "evolve_persona" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos na workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      throw new Error(text);
    }

    const result = await response.json();
    const toolCall = result?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Sem resposta estruturada da IA");

    const args = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("evolve-marketing-persona error", err);
    return new Response(JSON.stringify({ error: err.message || "Erro inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});