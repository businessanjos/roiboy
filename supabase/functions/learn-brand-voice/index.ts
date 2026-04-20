import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface IGPost {
  caption?: string;
  type?: string;
  likes?: number;
  comments?: number;
}

async function tryFetchInstagramPosts(username: string): Promise<IGPost[]> {
  try {
    const res = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "X-IG-App-ID": "936619743392459",
        Accept: "application/json",
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges || [];
    return edges.slice(0, 20).map((e: any) => ({
      caption: e?.node?.edge_media_to_caption?.edges?.[0]?.node?.text || "",
      type: e?.node?.is_video ? "video" : "image",
      likes: e?.node?.edge_liked_by?.count || 0,
      comments: e?.node?.edge_media_to_comment?.count || 0,
    })).filter((p: IGPost) => p.caption);
  } catch (err) {
    console.error("IG fetch error", err);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { accountId, instagramUsername, manualPosts, niche, targetAudience } = await req.json();

    if (!accountId) {
      return new Response(JSON.stringify({ error: "accountId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let posts: IGPost[] = [];
    if (manualPosts && Array.isArray(manualPosts) && manualPosts.length > 0) {
      posts = manualPosts.map((p: string) => ({ caption: p }));
    } else if (instagramUsername) {
      posts = await tryFetchInstagramPosts(instagramUsername.replace(/^@/, ""));
    }

    if (posts.length === 0) {
      return new Response(JSON.stringify({
        error: "Não foi possível obter posts. Cole exemplos manualmente ou tente outro usuário.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const captionsText = posts.map((p, i) => `Post ${i + 1} (❤️ ${p.likes ?? "?"}): ${p.caption}`).join("\n\n");

    const systemPrompt = `Você é um especialista em branding e comunicação digital. Analise os posts abaixo de uma conta de Instagram e extraia o tom de voz da marca em JSON estrito.`;
    const userPrompt = `Nicho declarado: ${niche || "(não informado)"}
Público-alvo declarado: ${targetAudience || "(não informado)"}

Posts coletados:
${captionsText}

Retorne APENAS este JSON:
{
  "personality": "descrição em 2-3 frases da personalidade da marca",
  "tone_keywords": ["adjetivos do tom (5-8)"],
  "forbidden_words": ["palavras/abordagens que a marca NÃO usa"],
  "signature_phrases": ["frases/bordões característicos"],
  "emoji_style": "como ela usa emojis",
  "hashtag_strategy": "estratégia de hashtags observada",
  "values_and_mission": "valores e missão percebidos",
  "target_audience": "público-alvo refinado",
  "niche": "nicho refinado",
  "ai_summary": "resumo de 1 parágrafo que outros sistemas de IA podem usar como contexto"
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI error", aiRes.status, txt);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite de IA atingido. Tente em 1 minuto." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway: ${txt}`);
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);

    const upsert = {
      account_id: accountId,
      personality: parsed.personality || null,
      tone_keywords: parsed.tone_keywords || [],
      forbidden_words: parsed.forbidden_words || [],
      signature_phrases: parsed.signature_phrases || [],
      emoji_style: parsed.emoji_style || null,
      hashtag_strategy: parsed.hashtag_strategy || null,
      values_and_mission: parsed.values_and_mission || null,
      target_audience: parsed.target_audience || targetAudience || null,
      niche: parsed.niche || niche || null,
      ai_summary: parsed.ai_summary || null,
      example_posts: posts.slice(0, 10).map((p) => p.caption || ""),
      learned_from_instagram_at: new Date().toISOString(),
      posts_analyzed_count: posts.length,
    };

    const { error } = await supabase
      .from("marketing_brand_voice")
      .upsert(upsert, { onConflict: "account_id" });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, voice: upsert, postsAnalyzed: posts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("learn-brand-voice error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
