import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { profile, trends = [], marcos = [], ideias = [] } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const today = new Date().toLocaleDateString("pt-BR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const profileLine = profile
      ? `Perfil: @${profile.username} (${profile.display_name ?? profile.username}) na plataforma ${profile.platform}.`
      : "Perfil: não especificado.";

    const trendsLine = trends.length
      ? trends.map((t: any, i: number) => `${i + 1}. ${t.title} (score ${t.score ?? 0}, ${t.platform ?? "todos"})`).join("\n")
      : "Nenhuma trend ativa.";

    const marcosLine = marcos.length
      ? marcos.map((m: any, i: number) => `${i + 1}. ${m.title} — ${m.date}${m.description ? `: ${m.description}` : ""}`).join("\n")
      : "Nenhum marco próximo.";

    const ideiasLine = ideias.length
      ? ideias.map((i: any, idx: number) => `${idx + 1}. ${i.title}${i.description ? ` — ${i.description}` : ""}`).join("\n")
      : "Nenhuma ideia em backlog.";

    const systemPrompt = `Você é um estrategista de conteúdo digital sênior. Gere pautas práticas, criativas e prontas para execução, em português brasileiro. Use tom direto, jamais genérico.

Inclua evidências explícitas do que influenciou cada pauta, citando apenas dados reais recebidos em trends, marcos, ideias ou perfil.`;

    const userPrompt = `Hoje é ${today}.
${profileLine}

TRENDS EM ALTA:
${trendsLine}

PRÓXIMOS MARCOS DA EMPRESA:
${marcosLine}

IDEIAS NO BACKLOG:
${ideiasLine}

 Gere 3 pautas de conteúdo para postar HOJE, conectando trends, marcos ou ideias acima quando fizer sentido. Cada pauta deve incluir título, formato (Reel, Carrossel, Story, Live, Vídeo curto, etc.), hook de abertura forte, CTA, o motivo estratégico e as evidências usadas. Comece pelas mais urgentes/oportunas.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "publicar_pauta",
            description: "Retorna a pauta diária estruturada",
            parameters: {
              type: "object",
              properties: {
                resumo: { type: "string", description: "Resumo de 1 linha sobre o foco do dia" },
                pautas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      titulo: { type: "string" },
                      formato: { type: "string" },
                      hook: { type: "string" },
                      cta: { type: "string" },
                      motivo: { type: "string" },
                      evidence: {
                        type: "array",
                        minItems: 1,
                        maxItems: 4,
                        items: {
                          type: "object",
                          properties: {
                            sourceType: { type: "string", enum: ["idea", "trend", "event", "profile-content"] },
                            sourceLabel: { type: "string" },
                            reason: { type: "string" },
                          },
                          required: ["sourceType", "sourceLabel", "reason"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["titulo", "formato", "hook", "cta", "motivo", "evidence"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["resumo", "pautas"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "publicar_pauta" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos do Lovable AI esgotados. Adicione créditos em Settings > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Sem resposta estruturada da IA");
    const args = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      data: today,
      resumo: args.resumo,
      pautas: args.pautas,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("generate-daily-pauta error:", e);
    return new Response(JSON.stringify({ error: e.message ?? "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
