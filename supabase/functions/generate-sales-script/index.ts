import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, accountId, scriptType, meetingType, customPrompt, websiteUrl, socialUrl } = await req.json();

    if (!userId || !accountId || !scriptType) {
      return new Response(JSON.stringify({ error: "userId, accountId and scriptType are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all materials for this user
    const { data: materials, error: matError } = await supabase
      .from("sales_materials")
      .select("*")
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .eq("is_active", true);

    if (matError) {
      console.error("Error fetching materials:", matError);
      throw new Error("Failed to fetch materials");
    }

    // Fetch user info
    const { data: userData } = await supabase
      .from("users")
      .select("name, email")
      .eq("id", userId)
      .maybeSingle();

    const { data: accountData } = await supabase
      .from("accounts")
      .select("name")
      .eq("id", accountId)
      .maybeSingle();

    // Build context from materials
    const materialsByType: Record<string, string[]> = {};
    (materials || []).forEach((m: any) => {
      if (!materialsByType[m.material_type]) materialsByType[m.material_type] = [];
      materialsByType[m.material_type].push(`**${m.title}**: ${m.content}`);
    });

    const materialContext = Object.entries(materialsByType)
      .map(([type, items]) => {
        const labels: Record<string, string> = {
          product: "📦 PRODUTO/SERVIÇO",
          pricing: "💰 PREÇO E CONDIÇÕES",
          icp: "🎯 ICP (CLIENTE IDEAL)",
          differentials: "⭐ DIFERENCIAIS",
          objections: "🛡️ OBJEÇÕES COMUNS",
          process: "📋 PROCESSO DE VENDAS",
        };
        return `### ${labels[type] || type}\n${items.join("\n\n")}`;
      })
      .join("\n\n");

    const scriptTypeLabels: Record<string, string> = {
      cold_call: "Script de Prospecção / Cold Call",
      sdr: "Script de Processo SDR",
      follow_up: "Script de Follow-up",
      objection_handling: "Script de Tratamento de Objeções",
      closing: "Script de Fechamento",
      qualification: "Script de Qualificação (SPIN/BANT)",
      presentation: "Script de Apresentação Comercial",
      whatsapp: "Script para WhatsApp/Mensagem",
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const empresaNome = accountData?.name || "Não informado";
    const responsavelNome = userData?.name || "Não informado";

    const systemPrompt = `Você é um consultor de vendas de alto nível. Sua função é gerar scripts de vendas personalizados baseados nos materiais cadastrados.

REGRA CRÍTICA: O script é para vender os PRODUTOS/SERVIÇOS da empresa "${empresaNome}" (vendedor: ${responsavelNome}). 
Use APENAS as informações dos materiais cadastrados para montar o script.

Sua missão é gerar um **${scriptTypeLabels[scriptType] || scriptType}** elegante, profissional e imediatamente aplicável.

REGRAS DE FORMATAÇÃO (OBRIGATÓRIO):
- Use # apenas para o título principal
- Use ## para seções principais (máximo 6-9 seções)
- Use ### para subseções quando necessário
- NÃO use ** em excesso. Use negrito APENAS para palavras-chave essenciais
- Use listas com • ou - para itens, intercale com parágrafos narrativos
- Use > para destacar falas do vendedor (citações diretas)
- Use --- para separar seções grandes
- Tom: profissional, consultivo, sofisticado — nunca robótico ou genérico

⚠️ PROIBIDO: NÃO use formato de árvore/organograma (├─, └─, │). Use APENAS Markdown padrão.

CONTEXTO DA REUNIÃO:
${meetingType === 'cold' ? `- Cold Call / contato frio. O prospect NÃO está esperando.
- Abertura rápida, educada, pedindo permissão.
- Conquiste atenção nos primeiros 10 segundos.` : `- Reunião AGENDADA previamente. O prospect já aceitou.
- Abertura calorosa, direta e profissional.`}

ESTRUTURA ESPERADA:
1. Título claro e objetivo
2. Contexto e objetivo do script
3. ${meetingType === 'cold' ? 'Abertura com proposta de valor (cold call)' : 'Abertura calorosa e direta (reunião agendada)'}
4. Etapas do processo com transição natural
5. Exemplos de falas usando > (citação)
6. Checklist final de preparação

DADOS:
- Empresa: ${empresaNome}
- Vendedor: ${responsavelNome}
${websiteUrl ? `- Site: ${websiteUrl}` : ""}
${socialUrl ? `- Rede social: ${socialUrl}` : ""}

MATERIAIS CADASTRADOS:
${materialContext || "⚠️ Nenhum material cadastrado. Gere um script genérico e indique quais materiais deveriam ser cadastrados."}

${customPrompt ? `\nINSTRUÇÃO ADICIONAL: ${customPrompt}` : ""}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 140000);

    let response: Response;
    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Gere o ${scriptTypeLabels[scriptType] || scriptType} completo.` },
          ],
          temperature: 0.7,
          max_completion_tokens: 4000,
        }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof DOMException && e.name === "AbortError") {
        return new Response(JSON.stringify({ error: "A geração demorou mais que o esperado. Tente novamente." }), {
          status: 504,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Failed to generate script");
    }

    const aiData = await response.json();
    const generatedContent = aiData.choices?.[0]?.message?.content || "";

    const titleMatch = generatedContent.match(/^#\s+(.+)$/m);
    const autoTitle = titleMatch
      ? titleMatch[1]
      : `${scriptTypeLabels[scriptType] || scriptType} - ${new Date().toLocaleDateString("pt-BR")}`;

    const { data: playbook, error: saveError } = await supabase
      .from("sales_playbooks")
      .insert({
        user_id: userId,
        account_id: accountId,
        title: autoTitle,
        content: generatedContent,
        script_type: scriptType,
        generated_from: {
          materials_count: materials?.length || 0,
          material_types: Object.keys(materialsByType),
          generated_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving playbook:", saveError);
      return new Response(JSON.stringify({ content: generatedContent, title: autoTitle, saved: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ...playbook, saved: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate script error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
