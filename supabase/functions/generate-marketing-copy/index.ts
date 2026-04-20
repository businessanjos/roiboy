import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchVoiceAndPersona, buildBrandVoiceBlock, buildPersonaBlock } from "../_shared/marketing-context.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { accountId, copyType = "caption", brief, ideaId, format, platform, hook, useBrandVoice = true } = await req.json();

    if (!accountId || !brief) {
      return new Response(JSON.stringify({ error: "accountId e brief são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let voiceContext = "";
    let personaContext = "";
    if (useBrandVoice) {
      const { voice, persona } = await fetchVoiceAndPersona(supabase, accountId);
      voiceContext = buildBrandVoiceBlock(voice);
      personaContext = buildPersonaBlock(persona);
    }

    const typeCfg = COPY_TYPES[copyType] || COPY_TYPES.caption;

    const systemPrompt = `Você é uma copywriter sênior especializada em conteúdo para Instagram, TikTok e YouTube, com profundo conhecimento do mercado de estética brasileiro. Escreva sempre em português do Brasil.${voiceContext}${personaContext}`;

    const userPrompt = `Tarefa: ${typeCfg.instruction}

Briefing: ${brief}
${format ? `Formato: ${format}` : ""}
${platform ? `Plataforma: ${platform}` : ""}
${hook ? `Hook obrigatório: ${hook}` : ""}

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
        context: { format, platform, hook, useBrandVoice },
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
