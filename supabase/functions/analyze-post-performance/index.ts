import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fetchVoiceAndPersona, buildBrandVoiceBlock, buildPersonaBlock } from "../_shared/marketing-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { accountId } = await req.json();
    if (!accountId) throw new Error("accountId obrigatório");

    // Coleta posts dos últimos 90 dias
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: igProfiles } = await supabase
      .from("instagram_profiles").select("id").eq("account_id", accountId);
    const profileIds = (igProfiles || []).map((p: any) => p.id);

    const [igPosts, ttPosts, ytVideos] = await Promise.all([
      profileIds.length
        ? supabase.from("instagram_posts")
            .select("post_type, posted_at, views, reach, engagement_rate, ai_objective, theme")
            .in("profile_id", profileIds).gte("posted_at", since).limit(200)
        : Promise.resolve({ data: [] }),
      supabase.from("tiktok_posts")
        .select("posted_at, views, engagement_rate, ai_objective, category, hashtags")
        .eq("account_id", accountId).gte("posted_at", since).limit(200),
      supabase.from("youtube_videos")
        .select("video_type, posted_at, views, engagement_rate, hashtags")
        .eq("account_id", accountId).gte("posted_at", since).limit(200),
    ]);

    const summary = {
      instagram: igPosts.data || [],
      tiktok: ttPosts.data || [],
      youtube: ytVideos.data || [],
    };

    const totalPosts = summary.instagram.length + summary.tiktok.length + summary.youtube.length;
    if (totalPosts < 3) {
      return new Response(JSON.stringify({ count: 0, message: "Poucos posts para análise (mínimo 3)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { voice, persona } = await fetchVoiceAndPersona(supabase, accountId);
    const ctx = buildBrandVoiceBlock(voice) + buildPersonaBlock(persona);

    const prompt = `Você é um analista de performance de conteúdo em redes sociais.${ctx}

Analise os posts dos últimos 90 dias e gere 5 a 8 INSIGHTS ACIONÁVEIS sobre o que funciona melhor.

DADOS:
Instagram (${summary.instagram.length} posts): ${JSON.stringify(summary.instagram.slice(0, 80))}

TikTok (${summary.tiktok.length} posts): ${JSON.stringify(summary.tiktok.slice(0, 80))}

YouTube (${summary.youtube.length} posts): ${JSON.stringify(summary.youtube.slice(0, 80))}

Para cada insight:
- platform: 'instagram','tiktok','youtube' ou 'combined'
- insight_type: 'top_format','best_time','winning_hook','hashtag_pattern','content_pattern'
- title: curto e direto (max 80 chars)
- description: explicação acionável (2-3 frases)
- score: 0-100 (quão forte é o padrão observado)`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "save_insights",
            parameters: {
              type: "object",
              properties: {
                insights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      platform: { type: "string", enum: ["instagram","tiktok","youtube","combined"] },
                      insight_type: { type: "string", enum: ["top_format","best_time","winning_hook","hashtag_pattern","content_pattern"] },
                      title: { type: "string" },
                      description: { type: "string" },
                      score: { type: "number" },
                    },
                    required: ["platform","insight_type","title","description","score"],
                  },
                },
              },
              required: ["insights"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_insights" } },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente em 1 min." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (res.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI ${res.status}: ${t}`);
    }

    const data = await res.json();
    const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
    const insights = args.insights || [];

    // Limpa antigos e insere novos
    await supabase.from("marketing_performance_insights").delete().eq("account_id", accountId);

    const periodEnd = new Date().toISOString().slice(0, 10);
    const periodStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const toInsert = insights.map((i: any) => ({
      account_id: accountId,
      platform: i.platform,
      insight_type: i.insight_type,
      title: i.title,
      description: i.description,
      score: i.score,
      period_start: periodStart,
      period_end: periodEnd,
    }));

    if (toInsert.length) {
      const { error } = await supabase.from("marketing_performance_insights").insert(toInsert);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ count: toInsert.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
