import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MARKET_SCOPE = `OBJETO DE TODA ANÁLISE: o MERCADO DE ESTÉTICA AVANÇADA/MÉDICA NO BRASIL — clínicas, profissionais, procedimentos, faturamento, distribuição geográfica, tendências. Este é o SUJEITO da resposta.

Quem vai LER a análise é a Eternum Mentoring Club (mentoria B2B para donos de clínica de estética). Ela é apenas o LEITOR — nunca o objeto. Não calcule tamanho de mercado de mentoria, não estime faturamento potencial de educação/mentoria. O que interessa é: quantas clínicas existem, onde estão, quanto faturam, quais procedimentos, quais nichos, quem é cliente de quem, onde há praças ainda inexploradas.

ESCOPO obrigatório:
- INCLUIR: clínicas e profissionais de estética avançada/médica — procedimentos injetáveis (toxina, preenchedor, bioestimulador), laser, tecnologias (RF, ultrassom microfocado, criolipólise), harmonização facial/corporal, dermato clínica/estética, HOF odontológica, biomedicina estética, medicina estética.
- EXCLUIR: salões de beleza, cabeleireiros, barbearias, manicure/pedicure, depilação simples, estética capilar, SPAs de relaxamento, centros de bem-estar sem procedimentos estéticos.
- Se a fonte misturar os dois universos (ex.: CNAE 9602-5/02), diga explicitamente e traga a fração estimada só de estética avançada — nunca devolva o número total sem ressalva.`;

const SYSTEM_PROMPT = `Você é um analista sênior de inteligência de mercado do setor de ESTÉTICA AVANÇADA/MÉDICA NO BRASIL. Sempre responda em PT-BR com dados reais, atuais e citando fontes. NUNCA invente números — se não houver fonte confiável, diga explicitamente. NÃO use marcadores numéricos de citação como [1] no meio do texto; as fontes aparecerão separadamente.

FORMATO OBRIGATÓRIO da resposta (siga à risca — a UI depende dessa estrutura para renderizar cards visuais):

## Resumo
Uma frase curta (máx. 2 linhas) com a resposta principal — sem rodeios, comece pelo número/conclusão. NUNCA prefixe com "TL;DR", "TLDR", "TL:DR", "Resumo:", "Em resumo" ou similares — escreva a frase direto.

## Números-chave
- **Rótulo curto**: valor com número — detalhe/fonte breve
- **Rótulo curto**: valor com número — detalhe/fonte breve
(3 a 6 bullets, sempre no formato "- **Label**: valor". O valor DEVE conter número, % ou R$. Mantenha valores curtos, ex.: "12.400", "R$ 8,5 bi", "+18% a.a.". Coloque o detalhe/contexto após um travessão " — ".)

## Contexto & interpretação
2 a 4 parágrafos curtos OU bullets explicando o que os números do MERCADO significam (concentração geográfica, porte, tendências).

## Oportunidades / Riscos
Bullets objetivos apontando praças/nichos/segmentos do MERCADO DE ESTÉTICA com maior potencial ou risco — nunca sobre o produto do leitor.

Regras: seções curtas, direto ao ponto, zero enrolação. Sem introdução tipo "aqui está a resposta". Nada de "espero que ajude". Priorize densidade informacional — o leitor deve entender batendo o olho.

${MARKET_SCOPE}`;

const focusHints: Record<string, string> = {
  tam: "Foque em TAM/SAM/SOM DO MERCADO DE ESTÉTICA (não de mentoria): nº de clínicas, nº de profissionais habilitados, faturamento anual do setor no Brasil, CAGR, distribuição por região/nicho.",
  concorrentes: "Foque em players do MERCADO DE ESTÉTICA: grandes redes (Onodera, Ecad, Espaçolaser no que couber, Océane Clínicas), franquias de estética avançada, clínicas independentes de referência — posicionamento, preços, diferenciais.",
  cursos: "Foque em formações do MERCADO DE ESTÉTICA (dermato, medicina estética, HOF, biomedicina estética, esteticista com formação avançada) disponíveis no Brasil — formato, duração, preço.",
  tendencias: "Foque em tendências do MERCADO DE ESTÉTICA nos últimos 12 meses: procedimentos em alta, regulação (ANVISA, CFM, CFO, CFBM), tecnologias novas, movimentos de M&A e franquias.",
  publico: "Foque no perfil do PACIENTE de estética avançada no Brasil: dores, jornada de decisão, ticket médio por procedimento, canais de descoberta.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({ error: "PERPLEXITY_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const query: string = (body?.query || "").toString().trim();
    const focus: string | null = body?.focus ? String(body.focus) : null;
    const recency: string = body?.recency || "month"; // day|week|month|year
    const model: string = body?.model || "sonar-pro";

    if (!query || query.length < 5) {
      return new Response(
        JSON.stringify({ error: "Descreva a pergunta com pelo menos 5 caracteres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Descobrir account_id do chamador
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    let accountId: string | null = null;
    let userId: string | null = null;
    if (token) {
      const { data: userRes } = await supabase.auth.getUser(token);
      userId = userRes?.user?.id ?? null;
      if (userId) {
        const { data: u } = await supabase
          .from("users")
          .select("account_id")
          .eq("auth_user_id", userId)
          .maybeSingle();
        accountId = (u as any)?.account_id ?? null;
      }
    }

    const focusBlock = focus && focusHints[focus] ? `\n\nInstrução extra: ${focusHints[focus]}` : "";
    const userPrompt = `${query}${focusBlock}`;

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        search_recency_filter: recency,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("Perplexity error", res.status, txt);
      if (res.status === 401 && txt.includes("insufficient_quota")) {
        return new Response(
          JSON.stringify({
            error:
              "Créditos da API Perplexity esgotados. Compre créditos em https://console.perplexity.ai (créditos de API são separados da assinatura Pro).",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: `Perplexity ${res.status}: ${txt.slice(0, 300)}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await res.json();
    const answer: string = data?.choices?.[0]?.message?.content ?? "";
    const rawCitations: any[] = data?.citations || data?.search_results || [];
    const citations = rawCitations
      .map((c: any, i: number) => {
        if (typeof c === "string") return { index: i + 1, url: c, title: null };
        return {
          index: i + 1,
          url: c?.url || c?.link || null,
          title: c?.title || c?.name || null,
        };
      })
      .filter((c) => c.url);

    let saved: any = null;
    if (accountId) {
      const { data: ins, error: insErr } = await supabase
        .from("mi_market_research")
        .insert({
          account_id: accountId,
          query,
          focus,
          answer,
          citations,
          model,
          recency,
          created_by: userId,
        })
        .select()
        .single();
      if (insErr) console.error("mi_market_research insert error", insErr);
      else saved = ins;
    }

    return new Response(
      JSON.stringify({ success: true, answer, citations, model, saved }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("mi-market-research error", e);
    return new Response(
      JSON.stringify({ error: e?.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
