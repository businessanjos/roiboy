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

    const { userId, accountId, scriptContent, scriptTitle, scriptType, improvementGoal } = await req.json();

    if (!scriptContent) {
      return new Response(JSON.stringify({ error: "scriptContent is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { data: accountData } = await supabase
      .from("accounts")
      .select("name")
      .eq("id", accountId)
      .maybeSingle();

    const empresaNome = accountData?.name || "a empresa";

    const systemPrompt = `Você é um especialista em vendas consultivas e copywriting. 
Sua função é MELHORAR um script de vendas existente, tornando-o mais eficaz, profissional e persuasivo.

EMPRESA: ${empresaNome}
OBJETIVO DA MELHORIA: ${improvementGoal || "Tornar o script mais persuasivo, profissional e eficaz em conversão"}

REGRAS DE FORMATAÇÃO (OBRIGATÓRIO):
- Use # apenas para o título principal
- Use ## para seções principais (máximo 6-8 seções)
- Use ### para subseções quando necessário  
- Use > para destacar falas diretas do vendedor
- Tom: profissional, consultivo, sofisticado
- Mantenha a estrutura original, mas melhore a qualidade
- Adicione gatilhos mentais sutis (escassez, autoridade, prova social)
- Termine com um checklist de preparação se não houver um`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

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
            {
              role: "user",
              content: `Melhore o seguinte script de vendas:\n\n${scriptContent}\n\nGere a versão melhorada completa.`,
            },
          ],
          temperature: 0.7,
          max_completion_tokens: 4000,
        }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof DOMException && e.name === "AbortError") {
        return new Response(JSON.stringify({ error: "A geração demorou mais que o esperado." }), {
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
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Failed to improve script");
    }

    const aiData = await response.json();
    const improvedContent = aiData.choices?.[0]?.message?.content || "";

    const titleMatch = improvedContent.match(/^#\s+(.+)$/m);
    const autoTitle = titleMatch
      ? titleMatch[1]
      : scriptTitle
      ? `${scriptTitle} (Melhorado)`
      : `Script Melhorado - ${new Date().toLocaleDateString("pt-BR")}`;

    const { data: playbook, error: saveError } = await supabase
      .from("sales_playbooks")
      .insert({
        user_id: userId,
        account_id: accountId,
        title: autoTitle,
        content: improvedContent,
        script_type: scriptType || "cold_call",
        generated_from: {
          source: "manual_upload_improved",
          original_title: scriptTitle || "Script manual",
          improvement_goal: improvementGoal || null,
          generated_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving playbook:", saveError);
      return new Response(JSON.stringify({ content: improvedContent, title: autoTitle, saved: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ...playbook, saved: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Improve script error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
