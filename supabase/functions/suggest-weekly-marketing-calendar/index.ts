import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildBrandVoiceBlock,
  buildPersonaBlock,
  buildInstagramContextBlock,
  fetchAiReviewSignals,
  fetchVoiceAndPersona,
  fetchInstagramContext,
} from "../_shared/marketing-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

type SelectedPlatform = "instagram" | "tiktok" | "youtube";

const formatDate = (value: Date) => value.toISOString().slice(0, 10);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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
    .limit(10);

  const lines = ["\n\n=== PERFORMANCE REAL DO TIKTOK CONECTADO ===", `Perfil: @${profile.username}`];
  (posts || []).forEach((post: any, index: number) => {
    lines.push(`${index + 1}. ${post.category || "sem categoria"} · objetivo ${post.ai_objective || "n/a"} · ${Number(post.engagement_rate || 0).toFixed(2)}% eng · ${post.views || 0} views · hashtags ${(post.hashtags || []).slice(0, 5).join(", ")} · ${(post.caption || "").replace(/\s+/g, " ").slice(0, 120)}`);
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
    .limit(10);

  const lines = ["\n\n=== PERFORMANCE REAL DO YOUTUBE CONECTADO ===", `Canal: @${channel.username}`];
  (videos || []).forEach((video: any, index: number) => {
    lines.push(`${index + 1}. ${video.video_type || "video"} · ${video.category || "sem categoria"} · objetivo ${video.ai_objective || "n/a"} · ${Number(video.engagement_rate || 0).toFixed(2)}% eng · ${video.views || 0} views · ${(video.caption || video.title || "").replace(/\s+/g, " ").slice(0, 120)}`);
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

    const weekStart = new Date();
    const weekDates = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      return {
        iso: formatDate(date),
        label: date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }),
      };
    });

    const [{ voice, persona }, ideasRes, copyRes, trendsRes, eventsRes] = await Promise.all([
      fetchVoiceAndPersona(supabase, accountId),
      supabase
        .from("marketing_ideas")
        .select("title, hook, description, format, platform, priority, status, planned_date, scheduled_for, published_at, tags")
        .eq("account_id", accountId)
        .order("updated_at", { ascending: false })
        .limit(60),
      supabase
        .from("marketing_copy_history")
        .select("copy_type, prompt, output, created_at, context")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("marketing_trends")
        .select("title, description, platform, score, tags, ai_adaptation")
        .eq("account_id", accountId)
        .or(`platform.eq.${selectedPlatform},platform.eq.multi`)
        .order("score", { ascending: false, nullsFirst: false })
        .limit(15),
      supabase
        .from("marketing_events")
        .select("title, description, event_date")
        .eq("account_id", accountId)
        .gte("event_date", formatDate(weekStart))
        .order("event_date", { ascending: true })
        .limit(10),
    ]);

    let profilePerformanceContext = "";
    const reviewSignals = await fetchAiReviewSignals(supabase, accountId, "suggest-weekly-marketing-calendar");
    if (selectedPlatform === "instagram") {
      const instagramContext = await fetchInstagramContext(supabase, accountId, profileId);
      profilePerformanceContext = buildInstagramContextBlock(instagramContext);
    } else if (selectedPlatform === "tiktok") {
      profilePerformanceContext = await fetchTiktokContext(supabase, accountId, profileId);
    } else if (selectedPlatform === "youtube") {
      profilePerformanceContext = await fetchYoutubeContext(supabase, accountId, profileId);
    }

    const ideasContext = (ideasRes.data || []).length
      ? (ideasRes.data || []).map((idea: any, index: number) => `IDEIA ${index + 1}: ${idea.title} · ${idea.platform}/${idea.format} · ${idea.status} · prioridade ${idea.priority}${idea.hook ? ` · hook: ${idea.hook}` : ""}${idea.description ? ` · ${String(idea.description).slice(0, 140)}` : ""}`).join("\n")
      : "Nenhuma ideia no histórico.";

    const copyContext = (copyRes.data || []).length
      ? (copyRes.data || []).map((item: any, index: number) => `COPY ${index + 1}: ${item.copy_type} · prompt: ${String(item.prompt || "").slice(0, 120)} · saída: ${String(item.output || "").slice(0, 160)}`).join("\n")
      : "Nenhuma copy anterior salva.";

    const trendsContext = (trendsRes.data || []).length
      ? (trendsRes.data || []).map((trend: any, index: number) => `TREND ${index + 1}: ${trend.title} · score ${trend.score || 0} · ${trend.platform || "multi"}${trend.ai_adaptation ? ` · adaptação: ${trend.ai_adaptation}` : ""}`).join("\n")
      : "Nenhuma trend relevante nesta semana.";

    const eventsContext = (eventsRes.data || []).length
      ? (eventsRes.data || []).map((event: any, index: number) => `EVENTO ${index + 1}: ${event.title} · ${event.event_date}${event.description ? ` · ${event.description}` : ""}`).join("\n")
      : "Nenhum marco importante cadastrado para a semana.";

    const weekContext = weekDates.map((item, index) => `${index + 1}. ${item.iso} (${item.label})`).join("\n");

    const systemPrompt = `Você é um estrategista editorial sênior. Monte um calendário semanal acionável para conteúdo e relacionamento.

Regras obrigatórias:
- Use os dados reais do perfil selecionado e o histórico do projeto.
- Misture posts e e-mails ao longo da semana quando fizer sentido.
- Distribua objetivos entre educar, converter e reter.
- Evite repetir o mesmo formato ou ângulo em dias seguidos.
- Dê preferência ao que já performou melhor, adaptando ao momento atual.
- Retorne entre 5 e 7 itens, cobrindo a semana atual.
- channel deve ser apenas post ou email.
- objective deve ser apenas educar, converter ou reter.
- Para cada item, inclua evidências explícitas mostrando o que influenciou a recomendação.
- Cada evidência deve citar somente elementos reais das listas IDEIA, COPY, TREND, EVENTO ou da performance do perfil.`;

    const userPrompt = `PERFIL SELECIONADO:
- Plataforma: ${selectedPlatform}
- Username: @${username}
- Nome: ${displayName || username}

${buildBrandVoiceBlock(voice)}
${buildPersonaBlock(persona)}
${profilePerformanceContext}
${reviewSignals}

=== SEMANA ATUAL ===
${weekContext}

=== HISTÓRICO DE IDEIAS ===
${ideasContext}

=== HISTÓRICO DE COPIES ===
${copyContext}

=== TRENDS DISPONÍVEIS ===
${trendsContext}

=== MARCOS E EVENTOS ===
${eventsContext}

Quero um calendário semanal de posts e e-mails para a área Hoje/Calendário, com foco no perfil selecionado e no histórico do projeto.`;

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
            name: "build_weekly_marketing_calendar",
            description: "Retorna um calendário semanal com posts e e-mails priorizados.",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string" },
                weeklyFocus: { type: "string" },
                schedule: {
                  type: "array",
                  minItems: 5,
                  maxItems: 7,
                  items: {
                    type: "object",
                    properties: {
                      date: { type: "string" },
                      dayLabel: { type: "string" },
                      channel: { type: "string", enum: ["post", "email"] },
                      title: { type: "string" },
                      format: { type: "string" },
                      platform: { type: "string" },
                      objective: { type: "string", enum: ["educar", "converter", "reter"] },
                      hook: { type: "string" },
                      cta: { type: "string" },
                      rationale: { type: "string" },
                      evidence: {
                        type: "array",
                        minItems: 2,
                        maxItems: 5,
                        items: {
                          type: "object",
                          properties: {
                            sourceType: { type: "string", enum: ["idea", "copy", "hook", "trend", "event", "profile-content"] },
                            sourceLabel: { type: "string" },
                            reason: { type: "string" },
                          },
                          required: ["sourceType", "sourceLabel", "reason"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["date", "dayLabel", "channel", "title", "format", "platform", "objective", "hook", "cta", "rationale", "evidence"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["summary", "weeklyFocus", "schedule"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "build_weekly_marketing_calendar" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite atingido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      throw new Error(text);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Sem resposta estruturada da IA");

    const args = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("suggest-weekly-marketing-calendar error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});