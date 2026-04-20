import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fetchVoiceAndPersona, buildBrandVoiceBlock, buildPersonaBlock } from "../_shared/marketing-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PostInput {
  id: string;
  platform: "instagram" | "tiktok" | "youtube";
  text: string;
  views: number;
  engagement_rate: number;
  url?: string;
  source_post_id?: string;
}

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

async function callAI(prompt: string, schema: any) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "function", function: schema }],
      tool_choice: { type: "function", function: { name: schema.name } },
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  return args ? JSON.parse(args) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { accountId, platforms = ["instagram", "tiktok", "youtube"], limit = 30 } = await req.json();
    if (!accountId) throw new Error("accountId obrigatório");

    // Fetch top posts por engagement de cada plataforma
    const posts: PostInput[] = [];

    if (platforms.includes("instagram")) {
      const { data: igProfiles } = await supabase
        .from("instagram_profiles").select("id").eq("account_id", accountId);
      const profileIds = (igProfiles || []).map((p: any) => p.id);
      if (profileIds.length) {
        const { data } = await supabase
          .from("instagram_posts")
          .select("id, instagram_id, caption, views, reach, engagement_rate, permalink")
          .in("profile_id", profileIds)
          .not("caption", "is", null)
          .order("engagement_rate", { ascending: false })
          .limit(limit);
        (data || []).forEach((p: any) => {
          if (p.caption) posts.push({
            id: p.id, platform: "instagram",
            text: String(p.caption).slice(0, 500),
            views: p.views || p.reach || 0,
            engagement_rate: Number(p.engagement_rate || 0),
            url: p.permalink, source_post_id: p.instagram_id,
          });
        });
      }
    }

    if (platforms.includes("tiktok")) {
      const { data } = await supabase
        .from("tiktok_posts")
        .select("id, tiktok_id, caption, views, engagement_rate, video_url")
        .eq("account_id", accountId)
        .not("caption", "is", null)
        .order("engagement_rate", { ascending: false })
        .limit(limit);
      (data || []).forEach((p: any) => {
        if (p.caption) posts.push({
          id: p.id, platform: "tiktok",
          text: String(p.caption).slice(0, 500),
          views: p.views || 0,
          engagement_rate: Number(p.engagement_rate || 0),
          url: p.video_url, source_post_id: p.tiktok_id,
        });
      });
    }

    if (platforms.includes("youtube")) {
      const { data } = await supabase
        .from("youtube_videos")
        .select("id, youtube_id, title, caption, views, engagement_rate, video_url")
        .eq("account_id", accountId)
        .order("engagement_rate", { ascending: false })
        .limit(limit);
      (data || []).forEach((p: any) => {
        const txt = p.title || p.caption;
        if (txt) posts.push({
          id: p.id, platform: "youtube",
          text: String(txt).slice(0, 500),
          views: Number(p.views || 0),
          engagement_rate: Number(p.engagement_rate || 0),
          url: p.video_url, source_post_id: p.youtube_id,
        });
      });
    }

    if (!posts.length) {
      return new Response(JSON.stringify({ count: 0, message: "Nenhum post encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Calcular score relativo (0-100) — top engagement = 100
    const maxEng = Math.max(...posts.map(p => p.engagement_rate || 0), 1);
    const scoredPosts = posts.map(p => ({
      ...p,
      performance_score: Math.min(100, Math.round((p.engagement_rate / maxEng) * 100)),
    }));

    // Contexto de voz/persona
    const { voice, persona } = await fetchVoiceAndPersona(supabase, accountId);
    const ctx = buildBrandVoiceBlock(voice) + buildPersonaBlock(persona);

    // IA extrai hook + categoria de cada post
    const sample = scoredPosts.slice(0, 25); // limita pra não estourar
    const prompt = `Você é um especialista em copywriting viral para redes sociais.${ctx}

Para CADA post abaixo, extraia o HOOK (primeira frase ou primeiros 3 segundos — o que prende a atenção) e classifique em UMA categoria:
- curiosidade (cria gap de informação: "Você não vai acreditar...")
- promessa (oferece resultado: "Como triplicar...")
- polemica (provoca debate: "Pare de fazer X")
- historia (storytelling: "Quando eu...")
- dado (estatística: "98% das pessoas...")
- provocacao (questiona crença: "E se eu te dissesse...")
- outro

POSTS:
${sample.map((p, i) => `[${i}] (${p.platform} | ${p.performance_score}pts | ${p.views} views) ${p.text}`).join("\n\n")}

Retorne EXATAMENTE ${sample.length} hooks na ordem.`;

    const result = await callAI(prompt, {
      name: "extract_hooks",
      description: "Extrai hooks de posts virais",
      parameters: {
        type: "object",
        properties: {
          hooks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                index: { type: "number" },
                hook_text: { type: "string", description: "O gancho extraído (max 200 chars)" },
                category: { type: "string", enum: ["curiosidade","promessa","polemica","historia","dado","provocacao","outro"] },
                why_it_works: { type: "string", description: "Por que esse hook funciona (1 frase)" },
              },
              required: ["index","hook_text","category"],
            },
          },
        },
        required: ["hooks"],
      },
    });

    const hooks = result?.hooks || [];

    // Deduplicar — não inserir hooks que já existem (mesmo source_post_id)
    const sourceIds = sample.map(p => p.source_post_id).filter(Boolean);
    const { data: existing } = await supabase
      .from("marketing_hooks")
      .select("source_post_id")
      .eq("account_id", accountId)
      .in("source_post_id", sourceIds.length ? sourceIds : [""]);
    const existingIds = new Set((existing || []).map((e: any) => e.source_post_id));

    const toInsert = hooks
      .map((h: any) => {
        const post = sample[h.index];
        if (!post || existingIds.has(post.source_post_id)) return null;
        return {
          account_id: accountId,
          text: h.hook_text,
          category: h.category,
          source: post.platform,
          source_platform: post.platform,
          source_post_id: post.source_post_id,
          source_url: post.url,
          performance_score: post.performance_score,
          views: post.views,
          engagement_rate: post.engagement_rate,
          notes: h.why_it_works,
          created_by_ai: true,
        };
      })
      .filter(Boolean);

    if (toInsert.length) {
      const { error } = await supabase.from("marketing_hooks").insert(toInsert);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ count: toInsert.length, analyzed: sample.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
