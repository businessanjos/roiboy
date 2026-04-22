import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildBrandVoiceBlock,
  buildPersonaBlock,
  buildInstagramContextBlock,
  fetchVoiceAndPersona,
  fetchInstagramContext,
} from "../_shared/marketing-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

type SelectedPlatform = "instagram" | "tiktok" | "youtube";

const formatDate = (value: string | null | undefined) => {
  if (!value) return "sem data";
  return new Date(value).toLocaleDateString("pt-BR");
};

const normalizeFormat = (value: string | null | undefined) => {
  const normalized = (value || "").toLowerCase();
  if (["reel", "reels"].includes(normalized)) return "reel";
  if (["post", "feed"].includes(normalized)) return "post";
  if (["story", "stories"].includes(normalized)) return "story";
  if (["carousel", "carrossel"].includes(normalized)) return "carousel";
  if (["youtube_short", "short", "shorts"].includes(normalized)) return "youtube_short";
  if (["youtube_long", "youtube", "video longo", "longo"].includes(normalized)) return "youtube_long";
  if (["tiktok", "tik tok"].includes(normalized)) return "tiktok";
  if (["live", "ao vivo"].includes(normalized)) return "live";
  return "other";
};

const normalizePlatform = (value: string | null | undefined, fallback: SelectedPlatform) => {
  const normalized = (value || "").toLowerCase();
  if (["instagram", "insta"].includes(normalized)) return "instagram";
  if (["tiktok", "tik tok"].includes(normalized)) return "tiktok";
  if (["youtube", "yt"].includes(normalized)) return "youtube";
  if (["linkedin"].includes(normalized)) return "linkedin";
  if (["multi", "multiplataforma"].includes(normalized)) return "multi";
  return fallback;
};

async function fetchTiktokContext(supabase: any, accountId: string, profileId: string) {
  const { data: profile } = await supabase
    .from("tiktok_profiles")
    .select("id, username, display_name, followers_count, account_id")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile || profile.account_id !== accountId) return "";

  const { data: posts } = await supabase
    .from("tiktok_posts")
    .select("caption, category, hashtags, sound_name, views, likes, comments, shares, engagement_rate, posted_at, ai_objective")
    .eq("profile_id", profileId)
    .order("engagement_rate", { ascending: false, nullsFirst: false })
    .limit(12);

  const lines = [`\n\n=== PERFORMANCE REAL DO TIKTOK CONECTADO (use SEMPRE como base) ===`, `Perfil: @${profile.username}`];

  (posts || []).forEach((post: any, index: number) => {
    const caption = (post.caption || "").replace(/\s+/g, " ").slice(0, 140);
    lines.push(
      `${index + 1}. ${post.category || "sem categoria"} · ${Number(post.engagement_rate || 0).toFixed(2)}% eng · ${post.views || 0} views · ${post.likes || 0} likes · ${post.comments || 0} coment · ${post.shares || 0} shares · som ${post.sound_name || "n/a"} · hashtags ${(post.hashtags || []).slice(0, 5).map((tag: string) => `#${tag}`).join(" ")} — \"${caption}\"`
    );
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
    .select("title, caption, category, video_type, views, likes, comments, engagement_rate, posted_at, ai_objective")
    .eq("channel_id", profileId)
    .order("engagement_rate", { ascending: false, nullsFirst: false })
    .limit(12);

  const lines = [`\n\n=== PERFORMANCE REAL DO YOUTUBE CONECTADO (use SEMPRE como base) ===`, `Canal: @${channel.username}`];

  (videos || []).forEach((video: any, index: number) => {
    const caption = (video.caption || video.title || "").replace(/\s+/g, " ").slice(0, 140);
    lines.push(
      `${index + 1}. ${video.video_type || "video"} · ${video.category || "sem categoria"} · ${Number(video.engagement_rate || 0).toFixed(2)}% eng · ${video.views || 0} views · ${video.likes || 0} likes · ${video.comments || 0} coment — \"${caption}\"`
    );
  });

  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { accountId, profileId, platform, username, displayName } = await req.json();
    if (!accountId || !profileId || !platform || !username) {
      return new Response(JSON.stringify({ error: "accountId, profileId, platform e username são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedPlatform = String(platform) as SelectedPlatform;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [{ voice, persona }, ideasRes, trendsRes] = await Promise.all([
      fetchVoiceAndPersona(supabase, accountId),
      supabase
        .from("marketing_ideas")
        .select("title, hook, description, format, platform, priority, status, tags, planned_date, published_at")
        .eq("account_id", accountId)
        .order("updated_at", { ascending: false })
        .limit(40),
      supabase
        .from("marketing_trends")
        .select("title, description, platform, score, tags, ai_adaptation")
        .eq("account_id", accountId)
        .or(`platform.eq.${selectedPlatform},platform.eq.multi`)
        .order("score", { ascending: false, nullsFirst: false })
        .limit(12),
    ]);

    let profilePerformanceContext = "";
    if (selectedPlatform === "instagram") {
      const instagramContext = await fetchInstagramContext(supabase, accountId, profileId);
      profilePerformanceContext = buildInstagramContextBlock(instagramContext);
    } else if (selectedPlatform === "tiktok") {
      profilePerformanceContext = await fetchTiktokContext(supabase, accountId, profileId);
    } else if (selectedPlatform === "youtube") {
      profilePerformanceContext = await fetchYoutubeContext(supabase, accountId, profileId);
    }

    const ideas = (ideasRes.data || []) as any[];
    const trends = (trendsRes.data || []) as any[];

    const backlogContext = ideas.length
      ? ideas
          .map((idea, index) => `${index + 1}. ${idea.title} [${idea.platform}/${idea.format}] prioridade ${idea.priority || "medium"} status ${idea.status}${idea.hook ? ` · hook: ${idea.hook}` : ""}${idea.tags?.length ? ` · tags: ${idea.tags.join(", ")}` : ""}${idea.description ? ` · desc: ${String(idea.description).slice(0, 180)}` : ""}${idea.published_at ? ` · publicado em ${formatDate(idea.published_at)}` : ""}`)
          .join("\n")
      : "Nenhuma ideia cadastrada ainda.";

    const trendsContext = trends.length
      ? trends
          .map((trend, index) => `${index + 1}. ${trend.title} · score ${trend.score || 0} · ${trend.platform || "multi"}${trend.tags?.length ? ` · tags ${trend.tags.join(", ")}` : ""}${trend.ai_adaptation ? ` · adaptação: ${trend.ai_adaptation}` : ""}`)
          .join("\n")
      : "Nenhuma trend salva relevante para este perfil.";

    const systemPrompt = `Você é um estrategista de conteúdo sênior. Sua tarefa é sugerir CLUSTERS de conteúdo para a aba Ideias com foco em crescimento, reaproveitamento inteligente e priorização real.

Regras obrigatórias:
- Use SEMPRE os dados reais do perfil selecionado, brand voice, persona, backlog atual e trends salvas.
- Reaproveite conteúdos vencedores do perfil em vez de inventar temas genéricos.
- Evite duplicar ideias já presentes no backlog; complemente lacunas e ângulos ainda não explorados.
- Priorize as ideias com maior potencial de impacto no curto prazo.
- Retorne exatamente 3 clusters.
- Cada cluster deve ter exatamente 3 ideias priorizadas.
- priorityScore deve ser inteiro de 0 a 100.
- priorityLabel deve ser apenas Alta, Média ou Baixa.
- format deve ser um destes: reel, post, story, carousel, youtube_short, youtube_long, tiktok, live, other.
- platform deve ser um destes: instagram, tiktok, youtube, linkedin, multi, other.
- tags deve ter de 2 a 5 itens curtos sem #.
- reason e reuseFrom devem ser objetivos e acionáveis.`;

    const userPrompt = `PERFIL SELECIONADO:
- Plataforma: ${selectedPlatform}
- Username: @${username}
- Nome: ${displayName || username}

${buildBrandVoiceBlock(voice)}
${buildPersonaBlock(persona)}
${profilePerformanceContext}

=== BACKLOG ATUAL DE IDEIAS ===
${backlogContext}

=== TRENDS JÁ MAPEADAS ===
${trendsContext}

Quero uma camada de IA para a aba Ideias que:
1. sugira clusters editoriais;
2. reaproveite conteúdos vencedores do perfil selecionado;
3. priorize automaticamente as melhores ideias para produzir agora.

Retorne um resumo estratégico, o foco recomendado e os 3 clusters com 3 ideias cada, já ordenadas da mais prioritária para a menos prioritária dentro do cluster.`;

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
            name: "suggest_marketing_ideas",
            description: "Retorna clusters priorizados de ideias de conteúdo com reaproveitamento do perfil selecionado.",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string" },
                recommendedFocus: { type: "string" },
                clusters: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      rationale: { type: "string" },
                      reuseSignals: {
                        type: "array",
                        items: { type: "string" },
                      },
                      ideas: {
                        type: "array",
                        minItems: 3,
                        maxItems: 3,
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string" },
                            hook: { type: "string" },
                            format: { type: "string" },
                            platform: { type: "string" },
                            priorityScore: { type: "integer" },
                            priorityLabel: { type: "string", enum: ["Alta", "Média", "Baixa"] },
                            reason: { type: "string" },
                            reuseFrom: { type: "string" },
                            tags: {
                              type: "array",
                              items: { type: "string" },
                            },
                          },
                          required: ["title", "hook", "format", "platform", "priorityScore", "priorityLabel", "reason", "reuseFrom", "tags"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["name", "rationale", "reuseSignals", "ideas"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["summary", "recommendedFocus", "clusters"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_marketing_ideas" } },
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
    const toolCall = result?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("Sem resposta estruturada da IA");
    }

    const args = JSON.parse(toolCall.function.arguments);
    const clusters = (args.clusters || []).map((cluster: any) => ({
      ...cluster,
      ideas: (cluster.ideas || []).map((idea: any) => ({
        ...idea,
        format: normalizeFormat(idea.format),
        platform: normalizePlatform(idea.platform, selectedPlatform),
        priorityScore: Math.max(0, Math.min(100, Number(idea.priorityScore) || 0)),
        tags: Array.isArray(idea.tags) ? idea.tags.slice(0, 5) : [],
      })),
    }));

    return new Response(JSON.stringify({
      summary: args.summary,
      recommendedFocus: args.recommendedFocus,
      clusters,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("suggest-marketing-ideas error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});