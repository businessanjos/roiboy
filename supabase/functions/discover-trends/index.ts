import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchVoiceAndPersona, buildBrandVoiceBlock, buildPersonaBlock, fetchInstagramContext, buildInstagramContextBlock } from "../_shared/marketing-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");

interface DiscoveredTrend {
  title: string;
  description: string;
  source_url?: string;
  hype_score: number;
  tags: string[];
  ai_adaptation: string;
}

async function searchWithPerplexity(query: string): Promise<string> {
  if (!PERPLEXITY_API_KEY) return "";
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: "Você é um pesquisador de tendências de redes sociais. Liste tendências reais e atuais com fontes." },
        { role: "user", content: query },
      ],
      search_recency_filter: "week",
    }),
  });
  if (!res.ok) return "";
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { accountId, niche, platform = "instagram", customQuery, extraContext } = await req.json();
    const safeExtraContext = typeof extraContext === "string" ? extraContext.trim().slice(0, 1000) : "";

    if (!accountId) {
      return new Response(JSON.stringify({ error: "accountId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [{ voice, persona }, instagramCtx] = await Promise.all([
      fetchVoiceAndPersona(supabase, accountId),
      fetchInstagramContext(supabase, accountId),
    ]);
    const voiceBlock = buildBrandVoiceBlock(voice);
    const personaBlock = buildPersonaBlock(persona);
    const instagramBlock = buildInstagramContextBlock(instagramCtx);

    const effectiveNiche = niche || voice?.niche || persona?.business_type || "marketing digital";

    const searchQuery = customQuery || `Quais são as principais tendências, formatos virais e trends de ${platform} desta semana relevantes para o nicho de ${effectiveNiche}? Inclua nomes de áudios, formatos, hashtags e exemplos de criadores.`;

    let researchContext = "";
    if (PERPLEXITY_API_KEY) {
      researchContext = await searchWithPerplexity(searchQuery);
    }

    const systemPrompt = `Você é um analista de tendências de redes sociais especializado no mercado de estética brasileiro. Identifique tendências reais e atuais. Sempre retorne JSON estrito.${voiceBlock}${personaBlock}${instagramBlock}`;
    const userPrompt = `Plataforma alvo: ${platform}
Nicho: ${effectiveNiche}

${safeExtraContext ? `=== CONTEXTO EXTRA DESTA BUSCA (PRIORIDADE MÁXIMA — sobrepõe defaults) ===\n${safeExtraContext}\n\n` : ""}${researchContext ? `Pesquisa atual de fontes externas:\n${researchContext}\n` : "(Sem dados externos. Use seu conhecimento mais recente.)"}

Retorne 6 tendências em JSON. No campo "ai_adaptation", adapte ESPECIFICAMENTE para a Persona, Tom de Voz e — quando houver — para os FORMATOS, TEMAS E HASHTAGS que MELHOR PERFORMAM no Instagram conectado (vide bloco "PERFORMANCE REAL DO INSTAGRAM" no system prompt). Priorize formatos e ângulos comprovadamente vencedores para esta conta. Fale com as DORES e DESEJOS da persona usando o VOCABULÁRIO dela:
{
  "trends": [
    {
      "title": "nome curto da trend",
      "description": "o que é e por que está em alta (2-3 frases)",
      "source_url": "URL real se houver, ou string vazia",
      "hype_score": 0-100,
      "tags": ["3-5 tags"],
      "ai_adaptation": "como adaptar essa trend ESPECIFICAMENTE para o nicho e tom da marca acima (3-5 frases acionáveis)"
    }
  ]
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI gateway error", aiRes.status, txt);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite atingido. Tente em 1 minuto." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway ${aiRes.status}: ${txt.slice(0, 200)}`);
    }

    const aiData = await aiRes.json();
    const raw: string = aiData.choices?.[0]?.message?.content ?? "";
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const start = cleaned.search(/[\{\[]/);
      const end = cleaned.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("Resposta da IA sem JSON válido");
      parsed = JSON.parse(cleaned.substring(start, end + 1).replace(/,\s*}/g, "}").replace(/,\s*]/g, "]"));
    }
    const trends: DiscoveredTrend[] = parsed.trends || [];
    if (!trends.length) throw new Error("IA retornou 0 tendências. Tente novamente.");

    const authHeader = req.headers.get("Authorization");
    let capturedBy: string | null = null;
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      capturedBy = user?.id || null;
    }

    const records = trends.map((t) => ({
      account_id: accountId,
      title: t.title,
      description: t.description,
      source: PERPLEXITY_API_KEY ? "perplexity" : "manual",
      source_url: t.source_url || null,
      hype_score: Math.min(100, Math.max(0, t.hype_score || 50)),
      tags: t.tags || [],
      ai_adaptation: t.ai_adaptation,
      ai_analysis: { platform, niche: effectiveNiche, extra_context: safeExtraContext || null, generated_at: new Date().toISOString() },
      captured_by: capturedBy,
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    const { data: inserted, error } = await supabase
      .from("marketing_trends")
      .insert(records)
      .select();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, count: inserted?.length || 0, trends: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("discover-trends error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
