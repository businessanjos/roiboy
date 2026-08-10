// FAQ do Financeiro: responde perguntas em linguagem natural usando SOMENTE
// os artigos cadastrados em financial_faq_articles. Se não houver artigo que
// cubra a dúvida, responde explicitamente que ainda não está implementado/documentado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const SYSTEM_PROMPT = `Você é o assistente de ajuda do módulo Financeiro de um ERP interno (ROY APP).
Responda SEMPRE em PT-BR, de forma curta e operacional.

REGRAS ABSOLUTAS:
1. Use EXCLUSIVAMENTE o conteúdo dos artigos fornecidos no contexto. Nunca invente telas, botões, menus ou fluxos.
2. Se nenhum artigo cobrir a dúvida, responda com status "not_found" e diga que o passo a passo ainda não está documentado/implementado.
3. Se o artigo relevante estiver marcado como status "not_implemented" ou "planned", responda com status "not_implemented" e explique que a funcionalidade ainda não existe na plataforma.
4. Não misture artigos diferentes em um mesmo passo a passo, a não ser que a pergunta realmente envolva dois fluxos.

Devolva EXCLUSIVAMENTE um JSON válido (sem markdown, sem crases):
{
  "status": "answered" | "not_implemented" | "not_found",
  "article_id": "uuid do artigo usado ou null",
  "title": "título curto da resposta",
  "summary": "1-2 frases respondendo direto",
  "steps": ["Passo 1...", "Passo 2..."],
  "related_route": "rota do app citada pelo artigo ou null",
  "related_article_ids": ["uuids de outros artigos úteis"]
}
Para "not_found" ou "not_implemented", "steps" pode ser [] e "summary" deve explicar o que fazer (ex.: pedir para o time do Financeiro cadastrar o passo a passo).`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Informe uma pergunta com pelo menos 3 caracteres." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: articles, error } = await supabase
      .from("financial_faq_articles")
      .select("id, question, answer_steps, category, keywords, status, related_route")
      .eq("is_published", true)
      .order("display_order", { ascending: true })
      .limit(300);

    if (error) {
      console.error("faq fetch error", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({
          status: "not_found",
          title: "Nenhum artigo cadastrado",
          summary: "O FAQ do Financeiro ainda não tem conteúdo cadastrado. Peça para um gestor adicionar o passo a passo.",
          steps: [],
          article_id: null,
          related_route: null,
          related_article_ids: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const context = articles
      .map(
        (a: any) =>
          `### ARTIGO ${a.id}\nPergunta: ${a.question}\nCategoria: ${a.category}\nStatus: ${a.status}\nRota: ${a.related_route ?? "-"}\nPalavras-chave: ${(a.keywords ?? []).join(", ")}\nPasso a passo:\n${a.answer_steps}`,
      )
      .join("\n\n");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "IA não configurada." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `PERGUNTA DO USUÁRIO:\n${query}\n\nARTIGOS DISPONÍVEIS:\n${context}` },
        ],
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "Muitas requisições à IA. Tente novamente em instantes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados no workspace." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!res.ok) {
      const txt = await res.text();
      console.error("ai gateway error", res.status, txt.slice(0, 300));
      return new Response(JSON.stringify({ error: `Falha na IA (${res.status}).` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    let parsed: any = null;
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch (e) {
        console.error("parse error", e, raw.slice(0, 300));
      }
    }

    if (!parsed) {
      return new Response(JSON.stringify({ error: "Não consegui interpretar a resposta. Tente reformular." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guardrail: só aceita article_id que realmente existe
    const ids = new Set(articles.map((a: any) => a.id));
    if (parsed.article_id && !ids.has(parsed.article_id)) parsed.article_id = null;
    parsed.related_article_ids = (parsed.related_article_ids ?? []).filter((id: string) => ids.has(id));
    if (parsed.status === "answered" && !parsed.article_id) parsed.status = "not_found";

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("financial-faq-search error", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
