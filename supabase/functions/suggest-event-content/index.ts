import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildBrandVoiceBlock,
  buildPersonaBlock,
  fetchVoiceAndPersona,
} from "../_shared/marketing-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const ALLOWED_KINDS = [
  "save_the_date",
  "teaser",
  "reels",
  "carrossel",
  "stories",
  "email",
  "cobertura_ao_vivo",
  "pos_evento",
  "custom",
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { accountId, event } = await req.json();
    if (!accountId || !event?.id) {
      return new Response(JSON.stringify({ error: "accountId e event são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { voice, persona } = await fetchVoiceAndPersona(supabase, accountId);

    // Optional context: pillars + last strategies (best-effort)
    const [{ data: pillars }, { data: strategies }] = await Promise.all([
      supabase.from("content_pillars").select("name,description").eq("account_id", accountId).limit(10),
      supabase
        .from("content_strategies")
        .select("title,summary")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

    const ctxLines = [
      event.title ? `- Título: ${event.title}` : "",
      event.event_type ? `- Tipo: ${event.event_type}` : "",
      event.scheduled_at ? `- Data início: ${event.scheduled_at}` : "",
      event.ends_at ? `- Data fim: ${event.ends_at}` : "",
      event.description ? `- Descrição: ${event.description}` : "",
      event.goals ? `- Objetivos: ${event.goals}` : "",
      event.notes ? `- Notas: ${event.notes}` : "",
    ].filter(Boolean).join("\n");

    const pillarsBlock = (pillars || []).length
      ? `\n=== PILARES DE CONTEÚDO ===\n${(pillars || [])
          .map((p: any) => `- ${p.name}${p.description ? `: ${p.description}` : ""}`)
          .join("\n")}`
      : "";

    const strategiesBlock = (strategies || []).length
      ? `\n=== ESTRATÉGIAS RECENTES ===\n${(strategies || [])
          .map((s: any) => `- ${s.title}${s.summary ? `: ${s.summary}` : ""}`)
          .join("\n")}`
      : "";

    const systemPrompt = `Você é um(a) estrategista sênior de marketing de conteúdo. Gera um plano de pautas/entregáveis específicos para um evento, respeitando tom de voz e persona. Sempre devolva JSON puro no formato pedido — sem markdown, sem comentários.`;

    const userPrompt = `Gere de 5 a 8 entregáveis de conteúdo para o evento abaixo. Cada entregável deve ter um "kind" (um destes: ${ALLOWED_KINDS.join(", ")}), um "title" curto e específico (não genérico), um "hook" (gancho de 1 linha), um "big_idea" (1-2 linhas com a ideia central), um "format" (ex.: reels, carrossel, e-mail), um "channel" (ex.: instagram, email, whatsapp), um "persona_target" (qual persona) e um "due_offset_days" (inteiro, negativo = antes do evento, 0 = no dia, positivo = depois). Cubra antes (aquecimento), durante (cobertura) e depois (capitalização).

=== CONTEXTO DO EVENTO ===
${ctxLines || "(pouco contexto — use tom de voz e persona como referência principal)"}
${buildBrandVoiceBlock(voice)}
${buildPersonaBlock(persona)}
${pillarsBlock}
${strategiesBlock}

Responda APENAS com este JSON:
{
  "deliverables": [
    { "kind": "...", "title": "...", "hook": "...", "big_idea": "...", "format": "...", "channel": "...", "persona_target": "...", "due_offset_days": -7 }
  ]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições de IA atingido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos do Lovable AI esgotados. Adicione créditos em Settings > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const errorText = await response.text();
      throw new Error(`AI gateway error [${response.status}]: ${errorText}`);
    }

    const result = await response.json();
    const raw = result?.choices?.[0]?.message?.content?.trim() || "{}";

    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const deliverables = Array.isArray(parsed.deliverables) ? parsed.deliverables : [];
    const cleaned = deliverables
      .filter((d: any) => d && typeof d.title === "string" && d.title.trim().length > 0)
      .map((d: any) => ({
        kind: ALLOWED_KINDS.includes(d.kind) ? d.kind : "custom",
        title: String(d.title).slice(0, 200),
        hook: typeof d.hook === "string" ? d.hook.slice(0, 300) : null,
        big_idea: typeof d.big_idea === "string" ? d.big_idea.slice(0, 600) : null,
        format: typeof d.format === "string" ? d.format.slice(0, 60) : null,
        channel: typeof d.channel === "string" ? d.channel.slice(0, 60) : null,
        persona_target: typeof d.persona_target === "string" ? d.persona_target.slice(0, 120) : null,
        due_offset_days: Number.isFinite(d.due_offset_days) ? Math.trunc(d.due_offset_days) : null,
      }));

    return new Response(JSON.stringify({ deliverables: cleaned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("suggest-event-content error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
