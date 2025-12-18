import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface AISettings {
  model: string;
  system_prompt: string;
  roi_prompt: string;
  risk_prompt: string;
  life_events_prompt: string;
  min_message_length: number;
  confidence_threshold: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { message, settings } = await req.json() as { message: string; settings: AISettings };

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (message.length < settings.min_message_length) {
      return new Response(
        JSON.stringify({ 
          error: `Message too short. Minimum: ${settings.min_message_length} characters` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Testing prompt with model ${settings.model}:`, message.substring(0, 100));

    const systemPrompt = `${settings.system_prompt}

INSTRUÇÕES ADICIONAIS:

ROI: ${settings.roi_prompt}

RISCOS: ${settings.risk_prompt}

MOMENTOS CX: ${settings.life_events_prompt}

REGRAS:
1. Só identifique ROI se houver evidência clara na mensagem
2. Só identifique risco se houver sinal claro
3. Identifique momentos CX quando o cliente mencionar eventos de vida
4. Extraia datas quando mencionadas
5. Gere recomendações práticas e específicas
6. Se insuficiente, retorne arrays vazios
7. Nunca invente - seja conservador na classificação`;

    const userPrompt = `Analise a seguinte mensagem e identifique:
1. Evidências de ROI percebido (tangível ou intangível)
2. Sinais de risco
3. Momentos CX (eventos importantes da vida do cliente)
4. Recomendações de ação

MENSAGEM:
"${message}"

Analise e retorne os eventos identificados.`;

    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_message",
              description: "Classifica a mensagem identificando ROI, riscos, momentos CX e recomendações",
              parameters: {
                type: "object",
                properties: {
                  roi_events: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        roi_type: { type: "string", enum: ["tangible", "intangible"] },
                        category: { type: "string", enum: ["revenue", "cost", "time", "process", "clarity", "confidence", "tranquility", "status_direction"] },
                        impact: { type: "string", enum: ["low", "medium", "high"] },
                        evidence_snippet: { type: "string" },
                        confidence: { type: "number" }
                      },
                      required: ["roi_type", "category", "impact", "evidence_snippet"]
                    }
                  },
                  risk_events: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        risk_level: { type: "string", enum: ["low", "medium", "high"] },
                        reason: { type: "string" },
                        evidence_snippet: { type: "string" },
                        confidence: { type: "number" }
                      },
                      required: ["risk_level", "reason", "evidence_snippet"]
                    }
                  },
                  life_events: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        event_type: { type: "string", enum: ["birthday", "child_birth", "pregnancy", "wedding", "graduation", "promotion", "new_job", "travel", "health", "loss", "achievement", "celebration", "anniversary", "moving", "other"] },
                        title: { type: "string" },
                        description: { type: "string" },
                        event_date: { type: "string" },
                        confidence: { type: "number" }
                      },
                      required: ["event_type", "title"]
                    }
                  },
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        action_text: { type: "string" },
                        priority: { type: "string", enum: ["low", "medium", "high"] }
                      },
                      required: ["title", "action_text", "priority"]
                    }
                  }
                },
                required: ["roi_events", "risk_events", "life_events", "recommendations"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "classify_message" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required for AI analysis." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log("AI Response received");

    const inputTokens = aiResponse.usage?.prompt_tokens || 0;
    const outputTokens = aiResponse.usage?.completion_tokens || 0;

    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "classify_message") {
      return new Response(
        JSON.stringify({ 
          success: true,
          roi_events: [],
          risk_events: [],
          life_events: [],
          recommendations: [],
          tokens_used: { input: inputTokens, output: outputTokens }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const classification = JSON.parse(toolCall.function.arguments);
    const confidenceThreshold = settings.confidence_threshold;

    // Filter by confidence threshold
    const filteredRoi = (classification.roi_events || []).filter(
      (e: any) => e.confidence === undefined || e.confidence >= confidenceThreshold
    );
    const filteredRisk = (classification.risk_events || []).filter(
      (e: any) => e.confidence === undefined || e.confidence >= confidenceThreshold
    );
    const filteredLife = (classification.life_events || []).filter(
      (e: any) => e.confidence === undefined || e.confidence >= confidenceThreshold
    );

    return new Response(
      JSON.stringify({
        success: true,
        roi_events: filteredRoi,
        risk_events: filteredRisk,
        life_events: filteredLife,
        recommendations: classification.recommendations || [],
        tokens_used: { input: inputTokens, output: outputTokens }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in test-ai-prompt:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
