import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const { agentId, messages } = await req.json();

    if (!agentId || !messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "agentId e messages são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar configuração do agente
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: agent, error: agentError } = await supabase
      .from("ai_sector_agents")
      .select("*")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      console.error("Erro ao buscar agente:", agentError);
      return new Response(
        JSON.stringify({ error: "Agente não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!agent.is_enabled) {
      return new Response(
        JSON.stringify({ error: "Agente desabilitado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Construir prompt do sistema
    const systemPrompt = buildSystemPrompt(agent);

    // Mapear modelo configurado para modelo Lovable AI
    const modelMap: Record<string, string> = {
      "gemini-2.5-flash": "google/gemini-2.5-flash",
      "gemini-2.5-pro": "google/gemini-2.5-pro",
      "gemini-2.5-flash-lite": "google/gemini-2.5-flash-lite",
      "gpt-5": "openai/gpt-5",
      "gpt-5-mini": "openai/gpt-5-mini",
    };

    const model = modelMap[agent.model] || "google/gemini-2.5-flash";

    console.log(`[sector-agent-chat] Agente: ${agent.name}, Modelo: ${model}`);

    // Chamar Lovable AI com streaming
    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
        temperature: agent.temperature || 0.7,
        max_tokens: agent.max_tokens || 2048,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Erro na Lovable AI:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar resposta da IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Retornar stream
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Erro no sector-agent-chat:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildSystemPrompt(agent: any): string {
  const parts: string[] = [];

  // Nome e descrição
  parts.push(`Você é ${agent.display_name}, um assistente de IA especializado.`);

  if (agent.description) {
    parts.push(agent.description);
  }

  // Personalidade
  if (agent.personality) {
    parts.push(`\nSua personalidade: ${agent.personality}`);
  }

  // Prompt customizado
  if (agent.system_prompt) {
    parts.push(`\n${agent.system_prompt}`);
  }

  // Features habilitadas
  const features = agent.features || {};
  const enabledFeatures: string[] = [];

  if (features.can_query_data) enabledFeatures.push("consultar dados do sistema");
  if (features.can_create_entries) enabledFeatures.push("criar lançamentos financeiros");
  if (features.can_generate_reports) enabledFeatures.push("gerar relatórios");
  if (features.can_send_reminders) enabledFeatures.push("enviar lembretes");

  if (enabledFeatures.length > 0) {
    parts.push(`\nVocê pode: ${enabledFeatures.join(", ")}.`);
  }

  // Instruções gerais
  parts.push(`
Diretrizes:
- Responda sempre em português brasileiro
- Seja conciso mas completo
- Use formatação markdown quando apropriado
- Se não souber algo, admita e sugira alternativas
- Mantenha um tom profissional mas amigável`);

  return parts.join("\n");
}
