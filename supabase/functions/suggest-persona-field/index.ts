import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchInstagramContext, buildInstagramContextBlock } from "../_shared/marketing-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// Mapeamento campo -> instrução específica para a IA
const FIELD_INSTRUCTIONS: Record<string, { label: string; format: "text" | "array"; description: string }> = {
  profession: { label: "Profissão", format: "text", description: "Profissão típica do público-alvo (ex: 'Médica esteta', 'Biomédica esteta', 'Dentista com foco em HOF')" },
  education: { label: "Formação", format: "text", description: "Formação acadêmica e especializações típicas" },
  age_range: { label: "Faixa etária", format: "text", description: "Faixa etária predominante (ex: '32-45 anos')" },
  gender: { label: "Gênero predominante", format: "text", description: "Gênero predominante" },
  location: { label: "Localização", format: "text", description: "Onde estão (regiões, cidades, capitais)" },
  business_type: { label: "Tipo de negócio", format: "text", description: "Tipo de negócio que possuem (ex: 'Clínica própria de estética avançada')" },
  business_size: { label: "Porte do negócio", format: "text", description: "Tamanho do negócio (solo, com equipe pequena, etc)" },
  revenue_range: { label: "Faturamento médio mensal", format: "text", description: "Faixa de faturamento mensal típica em R$" },
  years_in_business: { label: "Tempo de mercado", format: "text", description: "Há quanto tempo estão no mercado em média" },
  pains: { label: "Dores principais", format: "array", description: "Lista de 5-8 dores reais e profundas que esse público sente. Sem clichês. Específico do nicho de estética." },
  desires: { label: "Desejos / Transformação buscada", format: "array", description: "Lista de 5-8 desejos concretos que querem alcançar. Resultado tangível." },
  objections: { label: "Objeções comuns", format: "array", description: "Lista de 5-8 objeções típicas que esse público levanta antes de comprar (preço, tempo, ceticismo, etc)" },
  emotional_triggers: { label: "Gatilhos emocionais", format: "array", description: "Lista de 5-7 gatilhos emocionais que movem esse público à ação (medo de ficar para trás, validação social, autoridade, etc)" },
  vocabulary: { label: "Vocabulário do nicho", format: "array", description: "Lista de 10-15 palavras, gírias e expressões típicas que esse público USA no dia a dia. Não palavras genéricas." },
  channels: { label: "Canais frequentados", format: "array", description: "Lista de 5-8 plataformas, redes, comunidades e eventos que frequentam" },
  references_consumed: { label: "Referências consumidas", format: "array", description: "Lista de 5-8 perfis, marcas, podcasts ou autores que essa pessoa segue/consome" },
  daily_routine: { label: "Rotina diária", format: "text", description: "Descrição em 2-3 frases de como é um dia típico dessa pessoa" },
  biggest_dream: { label: "Maior sonho", format: "text", description: "O maior sonho profissional dessa pessoa em 1-2 frases" },
  biggest_fear: { label: "Maior medo", format: "text", description: "O maior medo dessa pessoa em 1-2 frases" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { accountId, field, currentPersona } = await req.json();

    if (!accountId || !field) {
      return new Response(JSON.stringify({ error: "accountId e field são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fieldConfig = FIELD_INSTRUCTIONS[field];
    if (!fieldConfig) {
      return new Response(JSON.stringify({ error: `Campo '${field}' não suportado` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) Buscar produtos foco (Rykas Mentoring + Eternum Club)
    const { data: products } = await supabase
      .from("products")
      .select("id, name")
      .eq("account_id", accountId);

    const focusProductIds = (products || [])
      .filter((p: any) => /ryka|eternum/i.test(p.name || ""))
      .map((p: any) => p.id);

    // 2) Buscar contratos ativos desses produtos
    let clientIds: string[] = [];
    if (focusProductIds.length > 0) {
      const { data: contracts } = await supabase
        .from("client_contracts")
        .select("client_id")
        .eq("account_id", accountId)
        .in("product_id", focusProductIds)
        .in("status", ["active", "ended"])
        .limit(200);
      clientIds = Array.from(new Set((contracts || []).map((c: any) => c.client_id).filter(Boolean)));
    }

    // 3) Buscar dados dos clientes
    let clientsContext = "";
    let clientsAnalyzed = 0;
    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from("clients")
        .select("full_name, profession, segment, area_of_expertise, revenue, document, document_type, city, state")
        .in("id", clientIds)
        .limit(150);
      clientsAnalyzed = clients?.length || 0;

      // Agregação simples
      const segments: Record<string, number> = {};
      const professions: Record<string, number> = {};
      const states: Record<string, number> = {};
      const revenues: number[] = [];

      (clients || []).forEach((c: any) => {
        if (c.segment) segments[c.segment] = (segments[c.segment] || 0) + 1;
        if (c.profession) professions[c.profession] = (professions[c.profession] || 0) + 1;
        if (c.state) states[c.state] = (states[c.state] || 0) + 1;
        if (c.revenue && Number(c.revenue) > 0) revenues.push(Number(c.revenue));
      });

      const topSegments = Object.entries(segments).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const topProfessions = Object.entries(professions).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const topStates = Object.entries(states).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const avgRevenue = revenues.length > 0 ? revenues.reduce((a, b) => a + b, 0) / revenues.length : 0;

      clientsContext = `\n\nDADOS REAIS DA BASE DE CLIENTES (Rykas Mentoring + Eternum Club, ${clientsAnalyzed} clientes analisados):
- Segmentos predominantes: ${topSegments.map(([s, n]) => `${s} (${n})`).join(", ")}
- Profissões: ${topProfessions.map(([p, n]) => `${p} (${n})`).join(", ")}
- Estados: ${topStates.map(([s, n]) => `${s} (${n})`).join(", ")}
- Faturamento médio mensal: R$ ${avgRevenue.toFixed(0)}`;

      // 4) Buscar diagnósticos (dores reais)
      const { data: diagnostics } = await supabase
        .from("client_diagnostics")
        .select("pain_points, main_challenges, expectations, current_situation, short_term_goals, long_term_goals")
        .in("client_id", clientIds)
        .limit(50);

      if (diagnostics && diagnostics.length > 0) {
        const pains = diagnostics.map((d: any) => d.pain_points).filter(Boolean).slice(0, 15);
        const expectations = diagnostics.map((d: any) => d.expectations).filter(Boolean).slice(0, 10);
        const goals = diagnostics.map((d: any) => d.short_term_goals || d.long_term_goals).filter(Boolean).slice(0, 10);
        if (pains.length) clientsContext += `\n\nDORES RELATADAS POR CLIENTES REAIS:\n${pains.map((p: string) => `- ${p}`).join("\n")}`;
        if (expectations.length) clientsContext += `\n\nEXPECTATIVAS:\n${expectations.map((e: string) => `- ${e}`).join("\n")}`;
        if (goals.length) clientsContext += `\n\nMETAS DECLARADAS:\n${goals.map((g: string) => `- ${g}`).join("\n")}`;
      }
    }

    // 4.5) Buscar contexto do Instagram (perfil ativo da conta)
    let instagramContext = "";
    let instagramUsername: string | null = null;
    try {
      const igCtx = await fetchInstagramContext(supabase, accountId);
      if (igCtx?.profile) {
        instagramUsername = igCtx.profile.username;
        instagramContext = buildInstagramContextBlock(igCtx);
      }
    } catch (e) {
      console.error("fetchInstagramContext error:", e);
    }

    // 5) Contexto da persona atual
    let personaContext = "";
    if (currentPersona) {
      const filled = Object.entries(currentPersona)
        .filter(([k, v]) => v && (typeof v === "string" ? v.trim() : Array.isArray(v) ? v.length > 0 : false))
        .filter(([k]) => !["id", "account_id", "created_at", "updated_at", "ai_summary", "name", "avatar_emoji", "is_default", "learned_from_clients_at", "clients_analyzed_count"].includes(k))
        .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
        .join("\n");
      if (filled) personaContext = `\n\nO QUE JÁ FOI DEFINIDO NA PERSONA:\n${filled}`;
    }

    const systemPrompt = `Você é um estrategista de marketing sênior especializado no MERCADO DE ESTÉTICA brasileiro.

Sua missão é sugerir conteúdo PROFUNDO, ESPECÍFICO e ACIONÁVEL para o campo "${fieldConfig.label}" da Persona do cliente.

REGRAS CRÍTICAS:
- Use linguagem REAL do nicho, não clichês de marketing.
- Seja ESPECÍFICO ao mercado de estética avançada (médicas, biomédicas, dentistas com foco em HOF, esteticistas).
- NUNCA invente dados que contradigam os dados reais fornecidos.
- Se receber dados reais de clientes, BASEIE sua resposta neles.
- Se receber dados de PERFORMANCE REAL DO INSTAGRAM, use os formatos, hashtags e temas que JÁ funcionam para inferir o que ressoa com o público.
- Para campos como "vocabulary", "channels", "emotional_triggers" e "pains", priorize sinais vindos das captions e temas dos posts de melhor engajamento.
- Para arrays, retorne itens curtos e diretos (1 linha cada).
- Para texto, seja conciso (máx 3 frases).

Descrição do campo: ${fieldConfig.description}
Formato de retorno: ${fieldConfig.format === "array" ? "Array de strings (use a tool)" : "Texto único (use a tool)"}`;

    const userPrompt = `Sugira o melhor conteúdo possível para o campo "${fieldConfig.label}" da Persona.${clientsContext}${instagramContext}${personaContext}

Retorne APENAS o conteúdo do campo, no formato correto.`;

    // 6) Chamar Lovable AI com tool calling para garantir formato
    const tools = [{
      type: "function",
      function: {
        name: "suggest_field",
        description: `Retorna sugestão para o campo ${fieldConfig.label}`,
        parameters: fieldConfig.format === "array" ? {
          type: "object",
          properties: {
            items: { type: "array", items: { type: "string" }, description: "Lista de itens sugeridos" }
          },
          required: ["items"],
          additionalProperties: false,
        } : {
          type: "object",
          properties: {
            value: { type: "string", description: "Texto sugerido" }
          },
          required: ["value"],
          additionalProperties: false,
        },
      }
    }];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "suggest_field" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos na sua workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("IA não retornou sugestão estruturada");
    }
    const args = JSON.parse(toolCall.function.arguments);
    const suggestion = fieldConfig.format === "array" ? (args.items || []) : (args.value || "");

    return new Response(JSON.stringify({
      suggestion,
      format: fieldConfig.format,
      clientsAnalyzed,
      basedOnRealData: clientsAnalyzed > 0,
      instagramUsername,
      basedOnInstagram: !!instagramUsername,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("suggest-persona-field error:", err);
    return new Response(JSON.stringify({ error: err.message || "Erro inesperado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
