// Generates an IDEAL SALES SCRIPT (playbook) by distilling patterns from
// multiple champion calls of the SAME product. This is NOT a call analysis —
// the output is an actionable, step-by-step script the team will follow.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChampionCall {
  created_at: string;
  analysis: string | null;
  transcript_preview?: string | null;
  icp_signals?: unknown;
}

interface Body {
  product_name: string;
  product_description?: string | null;
  custom_instructions?: string | null;
  previous_script?: string | null; // when provided, evolve it instead of starting from scratch
  champion_calls: ChampionCall[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    if (!body?.product_name) {
      return new Response(JSON.stringify({ error: "product_name é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(body.champion_calls) || body.champion_calls.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma call campeã enviada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const calls = body.champion_calls.slice(0, 10);
    const callsBlock = calls
      .map((c, i) => {
        const date = new Date(c.created_at).toLocaleDateString("pt-BR");
        const sig = c.icp_signals
          ? `\nICP extraído: ${JSON.stringify(c.icp_signals)}`
          : "";
        const analysis = (c.analysis || "").substring(0, 2500);
        const preview = (c.transcript_preview || "").substring(0, 600);
        return `### Call ${i + 1} (${date})${sig}\nANÁLISE:\n${analysis}\n\nTRECHO DA TRANSCRIÇÃO:\n${preview}`;
      })
      .join("\n\n---\n\n");

    const evolutionBlock = body.previous_script
      ? `\n\nVERSÃO ANTERIOR DESTE SCRIPT (evolua e melhore — não comece do zero, mantenha o que funcionou e refine com os novos aprendizados):\n\n${body.previous_script.substring(0, 6000)}`
      : "";

    const systemPrompt = `Você é o Diretor Comercial de uma empresa de alta performance. Sua função é destilar o padrão de sucesso de vendedores campeões em um SCRIPT/PLAYBOOK OPERACIONAL — não um resumo, não uma análise.

REGRAS DURAS:
1. NUNCA escreva "resumo", "análise", "diagnóstico", "pontos a melhorar", "erros do vendedor" ou notas críticas. Você está escrevendo o MANUAL DE CONDUÇÃO IDEAL.
2. Todo conteúdo deve ser INSTRUCIONAL e ACIONÁVEL: frases exatas para falar, perguntas exatas para fazer, técnicas para aplicar.
3. Sempre que possível, cite FRASES LITERAIS extraídas das calls campeãs (entre aspas) como exemplos de ouro.
4. O output é específico ao produto informado. Nada genérico.
5. Use markdown hierárquico (## etapas, ### sub-blocos, bullets para frases/perguntas).
6. Esse script será SEMPRE ATUALIZADO conforme novas calls campeãs entrarem — escreva como um documento vivo, com versão evolutiva.`;

    const userPrompt = `PRODUTO: ${body.product_name}${body.product_description ? `\nDESCRIÇÃO DO PRODUTO: ${body.product_description}` : ""}
QUANTIDADE DE CALLS CAMPEÃS ANALISADAS: ${calls.length}
${body.custom_instructions ? `\nORIENTAÇÕES DO GESTOR: ${body.custom_instructions}\n` : ""}
CALLS CAMPEÃS (use TODAS como base e cite frases literais quando possível):

${callsBlock}${evolutionBlock}

Gere o SCRIPT IDEAL agora, EXATAMENTE nesta estrutura (não invente outras seções, não escreva introduções/preâmbulos antes do título):

# Script Ideal — ${body.product_name}

## 🎯 Perfil de cliente que mais converte (ICP)
- Profissão / segmento / nicho que mais aparece nos campeões
- Faixa de ticket / faturamento / tamanho de operação
- Principais dores ativadas

## 🧠 Preparação (antes da call)
- Mindset
- Pesquisa prévia obrigatória sobre o lead
- Materiais à mão

## 👋 Abertura (primeiros 60 segundos)
- Frase de abertura LITERAL recomendada (entre aspas)
- Tom, ritmo e postura
- Quebra-gelo conectado ao nicho do lead

## 🔍 Sondagem / Qualificação
- Perguntas LITERAIS na ordem ideal (numeradas)
- Como reagir a cada tipo de resposta
- Sinais de compra a capturar

## 💎 Apresentação da Solução (${body.product_name})
- Pitch que mais converteu (versão LITERAL)
- Gatilhos e palavras-chave a usar
- Conexão dor → solução específica deste produto
- Provas sociais que mais funcionaram

## 🛡️ Contorno de Objeções
Para cada objeção recorrente:
- **Objeção:** "..." (literal)
- **Resposta vencedora:** "..." (literal, extraída dos campeões)

## 🤝 Fechamento
- Técnica de fechamento que mais apareceu
- Frase LITERAL de fechamento
- Como criar urgência de forma natural
- Como conduzir a próxima ação (pagamento/contrato)

## ⚡ Dicas de ouro dos campeões
- Padrões sutis (pausas, ritmo, escuta ativa)
- O que os campeões NUNCA fazem

## 🔄 Histórico de evolução
- Versão atual: gerada em ${new Date().toLocaleDateString("pt-BR")} a partir de ${calls.length} call(s) campeã(s)
- Próximas atualizações: adicionar novos aprendizados conforme calls campeãs forem chegando.

LEMBRE-SE: cada bullet precisa ser COPIÁVEL E APLICÁVEL na próxima call. Frases literais entre aspas sempre que possível.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        max_tokens: 6000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos esgotados. Adicione saldo em Configurações > Workspace > Uso." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erro ao gerar script ideal");
    }

    const data = await response.json();
    const script = data.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ script }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-ideal-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
