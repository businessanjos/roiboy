import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchVoiceAndPersona, buildBrandVoiceBlock, buildPersonaBlock } from "../_shared/marketing-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// Apify actor IDs (community-maintained, well-known)
const ACTORS = {
  tiktok: "clockworks~tiktok-scraper",
  instagram: "apify~instagram-hashtag-scraper",
  reels: "apify~instagram-reel-scraper",
};

async function runApifyActor(actorId: string, input: any): Promise<any[]> {
  if (!APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN not configured");

  // Synchronous run with dataset items returned in one call
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Apify error ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function buildTikTokInput(hashtags: string[], maxItems: number) {
  return {
    hashtags: hashtags.map((h) => h.replace(/^#/, "")),
    resultsPerPage: maxItems,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
  };
}

function buildInstagramHashtagInput(hashtags: string[], maxItems: number) {
  return {
    hashtags: hashtags.map((h) => h.replace(/^#/, "")),
    resultsLimit: maxItems,
  };
}

function normalizeTikTok(item: any) {
  return {
    title: (item.text || "").slice(0, 120) || "TikTok viral",
    description: item.text || "",
    media_url: item.webVideoUrl || item.videoUrl || null,
    thumbnail_url: item.videoMeta?.coverUrl || item.covers?.[0] || null,
    creator_handle: item.authorMeta?.name ? `@${item.authorMeta.name}` : null,
    creator_followers: item.authorMeta?.fans || null,
    views_count: item.playCount || 0,
    likes_count: item.diggCount || 0,
    comments_count: item.commentCount || 0,
    audio_title: item.musicMeta?.musicName || null,
    source_url: item.webVideoUrl || null,
    tags: (item.hashtags || []).slice(0, 6).map((h: any) => h.name || h).filter(Boolean),
    platform: "tiktok",
  };
}

function normalizeInstagram(item: any) {
  return {
    title: (item.caption || "").slice(0, 120) || "Reel viral",
    description: item.caption || "",
    media_url: item.videoUrl || item.url || null,
    thumbnail_url: item.displayUrl || item.thumbnailUrl || null,
    creator_handle: item.ownerUsername ? `@${item.ownerUsername}` : null,
    creator_followers: item.ownerFollowersCount || null,
    views_count: item.videoViewCount || item.videoPlayCount || 0,
    likes_count: item.likesCount || 0,
    comments_count: item.commentsCount || 0,
    audio_title: item.musicInfo?.song_name || null,
    source_url: item.url || null,
    tags: (item.hashtags || []).slice(0, 6),
    platform: "instagram",
  };
}

function calcHype(item: any): number {
  const v = item.views_count || 0;
  const l = item.likes_count || 0;
  const c = item.comments_count || 0;
  // Engagement-weighted score normalized to 0-100
  const raw = Math.log10(v + 1) * 12 + Math.log10(l + 1) * 6 + Math.log10(c + 1) * 4;
  return Math.min(100, Math.max(15, Math.round(raw)));
}

function isLikelyPortuguese(text: string): boolean {
  if (!text) return true;
  const t = text.toLowerCase();
  const ptHits = (t.match(/\b(você|voce|não|nao|que|para|com|meu|minha|tá|tô|sobre|porque|gente|aqui|hoje|isso|vida|brasil|trabalho|dinheiro|cliente|negocio|negócio|empresa|estética|clínica|clinica|médic|medic|faturamento)\b/g) || []).length;
  const esHits = (t.match(/\b(con|los|las|del|por|muy|pero|esto|también|hola|gracias|años|trabajo|dinero|amigo|hermano|chica|chico|nada)\b/g) || []).length;
  const enHits = (t.match(/\b(the|and|you|that|with|this|for|are|have|but|not|all|your|like|just|what|when)\b/g) || []).length;
  if (esHits > ptHits && esHits > 2) return false;
  if (enHits > ptHits && enHits > 3) return false;
  return true;
}

async function aiRelevanceFilter(items: any[], contextBlock: string): Promise<any[]> {
  if (!items.length) return items;
  const prompt = `Você é curador para MENTORES de marketing/vendas/gestão de clínicas de estética e médicas no Brasil (Bruna e Everton RYKA). Público = EMPRESÁRIAS/PROFISSIONAIS do setor (donas de clínica, esteticistas, médicas), NUNCA pacientes.

Para cada item dê relevance 0-10:
- 8-10: meme/formato direto sobre negócio, vendas, dinheiro, gestão, vida de empresária, rotina de clínica
- 5-7: meme universal/trend ADAPTÁVEL para conteúdo de negócio
- 0-4: conteúdo aleatório (anime, política, gospel, lifestyle estrangeiro, fofoca de famoso, sem ângulo de negócio)

Itens:
${items.map((it, i) => `${i + 1}. [${it.platform}] "${(it.title || "").slice(0, 200)}" | @${it.creator_handle || "?"} | views=${it.views_count}`).join("\n")}

Retorne JSON: { "scores": [{ "index": 1, "relevance": 7, "reason": "..." }, ...] }${contextBlock}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é curador especializado em conteúdo de negócio para o mercado de estética brasileiro. Responda sempre em JSON válido." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return items;
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    const map = new Map<number, { r: number; why: string }>();
    (parsed.scores || []).forEach((s: any) => map.set(s.index, { r: s.relevance ?? 0, why: s.reason || "" }));
    const scored = items.map((it, i) => ({ ...it, _relevance: map.get(i + 1)?.r ?? 0, _relevance_reason: map.get(i + 1)?.why || "" }));
    return scored.filter((it) => it._relevance >= 5).sort((a, b) => b._relevance - a._relevance);
  } catch (e) {
    console.error("aiRelevanceFilter error", e);
    return items;
  }
}

async function aiAdapt(items: any[], niche: string, contextBlock: string) {
  if (!items.length) return items;
  const prompt = `Você é estrategista de conteúdo para mentores de clínicas de estética/médicas (RYKA). Para cada viral abaixo, gere UMA adaptação curta (3-4 frases ACIONÁVEIS) transformando o formato/meme em conteúdo de NEGÓCIO (vendas, marketing, gestão, precificação, posicionamento, mentalidade de empresária) para profissionais do setor de estética.${contextBlock}

Itens:
${items.map((it, i) => `${i + 1}. [${it.platform}] ${it.title} | views=${it.views_count} likes=${it.likes_count} | criador=${it.creator_handle || "?"} | áudio=${it.audio_title || "—"}`).join("\n")}

Retorne JSON: { "adaptations": [{ "index": 1, "ai_adaptation": "..." }, ...] }
Cada adaptação DEVE: (1) descrever o gancho/roteiro adaptado, (2) usar vocabulário da persona, (3) terminar com CTA de negócio.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Você é um estrategista de conteúdo brasileiro especializado em mercado de estética. Responda sempre em JSON válido." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) return items;
  const data = await res.json();
  try {
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    const map = new Map<number, string>();
    (parsed.adaptations || []).forEach((a: any) => map.set(a.index, a.ai_adaptation));
    return items.map((it, i) => ({ ...it, ai_adaptation: map.get(i + 1) || null }));
  } catch {
    return items;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!APIFY_API_TOKEN) {
      return new Response(JSON.stringify({ error: "APIFY_API_TOKEN não configurado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { accountId, platform = "tiktok", hashtags = [], maxItems = 12 } = await req.json();
    if (!accountId) {
      return new Response(JSON.stringify({ error: "accountId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!hashtags.length) {
      return new Response(JSON.stringify({ error: "Informe pelo menos 1 hashtag" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { voice, persona } = await fetchVoiceAndPersona(supabase, accountId);
    const contextBlock = buildBrandVoiceBlock(voice) + buildPersonaBlock(persona);

    let rawItems: any[] = [];
    let normalized: any[] = [];

    if (platform === "tiktok") {
      rawItems = await runApifyActor(ACTORS.tiktok, buildTikTokInput(hashtags, maxItems));
      normalized = rawItems.map(normalizeTikTok);
    } else if (platform === "instagram" || platform === "reels") {
      rawItems = await runApifyActor(ACTORS.instagram, buildInstagramHashtagInput(hashtags, maxItems));
      normalized = rawItems.map(normalizeInstagram);
    } else {
      return new Response(JSON.stringify({ error: `Plataforma ${platform} não suportada (use tiktok ou instagram)` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter and rank
    normalized = normalized
      .filter((it) => it.source_url)
      .map((it) => ({ ...it, hype_score: calcHype(it) }))
      .sort((a, b) => b.hype_score - a.hype_score)
      .slice(0, maxItems);

    // AI-adapt each top item to brand + persona
    normalized = await aiAdapt(
      normalized,
      voice?.niche || persona?.business_type || "marketing digital",
      contextBlock,
    );

    const authHeader = req.headers.get("Authorization");
    let capturedBy: string | null = null;
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      capturedBy = user?.id || null;
    }

    const records = normalized.map((it) => ({
      account_id: accountId,
      title: it.title,
      description: it.description?.slice(0, 1000),
      source: "apify",
      source_url: it.source_url,
      thumbnail_url: it.thumbnail_url,
      media_url: it.media_url,
      creator_handle: it.creator_handle,
      creator_followers: it.creator_followers,
      views_count: it.views_count,
      likes_count: it.likes_count,
      comments_count: it.comments_count,
      audio_title: it.audio_title,
      platform: it.platform,
      hype_score: it.hype_score,
      tags: it.tags,
      ai_adaptation: it.ai_adaptation || null,
      ai_analysis: { hashtags, captured_at: new Date().toISOString() },
      captured_by: capturedBy,
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    if (!records.length) {
      return new Response(JSON.stringify({ success: true, count: 0, message: "Nenhum conteúdo encontrado para essas hashtags" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inserted, error } = await supabase
      .from("marketing_trends").insert(records).select();
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, count: inserted?.length || 0, trends: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("discover-trends-apify error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
