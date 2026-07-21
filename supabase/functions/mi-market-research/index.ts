import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ETERNUM_CONTEXT = `Contexto do solicitante: Eternum Mentoring Club — clube de mentoria premium para médicos e profissionais da estética avançada no Brasil (dermato, HOF, harmonização, procedimentos injetáveis). Produtos: Rykas, Conselho, Eternum, MVP. Ticket típico R$ 40k–R$ 200k. Persona: profissional já em operação querendo escalar clínica, autoridade e faturamento.`;

const SYSTEM_PROMPT = `Você é um analista sênior de inteligência de mercado especializado no setor de estética avançada, saúde e educação médica no Brasil. Sempre responda em PT-BR, com dados reais e atuais, números concretos quando disponíveis, e citando fontes. Estruture a resposta com títulos curtos e listas quando ajudar. NUNCA invente números — se não houver fonte confiável, diga explicitamente. NÃO use marcadores numéricos de citação como [1] no meio do texto; as fontes aparecerão separadamente.

${ETERNUM_CONTEXT}`;

const focusHints: Record<string, string> = {
  tam: "Foque em TAM/SAM/SOM: quantifique o tamanho de mercado (nº de profissionais, clínicas, faturamento estimado, CAGR).",
  concorrentes: "Foque em concorrentes diretos e indiretos: nomes, posicionamento, preços conhecidos, diferenciais.",
  cursos: "Foque em cursos, formações e programas de especialização disponíveis no Brasil, com formato, duração e faixa de preço.",
  tendencias: "Foque em tendências, dados recentes (últimos 12 meses), mudanças regulatórias e movimentos do mercado.",
  publico: "Foque em perfil e comportamento do público-alvo: dores, jornada, fontes de informação, decisão de compra.",
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
