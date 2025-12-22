import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Default prompts (fallback if not configured) - CALIBRAÇÃO CONSERVADORA
const DEFAULT_SYSTEM_PROMPT = `Você é o ROIBOY Analyzer, um especialista em identificar percepção de ROI, sinais de risco e momentos importantes da vida do cliente em conversas entre mentores/consultores e seus clientes.

═══════════════════════════════════════════════════════════════
⚠️ SENSIBILIDADE: MUITO CONSERVADORA - EVITE FALSOS POSITIVOS ⚠️
═══════════════════════════════════════════════════════════════

REGRAS ABSOLUTAS:
1. SÓ classifique quando houver EVIDÊNCIA CLARA e EXPLÍCITA
2. Mensagens genéricas, saudações, confirmações simples = IGNORAR
3. Na MENOR dúvida = NÃO classifique (retorne arrays vazios)
4. Prefira NÃO detectar do que criar falso positivo
5. Confiança mínima: 0.75 - seja rigoroso

═══════════════════════════════════════════════════════════════
MENSAGENS QUE DEVEM SER IGNORADAS (NÃO são ROI nem Risco):
═══════════════════════════════════════════════════════════════

IGNORAR COMPLETAMENTE:
✗ Saudações: "oi", "olá", "bom dia", "tudo bem?"
✗ Confirmações: "ok", "certo", "blz", "combinado", "perfeito"
✗ Agendamentos: "vou participar", "estarei lá", "confirmado"
✗ Perguntas operacionais: "que horas?", "onde é?", "como faço?"
✗ Respostas curtas: "sim", "não", "pode ser", "vamos ver"
✗ Emojis isolados ou respostas com apenas emojis
✗ Áudios transcritos genéricos sem conteúdo específico
✗ Mensagens de menos de 30 caracteres (geralmente)
✗ "Obrigado" ou "Valeu" isolados (sem contexto de resultado)

═══════════════════════════════════════════════════════════════
TAXONOMIA DE ROI (Percepção de Valor pelo Cliente)
═══════════════════════════════════════════════════════════════

SÓ É ROI SE:
- Cliente menciona RESULTADO CONCRETO alcançado
- Há NÚMEROS ou EVIDÊNCIA ESPECÍFICA
- A gratidão está VINCULADA a um resultado específico

TANGÍVEL (resultados mensuráveis com números):
- revenue: "fechei X contratos", "vendi R$ X", "faturei X"
- cost: "economizei R$ X", "reduzi X% dos custos"
- time: "ganhei X horas", "fiz em X dias ao invés de Y"
- process: "automatizei X", "implementei o processo de Y"

INTANGÍVEL (deve ser ESPECÍFICO, não genérico):
- clarity: "entendi COMO fazer X", "ficou claro que preciso de Y"
- confidence: "agora sei que consigo fazer X", "perdi o medo de Y"
- tranquility: "estou dormindo melhor porque resolvi X"
- status_direction: "fui promovido", "ganhei prêmio de X"

NÃO É ROI:
✗ "Obrigado" sem contexto específico
✗ "Foi ótimo" sem dizer o que foi ótimo
✗ "Aprendi muito" sem dizer o que aprendeu
✗ "Valeu pelas dicas" sem resultado

EXEMPLOS DE ROI VÁLIDO:
✓ "Fechei 3 contratos essa semana usando o método que você ensinou!" → revenue/high/0.9
✓ "Reduzi 30% do custo operacional implementando o que discutimos" → cost/high/0.9
✓ "Entendi finalmente como estruturar minha proposta comercial, vou aplicar segunda" → clarity/medium/0.75
✓ "Fui promovido a gerente! Muito do que aprendi aqui me ajudou" → status_direction/high/0.85

EXEMPLOS QUE NÃO SÃO ROI:
✗ "Muito bom!" → NÃO (genérico demais)
✗ "Valeu!" → NÃO (sem contexto)
✗ "Adorei a aula" → NÃO (não menciona resultado)
✗ "Foi esclarecedor" → NÃO (muito vago)

═══════════════════════════════════════════════════════════════
SINAIS DE RISCO (Churn/Insatisfação) - MUITO CONSERVADOR
═══════════════════════════════════════════════════════════════

SÓ É RISCO SE:
- Cliente expressa INSATISFAÇÃO EXPLÍCITA
- Há menção CLARA de problema financeiro para pagamento
- Cliente PEDE para cancelar/pausar/sair
- Cliente RECLAMA diretamente do serviço

DETECTAR RISCO QUANDO:
⚠️ "Não estou vendo resultado NENHUM" → high
⚠️ "Não vou conseguir pagar esse mês" → high  
⚠️ "Quero cancelar/pausar/sair" → high
⚠️ "O [concorrente] oferece X que vocês não têm" → medium
⚠️ "Estou insatisfeito com X" → medium

NÃO É RISCO (NUNCA classifique):
✗ Perguntas sobre preço/valor/renovação
✗ Pedido de desconto em contexto de renovação
✗ "Vou analisar" ou "Vou pensar"
✗ Dúvidas técnicas ou operacionais
✗ Cliente sumido (isso é silêncio, não risco explícito)
✗ "Tá caro" sem dizer que vai cancelar
✗ Qualquer negociação de preço

═══════════════════════════════════════════════════════════════
MOMENTOS CX (Life Events) - CONSERVADOR
═══════════════════════════════════════════════════════════════

SÓ detecte eventos de vida quando:
- Cliente menciona EXPLICITAMENTE o evento
- Há CONTEXTO claro (não apenas "estou feliz")

Tipos válidos:
- birthday: "meu aniversário é dia X", "faço X anos"
- child_birth: "meu filho nasceu", "virei pai/mãe"
- wedding: "vou casar", "me casei"
- graduation: "me formei em X"
- promotion: "fui promovido a X"
- new_job: "comecei emprego novo na empresa X"

NÃO detecte:
✗ "Semana difícil" → NÃO (muito vago)
✗ "Tô feliz" → NÃO (sem evento específico)
✗ "Mudanças acontecendo" → NÃO (vago)

═══════════════════════════════════════════════════════════════
REGRAS FINAIS
═══════════════════════════════════════════════════════════════

1. MENOS É MAIS: É melhor não detectar do que criar falso positivo
2. CONTEXTO OBRIGATÓRIO: Sem contexto específico = não classifique
3. CONFIANÇA ALTA: Se confiança < 0.75, não inclua
4. EVIDÊNCIA TEXTUAL: O evidence_snippet deve PROVAR a classificação
5. ARRAYS VAZIOS: Na dúvida, retorne roi_events: [], risk_events: [], life_events: []`;

const DEFAULT_ROI_PROMPT = `APENAS detecte ROI quando houver:
- RESULTADO CONCRETO mencionado (números, conquistas específicas)
- GRATIDÃO vinculada a resultado específico
- IMPLEMENTAÇÃO de algo aprendido com resultado
NÃO classifique agradecimentos genéricos, elogios vagos ou confirmações.`;

const DEFAULT_RISK_PROMPT = `APENAS detecte risco quando houver:
- INSATISFAÇÃO EXPLÍCITA com o serviço
- PEDIDO de cancelamento/pausa
- PROBLEMA FINANCEIRO mencionado para pagamento
NÃO classifique: negociações, perguntas sobre preço, "vou pensar", silêncio.`;

const DEFAULT_LIFE_EVENTS_PROMPT = "APENAS detecte eventos quando o cliente mencionar EXPLICITAMENTE: aniversários com data, nascimentos, casamentos, formaturas, promoções, novo emprego. NÃO detecte menções vagas ou sem contexto claro.";

interface AISettings {
  model: string;
  system_prompt: string;
  roi_prompt: string;
  risk_prompt: string;
  life_events_prompt: string;
  min_message_length: number;
  confidence_threshold: number;
  auto_analysis_enabled: boolean;
}

async function getAISettings(supabase: any, accountId: string): Promise<AISettings> {
  const { data, error } = await supabase
    .from("account_settings")
    .select("ai_model, ai_system_prompt, ai_roi_prompt, ai_risk_prompt, ai_life_events_prompt, ai_min_message_length, ai_confidence_threshold, ai_auto_analysis_enabled")
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching AI settings:", error);
  }

  return {
    model: data?.ai_model || "google/gemini-2.5-flash",
    system_prompt: data?.ai_system_prompt || DEFAULT_SYSTEM_PROMPT,
    roi_prompt: data?.ai_roi_prompt || DEFAULT_ROI_PROMPT,
    risk_prompt: data?.ai_risk_prompt || DEFAULT_RISK_PROMPT,
    life_events_prompt: data?.ai_life_events_prompt || DEFAULT_LIFE_EVENTS_PROMPT,
    min_message_length: data?.ai_min_message_length ?? 50, // Aumentado de 20 para 50
    confidence_threshold: data?.ai_confidence_threshold ?? 0.75, // Aumentado de 0.7 para 0.75
    auto_analysis_enabled: data?.ai_auto_analysis_enabled ?? true,
  };
}

function buildSystemPrompt(settings: AISettings): string {
  // If custom system prompt is set, use it; otherwise build from components
  if (settings.system_prompt !== DEFAULT_SYSTEM_PROMPT) {
    return `${settings.system_prompt}

INSTRUÇÕES ADICIONAIS:

ROI: ${settings.roi_prompt}

RISCOS: ${settings.risk_prompt}

MOMENTOS CX: ${settings.life_events_prompt}`;
  }
  return settings.system_prompt;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { message_event_id, content_text, client_id, account_id, source } = await req.json();

    if (!content_text || !client_id || !account_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch AI settings for this account
    const aiSettings = await getAISettings(supabase, account_id);
    console.log(`AI Settings loaded for account ${account_id}:`, {
      model: aiSettings.model,
      min_message_length: aiSettings.min_message_length,
      auto_analysis_enabled: aiSettings.auto_analysis_enabled,
    });

    // Check if auto analysis is enabled
    if (!aiSettings.auto_analysis_enabled) {
      console.log(`Auto analysis disabled for account ${account_id}, skipping`);
      return new Response(
        JSON.stringify({ success: true, message: "Auto analysis disabled", skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check minimum message length
    if (content_text.length < aiSettings.min_message_length) {
      console.log(`Message too short (${content_text.length} < ${aiSettings.min_message_length}), skipping analysis`);
      return new Response(
        JSON.stringify({ success: true, message: "Message too short for analysis", skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pre-filter: Skip messages that are clearly not actionable (save AI tokens)
    const normalizedText = content_text.toLowerCase().trim();
    const SKIP_PATTERNS = [
      // Saudações e despedidas
      /^(oi|olá|ola|hey|e ai|eai|boa tarde|bom dia|boa noite|fala|salve)[\s!.,?]*$/i,
      /^(tchau|até|ate|flw|vlw|valeu|obrigado|obrigada|brigado|brigada)[\s!.,?]*$/i,
      // Confirmações simples
      /^(ok|okay|certo|combinado|blz|beleza|perfeito|show|massa|top|legal|boa|bora|vamos|sim|não|nao|s|n)[\s!.,?]*$/i,
      // Respostas curtas genéricas
      /^(entendi|entendido|anotado|fechado|pode ser|tá bom|ta bom|tudo bem|tranquilo|de boa|suave)[\s!.,?]*$/i,
      // Apenas emojis ou pontuação
      /^[\s\p{Emoji}\p{Emoji_Presentation}!?.,:;()]+$/u,
      // Risadas
      /^[kha]+$/i,
      /^(rs|rsrs|rsrsrs|haha|hehe|kkk|kkkk)+[\s!]*$/i,
      // Áudios genéricos (transcrições muito curtas)
      /^(\[áudio\]|\[audio\]|\[voz\])$/i,
    ];

    const shouldSkip = SKIP_PATTERNS.some(pattern => pattern.test(normalizedText));
    if (shouldSkip) {
      console.log(`Message skipped by pre-filter (generic pattern): "${normalizedText.substring(0, 50)}"`);
      return new Response(
        JSON.stringify({ success: true, message: "Message skipped by pre-filter", skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Count meaningful words (filter out very short words)
    const words = normalizedText.split(/\s+/).filter((w: string) => w.length > 2);
    if (words.length < 5) {
      console.log(`Message has too few meaningful words (${words.length}), skipping analysis`);
      return new Response(
        JSON.stringify({ success: true, message: "Message has too few words for analysis", skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analyzing message for client ${client_id} using model ${aiSettings.model}:`, content_text.substring(0, 100));

    // Get recent context from this client
    const { data: recentMessages } = await supabase
      .from("message_events")
      .select("content_text, direction, sent_at")
      .eq("client_id", client_id)
      .order("sent_at", { ascending: false })
      .limit(5);

    const contextStr = recentMessages?.map(m => 
      `[${m.direction === 'client_to_team' ? 'Cliente' : 'Equipe'}]: ${m.content_text?.substring(0, 200) || '(sem texto)'}`
    ).join("\n") || "";

    const userPrompt = `Analise a seguinte mensagem do cliente e identifique:
1. Evidências de ROI percebido (tangível ou intangível) - ${aiSettings.roi_prompt}
2. Sinais de risco - ${aiSettings.risk_prompt}
3. Momentos CX (eventos importantes da vida do cliente) - ${aiSettings.life_events_prompt}

CONTEXTO RECENTE:
${contextStr}

MENSAGEM ATUAL (fonte: ${source}):
"${content_text}"

Analise e retorne os eventos identificados.`;

    const systemPrompt = buildSystemPrompt(aiSettings);

    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiSettings.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_message",
              description: "Classifica a mensagem identificando ROI, riscos e momentos CX",
              parameters: {
                type: "object",
                properties: {
                  roi_events: {
                    type: "array",
                    description: "Lista de eventos de ROI identificados",
                    items: {
                      type: "object",
                      properties: {
                        roi_type: { 
                          type: "string", 
                          enum: ["tangible", "intangible"],
                          description: "Tipo de ROI"
                        },
                        category: { 
                          type: "string", 
                          enum: ["revenue", "cost", "time", "process", "clarity", "confidence", "tranquility", "status_direction"],
                          description: "Categoria específica do ROI"
                        },
                        impact: { 
                          type: "string", 
                          enum: ["low", "medium", "high"],
                          description: "Nível de impacto"
                        },
                        evidence_snippet: { 
                          type: "string",
                          description: "Trecho da mensagem que evidencia o ROI"
                        },
                        confidence: {
                          type: "number",
                          description: "Nível de confiança da classificação (0-1)"
                        }
                      },
                      required: ["roi_type", "category", "impact", "evidence_snippet"]
                    }
                  },
                  risk_events: {
                    type: "array",
                    description: "Lista de sinais de risco identificados",
                    items: {
                      type: "object",
                      properties: {
                        risk_level: { 
                          type: "string", 
                          enum: ["low", "medium", "high"],
                          description: "Nível de risco"
                        },
                        reason: { 
                          type: "string",
                          description: "Motivo do risco identificado (curto)"
                        },
                        evidence_snippet: { 
                          type: "string",
                          description: "Trecho que evidencia o risco"
                        },
                        confidence: {
                          type: "number",
                          description: "Nível de confiança da classificação (0-1)"
                        }
                      },
                      required: ["risk_level", "reason", "evidence_snippet"]
                    }
                  },
                  life_events: {
                    type: "array",
                    description: "Lista de momentos CX (eventos de vida) mencionados pelo cliente",
                    items: {
                      type: "object",
                      properties: {
                        event_type: { 
                          type: "string", 
                          enum: ["birthday", "child_birth", "pregnancy", "wedding", "graduation", "promotion", "new_job", "travel", "health", "loss", "achievement", "celebration", "anniversary", "moving", "other"],
                          description: "Tipo do evento de vida"
                        },
                        title: { 
                          type: "string",
                          description: "Título descritivo do evento (ex: 'Aniversário de 40 anos', 'Nascimento do filho')"
                        },
                        description: { 
                          type: "string",
                          description: "Detalhes adicionais mencionados sobre o evento"
                        },
                        event_date: { 
                          type: "string",
                          description: "Data do evento se mencionada (formato YYYY-MM-DD). Se for data relativa, calcule a partir de hoje."
                        },
                        is_recurring: { 
                          type: "boolean",
                          description: "Se é um evento recorrente anual (ex: aniversário)"
                        },
                        confidence: {
                          type: "number",
                          description: "Nível de confiança da classificação (0-1)"
                        }
                      },
                      required: ["event_type", "title"]
                    }
                  }
                },
                required: ["roi_events", "risk_events", "life_events"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "classify_message" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limited by Lovable AI");
        return new Response(
          JSON.stringify({ error: "Rate limited, try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        console.error("Payment required for Lovable AI");
        return new Response(
          JSON.stringify({ error: "Payment required for AI analysis" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log("AI Response:", JSON.stringify(aiResponse, null, 2));

    // Extract token usage from response
    const inputTokens = aiResponse.usage?.prompt_tokens || 0;
    const outputTokens = aiResponse.usage?.completion_tokens || 0;
    console.log(`Tokens used - Input: ${inputTokens}, Output: ${outputTokens}`);

    // Extract tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "classify_message") {
      console.log("No classification returned");
      
      // Log AI usage even when no classification
      await supabase.from("ai_usage_logs").insert({
        account_id,
        model: aiSettings.model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        message_id: message_event_id || null,
        client_id,
        roi_events_created: 0,
        risk_events_created: 0,
        life_events_created: 0,
        recommendations_created: 0,
      });
      
      return new Response(
        JSON.stringify({ success: true, message: "No events identified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const classification = JSON.parse(toolCall.function.arguments);
    console.log("Classification:", JSON.stringify(classification, null, 2));

    const now = new Date().toISOString();
    const results = { roi_events: 0, risk_events: 0, life_events: 0, filtered_by_confidence: 0 };
    const confidenceThreshold = aiSettings.confidence_threshold;

    // Insert ROI events (filtered by confidence and duplicates)
    if (classification.roi_events?.length > 0) {
      for (const roiEvent of classification.roi_events) {
        // Check confidence threshold
        if (roiEvent.confidence !== undefined && roiEvent.confidence < confidenceThreshold) {
          console.log(`ROI event filtered: confidence ${roiEvent.confidence} < threshold ${confidenceThreshold}`);
          results.filtered_by_confidence++;
          continue;
        }

        // Check for duplicate evidence_snippet to avoid duplicates
        const { data: existingRoi } = await supabase
          .from("roi_events")
          .select("id")
          .eq("client_id", client_id)
          .eq("evidence_snippet", roiEvent.evidence_snippet)
          .limit(1);
        
        if (existingRoi && existingRoi.length > 0) {
          console.log(`ROI event skipped: duplicate evidence_snippet found`);
          continue;
        }

        const { error } = await supabase.from("roi_events").insert({
          account_id,
          client_id,
          source: source || "whatsapp_text",
          roi_type: roiEvent.roi_type,
          category: roiEvent.category,
          impact: roiEvent.impact,
          evidence_snippet: roiEvent.evidence_snippet,
          happened_at: now,
        });
        if (error) {
          console.error("Error inserting roi_event:", error);
        } else {
          results.roi_events++;
        }
      }
    }

    // Insert Risk events (filtered by confidence and duplicates)
    if (classification.risk_events?.length > 0) {
      for (const riskEvent of classification.risk_events) {
        // Check confidence threshold
        if (riskEvent.confidence !== undefined && riskEvent.confidence < confidenceThreshold) {
          console.log(`Risk event filtered: confidence ${riskEvent.confidence} < threshold ${confidenceThreshold}`);
          results.filtered_by_confidence++;
          continue;
        }

        // Check for duplicate evidence_snippet to avoid duplicates
        const { data: existingRisk } = await supabase
          .from("risk_events")
          .select("id")
          .eq("client_id", client_id)
          .eq("evidence_snippet", riskEvent.evidence_snippet)
          .limit(1);
        
        if (existingRisk && existingRisk.length > 0) {
          console.log(`Risk event skipped: duplicate evidence_snippet found`);
          continue;
        }

        const { error } = await supabase.from("risk_events").insert({
          account_id,
          client_id,
          source: source || "whatsapp_text",
          risk_level: riskEvent.risk_level,
          reason: riskEvent.reason,
          evidence_snippet: riskEvent.evidence_snippet,
          happened_at: now,
        });
        if (error) {
          console.error("Error inserting risk_event:", error);
        } else {
          results.risk_events++;
        }
      }
    }

    // Insert Life Events (Momentos CX) - filtered by confidence and duplicates
    if (classification.life_events?.length > 0) {
      for (const lifeEvent of classification.life_events) {
        // Check confidence threshold
        if (lifeEvent.confidence !== undefined && lifeEvent.confidence < confidenceThreshold) {
          console.log(`Life event filtered: confidence ${lifeEvent.confidence} < threshold ${confidenceThreshold}`);
          results.filtered_by_confidence++;
          continue;
        }

        // Check for duplicate title to avoid duplicates
        const { data: existingLife } = await supabase
          .from("client_life_events")
          .select("id")
          .eq("client_id", client_id)
          .eq("title", lifeEvent.title)
          .limit(1);
        
        if (existingLife && existingLife.length > 0) {
          console.log(`Life event skipped: duplicate title found`);
          continue;
        }

        // Determine if event is recurring based on type
        const recurringTypes = ["birthday", "anniversary"];
        const isRecurring = lifeEvent.is_recurring ?? recurringTypes.includes(lifeEvent.event_type);
        
        const { error } = await supabase.from("client_life_events").insert({
          account_id,
          client_id,
          event_type: lifeEvent.event_type,
          title: lifeEvent.title,
          description: lifeEvent.description || null,
          event_date: lifeEvent.event_date || null,
          is_recurring: isRecurring,
          source: "ai_detected",
          reminder_days_before: 7,
        });
        if (error) {
          console.error("Error inserting life_event:", error);
        } else {
          results.life_events++;
          console.log(`Life event detected: ${lifeEvent.event_type} - ${lifeEvent.title}`);
        }
      }
    }


    console.log(`Analysis complete using ${aiSettings.model}. Created: ${results.roi_events} ROI, ${results.risk_events} Risk, ${results.life_events} Life Events. Filtered by confidence: ${results.filtered_by_confidence}`);

    // Log AI usage
    const { error: logError } = await supabase.from("ai_usage_logs").insert({
      account_id,
      model: aiSettings.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      message_id: message_event_id || null,
      client_id,
      roi_events_created: results.roi_events,
      risk_events_created: results.risk_events,
      life_events_created: results.life_events,
      recommendations_created: 0,
    });
    if (logError) {
      console.error("Error logging AI usage:", logError);
    }

    // Trigger score recalculation for this client in background
    if (results.roi_events > 0 || results.risk_events > 0) {
      console.log(`Triggering score recalculation for client ${client_id}`);
      
      // Fire and forget - don't await
      fetch(`${supabaseUrl}/functions/v1/recompute-scores`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ account_id, client_id }),
      }).then(response => {
        if (response.ok) {
          console.log(`Score recalculation triggered for client ${client_id}`);
        } else {
          console.error(`Score recalculation failed: ${response.status}`);
        }
      }).catch(err => {
        console.error("Error triggering score recalculation:", err);
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        results, 
        classification,
        settings_used: {
          model: aiSettings.model,
          min_message_length: aiSettings.min_message_length,
          confidence_threshold: aiSettings.confidence_threshold,
        },
        tokens_used: {
          input: inputTokens,
          output: outputTokens,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in analyze-message:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
