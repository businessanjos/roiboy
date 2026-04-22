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
    const { accountId, field, currentPersona, instagramProfileId } = await req.json();

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
    // Estratégia: ler primeiro do cache (atualizado por cron diário). Se vazio/ausente, calcular ao vivo e popular o cache.
    let instagramContext = "";
    let instagramUsername: string | null = null;
    let topHighlights: { formats: string[]; themes: string[]; hashtags: string[] } = { formats: [], themes: [], hashtags: [] };
    try {
      // 1) Tenta cache (filtrando por profile_id quando o usuário escolheu um perfil ativo)
      let cachedQuery = supabase
        .from("instagram_highlights_cache")
        .select("username, formats, themes, hashtags, computed_at, profile_id")
        .eq("account_id", accountId);
      if (instagramProfileId) cachedQuery = cachedQuery.eq("profile_id", instagramProfileId);
      const { data: cached } = await cachedQuery
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const fmtCached = (arr: any[], prefix = "") =>
        (arr || [])
          .map((it: any) =>
            typeof it === "string"
              ? it
              : it?.avg_engagement
                ? `${prefix}${it.label} (${it.avg_engagement}% eng)`
                : `${prefix}${it.label}${it.count ? ` (${it.count}x)` : ""}`,
          )
          .filter(Boolean);

      if (cached && (cached.formats?.length || cached.themes?.length || cached.hashtags?.length)) {
        instagramUsername = cached.username || null;
        topHighlights.formats = fmtCached(cached.formats as any[]);
        topHighlights.themes = fmtCached(cached.themes as any[]);
        topHighlights.hashtags = fmtCached(cached.hashtags as any[], "#");

        // Para o bloco completo de performance, ainda buscamos o contexto ao vivo (formato/hashtag stats são leves).
        try {
          const igCtx = await fetchInstagramContext(supabase, accountId, instagramProfileId);
          if (igCtx?.profile) instagramContext = buildInstagramContextBlock(igCtx);
        } catch (_) { /* opcional */ }
      } else {
        // 2) Fallback ao vivo + popula cache
        const igCtx = await fetchInstagramContext(supabase, accountId, instagramProfileId);
        if (igCtx?.profile) {
          instagramUsername = igCtx.profile.username;
          instagramContext = buildInstagramContextBlock(igCtx);

          const top = (igCtx.topPosts || []).slice(0, 20);
          const tally = (arr: (string | null | undefined)[]) => {
            const map: Record<string, number> = {};
            arr.forEach((v) => {
              const k = (v || "").toString().trim();
              if (!k) return;
              map[k] = (map[k] || 0) + 1;
            });
            return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} (${n}x)`);
          };
          topHighlights.formats = tally(top.map((p) => p.post_type));
          topHighlights.themes = tally(top.map((p) => p.theme));
          topHighlights.hashtags = (igCtx.topHashtags || []).slice(0, 3).map((h) => `#${h.tag} (${h.avg_engagement}% eng)`);

          // Popula cache em background (best-effort) — usa o profileId fornecido OU resolve pelo username
          try {
            let resolvedProfileId = instagramProfileId || null;
            if (!resolvedProfileId) {
              const { data: profile } = await supabase
                .from("instagram_profiles")
                .select("id")
                .eq("account_id", accountId)
                .eq("username", igCtx.profile.username)
                .maybeSingle();
              resolvedProfileId = profile?.id || null;
            }
            if (resolvedProfileId) {
              await supabase.from("instagram_highlights_cache").upsert({
                account_id: accountId,
                profile_id: resolvedProfileId,
                username: igCtx.profile.username,
                formats: tally(top.map((p) => p.post_type)).map((s) => ({ label: s.split(" (")[0], count: Number(s.match(/\((\d+)x\)/)?.[1] || 0) })),
                themes: tally(top.map((p) => p.theme)).map((s) => ({ label: s.split(" (")[0], count: Number(s.match(/\((\d+)x\)/)?.[1] || 0) })),
                hashtags: (igCtx.topHashtags || []).slice(0, 3).map((h) => ({ label: h.tag, count: h.uses, avg_engagement: h.avg_engagement })),
                posts_analyzed: top.length,
                computed_at: new Date().toISOString(),
                source: "fallback",
              }, { onConflict: "profile_id" });
            }
          } catch (_) { /* ignore */ }
        }
      }

      const hl: string[] = [];
      if (topHighlights.formats.length) hl.push(`- TOP 3 FORMATOS que mais engajam: ${topHighlights.formats.join(", ")}`);
      if (topHighlights.themes.length) hl.push(`- TOP 3 TEMAS que mais engajam: ${topHighlights.themes.join(", ")}`);
      if (topHighlights.hashtags.length) hl.push(`- TOP 3 HASHTAGS de melhor performance: ${topHighlights.hashtags.join(", ")}`);
      if (hl.length) {
        instagramContext += `\n\n=== DESTAQUES (use estes sinais como PRIORIDADE ao sugerir o campo) ===\n${hl.join("\n")}`;
      }
    } catch (e) {
      console.error("instagram highlights error:", e);
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

    const hasHighlights = topHighlights.formats.length + topHighlights.themes.length + topHighlights.hashtags.length > 0;

    // ============== Builders de prompt ==============
    const buildSystemPrompt = (withHighlights: boolean) => `Você é um estrategista de marketing sênior especializado no MERCADO DE ESTÉTICA brasileiro.

Sua missão é sugerir conteúdo PROFUNDO, ESPECÍFICO e ACIONÁVEL para o campo "${fieldConfig.label}" da Persona do cliente.

${withHighlights ? `=== HIERARQUIA DE PRIORIDADE DAS FONTES (OBRIGATÓRIA) ===
Quando houver conflito ou escolha entre sinais, siga esta ordem RÍGIDA — nunca inverta:

1. 🥇 DESTAQUES DO INSTAGRAM (Top 3 formatos, temas e hashtags) — PESO MÁXIMO.
   São a evidência empírica do que JÁ ressoa com o público. Devem moldar:
   - vocabulary: extraia palavras/expressões dos temas e hashtags top.
   - emotional_triggers / pains / desires: infira o que esses temas tocam emocionalmente.
   - channels / references_consumed: priorize formatos que performam (ex: Reels educativo).
   - tom geral de QUALQUER campo: alinhe ao que engaja.
   Se um destaque contradisser um dado de CRM/diagnóstico, o DESTAQUE VENCE.

2. 🥈 DADOS REAIS DE CLIENTES (CRM Rykas + Eternum) — peso médio.
   Use para grounding demográfico/firmográfico (profissão, faturamento, localização, segmento).

3. 🥉 DIAGNÓSTICOS (dores/expectativas declaradas) — peso de apoio.

4. 📚 Conhecimento geral do nicho — fallback apenas se nenhum dado real existir.

` : `Use os dados reais de clientes (CRM) e diagnósticos como base principal.
`}REGRAS CRÍTICAS:
- Use linguagem REAL do nicho, não clichês de marketing.
- Seja ESPECÍFICO ao mercado de estética avançada (médicas, biomédicas, dentistas com foco em HOF, esteticistas).
- NUNCA invente dados que contradigam os dados reais fornecidos.
- Para arrays, retorne itens curtos e diretos (1 linha cada).
- Para texto, seja conciso (máx 3 frases).

Descrição do campo: ${fieldConfig.description}
Formato de retorno: ${fieldConfig.format === "array" ? "Array de strings (use a tool)" : "Texto único (use a tool)"}`;

    const buildUserPrompt = (withHighlights: boolean) => {
      const igBlock = withHighlights ? instagramContext : "";
      return `Sugira o melhor conteúdo possível para o campo "${fieldConfig.label}" da Persona.${withHighlights && hasHighlights ? "\n\n⚠️ LEMBRETE: o bloco DESTAQUES tem PESO MÁXIMO. Ancore a sugestão neles primeiro." : ""}
${clientsContext}${igBlock}${personaContext}

Retorne APENAS o conteúdo do campo, no formato correto.`;
    };

    // 6) Tool schema
    const tools = [{
      type: "function",
      function: {
        name: "suggest_field",
        description: `Retorna sugestão para o campo ${fieldConfig.label}`,
        parameters: fieldConfig.format === "array" ? {
          type: "object",
          properties: { items: { type: "array", items: { type: "string" }, description: "Lista de itens sugeridos" } },
          required: ["items"],
          additionalProperties: false,
        } : {
          type: "object",
          properties: { value: { type: "string", description: "Texto sugerido" } },
          required: ["value"],
          additionalProperties: false,
        },
      }
    }];

    const callAI = async (withHighlights: boolean) => {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: buildSystemPrompt(withHighlights) },
            { role: "user", content: buildUserPrompt(withHighlights) },
          ],
          tools,
          tool_choice: { type: "function", function: { name: "suggest_field" } },
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("AI gateway error:", res.status, errText);
        const err: any = new Error(`AI gateway: ${res.status}`);
        err.status = res.status;
        throw err;
      }
      const data = await res.json();
      const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("IA não retornou sugestão estruturada");
      const args = JSON.parse(toolCall.function.arguments);
      return fieldConfig.format === "array" ? (args.items || []) : (args.value || "");
    };

    // 7) Rodar A (com DESTAQUES) e B (sem) em paralelo
    let suggestionA: any = null;
    let suggestionB: any = null;
    let aiError: any = null;
    try {
      const [resA, resB] = await Promise.all([
        callAI(true),
        callAI(false),
      ]);
      suggestionA = resA;
      suggestionB = resB;
    } catch (e: any) {
      aiError = e;
    }

    if (aiError) {
      const status = aiError.status || 500;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos na sua workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw aiError;
    }

    // 8) Registrar A/B test no banco
    let abTestId: string | null = null;
    try {
      // Resolver user_id interno (tabela public.users)
      let internalUserId: string | null = null;
      try {
        const authHeader = req.headers.get("Authorization") || "";
        const token = authHeader.replace("Bearer ", "");
        if (token) {
          const { data: { user } } = await supabase.auth.getUser(token);
          if (user) {
            const { data: u } = await supabase.from("users").select("id").eq("auth_user_id", user.id).maybeSingle();
            internalUserId = u?.id || null;
          }
        }
      } catch (_) { /* ignore */ }

      const { data: ab, error: abErr } = await supabase
        .from("marketing_persona_ab_tests")
        .insert({
          account_id: accountId,
          user_id: internalUserId,
          field,
          field_format: fieldConfig.format,
          variant_a_suggestion: { value: suggestionA },
          variant_a_has_highlights: hasHighlights,
          variant_b_suggestion: { value: suggestionB },
          instagram_username: instagramUsername,
          clients_analyzed: clientsAnalyzed,
          highlights_snapshot: topHighlights,
        })
        .select("id")
        .single();
      if (abErr) console.error("ab insert error:", abErr);
      else abTestId = ab?.id || null;
    } catch (e) {
      console.error("ab persistence error:", e);
    }

    return new Response(JSON.stringify({
      // compat: sugestão default = variante A (com destaques) se há highlights, senão B
      suggestion: hasHighlights ? suggestionA : suggestionB,
      format: fieldConfig.format,
      clientsAnalyzed,
      basedOnRealData: clientsAnalyzed > 0,
      instagramUsername,
      basedOnInstagram: !!instagramUsername,
      instagramHighlights: topHighlights,
      // A/B test
      abTestId,
      variantA: suggestionA,
      variantB: suggestionB,
      hasHighlights,
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

