import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchVoiceAndPersona, buildBrandVoiceBlock, buildPersonaBlock, fetchInstagramContext, buildInstagramContextBlock } from "../_shared/marketing-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const COPY_TYPES: Record<string, { label: string; instruction: string }> = {
  hook: { label: "Hook (gancho de abertura)", instruction: "Crie 5 hooks curtos (máx 12 palavras) impactantes para os primeiros 3 segundos de um vídeo. Liste numerado." },
  caption: { label: "Caption de Instagram", instruction: "Escreva uma caption envolvente com quebras de linha, storytelling e CTA. 80-200 palavras." },
  script: { label: "Roteiro de Reels/TikTok", instruction: "Escreva um roteiro de 30-60s com timestamps, falas, indicações visuais e CTA final." },
  cta: { label: "Call-to-action", instruction: "Crie 5 variações de CTA persuasivas e diretas." },
  title: { label: "Título / Headline", instruction: "Crie 7 variações de títulos otimizados para clique." },
  bio: { label: "Bio de perfil", instruction: "Crie 3 variações de bio (máx 150 caracteres cada)." },
  email: { label: "E-mail marketing", instruction: "Escreva um e-mail com assunto, abertura, corpo e CTA." },
};

const OBJECTIVE_INSTRUCTIONS: Record<string, string> = {
  educar: "Priorize clareza, utilidade, autoridade e valor prático. Ensine algo acionável sem parecer aula chata.",
  converter: "Priorize desejo, urgência, objeções, prova e CTA forte. Direcione para ação comercial sem soar forçado.",
  reter: "Priorize conexão, recorrência, comunidade, identificação e continuidade. Faça a audiência querer voltar e acompanhar.",
};

async function fetchTiktokCopyContext(supabase: any, accountId: string, profileId: string) {
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
    .limit(8);

  const lines = ["\n\n=== BASE REAL DO TIKTOK SELECIONADO ===", `Perfil: @${profile.username}`];
  (posts || []).forEach((post: any, index: number) => {
    const caption = (post.caption || "").replace(/\s+/g, " ").slice(0, 140);
    lines.push(`${index + 1}. ${post.category || "sem categoria"} · objetivo ${post.ai_objective || "n/a"} · ${Number(post.engagement_rate || 0).toFixed(2)}% eng · ${post.views || 0} views · hashtags ${(post.hashtags || []).slice(0, 5).map((tag: string) => `#${tag}`).join(" ")} — \"${caption}\"`);
  });
  return lines.join("\n");
}

async function fetchYoutubeCopyContext(supabase: any, accountId: string, profileId: string) {
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
    .limit(8);

  const lines = ["\n\n=== BASE REAL DO YOUTUBE SELECIONADO ===", `Canal: @${channel.username}`];
  (videos || []).forEach((video: any, index: number) => {
    const caption = (video.caption || video.title || "").replace(/\s+/g, " ").slice(0, 140);
    lines.push(`${index + 1}. ${video.video_type || "video"} · ${video.category || "sem categoria"} · objetivo ${video.ai_objective || "n/a"} · ${Number(video.engagement_rate || 0).toFixed(2)}% eng · ${video.views || 0} views — \"${caption}\"`);
  });
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      accountId,
      copyType = "caption",
      brief,
      objective = "educar",
      ideaId,
      format,
      platform,
      hook,
      useBrandVoice = true,
      profileId,
      profilePlatform,
      profileUsername,
      profileDisplayName,
    } = await req.json();

    if (!accountId || !brief) {
      return new Response(JSON.stringify({ error: "accountId e brief são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let voiceContext = "";
    let personaContext = "";
    let profileContext = "";
    if (useBrandVoice) {
      const { voice, persona } = await fetchVoiceAndPersona(supabase, accountId);
      voiceContext = buildBrandVoiceBlock(voice);
      personaContext = buildPersonaBlock(persona);
    }

    if (profileId && profilePlatform === "instagram") {
      const instagramContext = await fetchInstagramContext(supabase, accountId, profileId);
      profileContext = buildInstagramContextBlock(instagramContext);
    } else if (profileId && profilePlatform === "tiktok") {
      profileContext = await fetchTiktokCopyContext(supabase, accountId, profileId);
    } else if (profileId && profilePlatform === "youtube") {
      profileContext = await fetchYoutubeCopyContext(supabase, accountId, profileId);
    }

    const typeCfg = COPY_TYPES[copyType] || COPY_TYPES.caption;
    const objectiveInstruction = OBJECTIVE_INSTRUCTIONS[objective] || OBJECTIVE_INSTRUCTIONS.educar;

    const systemPrompt = `Você é uma copywriter sênior especializada em conteúdo para Instagram, TikTok e YouTube, com profundo conhecimento do mercado de estética brasileiro. Escreva sempre em português do Brasil.${voiceContext}${personaContext}${profileContext}`;

    const userPrompt = `Tarefa: ${typeCfg.instruction}

Objetivo principal: ${objective}
Diretriz do objetivo: ${objectiveInstruction}

Briefing: ${brief}
${format ? `Formato: ${format}` : ""}
${platform ? `Plataforma: ${platform}` : ""}
${hook ? `Hook obrigatório: ${hook}` : ""}
${profileId ? `Perfil selecionado: @${profileUsername || "perfil"}${profileDisplayName ? ` (${profileDisplayName})` : ""} em ${profilePlatform}` : ""}

Use como base os conteúdos e padrões que já performaram melhor no perfil selecionado. Gere variações coerentes com esse histórico, adaptadas ao objetivo pedido.
Entregue apenas o conteúdo final, sem explicações.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite atingido. Tente em 1 minuto." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(txt);
    }

    const aiData = await aiRes.json();
    const output = aiData.choices?.[0]?.message?.content || "";

    // Auth user from JWT to attribute creator
    const authHeader = req.headers.get("Authorization");
    let createdBy: string | null = null;
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      createdBy = user?.id || null;
    }

    const { data: saved } = await supabase
      .from("marketing_copy_history")
      .insert({
        account_id: accountId,
        idea_id: ideaId || null,
        copy_type: copyType,
        prompt: brief,
        output,
        context: { format, platform, hook, useBrandVoice, objective, profileId, profilePlatform, profileUsername },
        model: "google/gemini-2.5-pro",
        created_by: createdBy,
      })
      .select()
      .single();

    return new Response(JSON.stringify({ success: true, output, record: saved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("generate-marketing-copy error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
