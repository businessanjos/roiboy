import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const systemPrompt = `Você é o ROIBOY Analyzer, um especialista em identificar percepção de ROI e sinais de risco em conversas entre mentores/consultores e seus clientes.

TAXONOMIA DE ROI:
- TANGÍVEL: revenue (aumento de receita), cost (redução de custos), time (economia de tempo), process (melhoria de processos)
- INTANGÍVEL: clarity (clareza/direção), confidence (confiança), tranquility (tranquilidade), status_direction (status/direção)

SINAIS DE RISCO:
- Expectativa não atendida
- Frustração expressa
- Hesitação ou dúvida
- Comparação negativa com outros serviços
- Silêncio anormal (mencionado)
- Queda de engajamento
- Mudança de tom negativa
- Menção de cancelamento ou pausa

REGRAS:
1. Só identifique ROI se houver evidência clara na mensagem
2. Só identifique risco se houver sinal claro
3. Gere recomendações práticas e específicas
4. Se insuficiente, retorne arrays vazios
5. Nunca invente - seja conservador na classificação`;

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

    console.log(`Analyzing message for client ${client_id}:`, content_text.substring(0, 100));

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
1. Evidências de ROI percebido (tangível ou intangível)
2. Sinais de risco
3. Recomendações de ação

CONTEXTO RECENTE:
${contextStr}

MENSAGEM ATUAL (fonte: ${source}):
"${content_text}"

Analise e retorne os eventos identificados.`;

    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_message",
              description: "Classifica a mensagem identificando ROI, riscos e recomendações",
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
                        }
                      },
                      required: ["risk_level", "reason", "evidence_snippet"]
                    }
                  },
                  recommendations: {
                    type: "array",
                    description: "Lista de recomendações de ação",
                    items: {
                      type: "object",
                      properties: {
                        title: { 
                          type: "string",
                          description: "Título curto da recomendação"
                        },
                        action_text: { 
                          type: "string",
                          description: "Ação específica recomendada"
                        },
                        priority: { 
                          type: "string", 
                          enum: ["low", "medium", "high"],
                          description: "Prioridade da recomendação"
                        }
                      },
                      required: ["title", "action_text", "priority"]
                    }
                  }
                },
                required: ["roi_events", "risk_events", "recommendations"]
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

    // Extract tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "classify_message") {
      console.log("No classification returned");
      return new Response(
        JSON.stringify({ success: true, message: "No events identified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const classification = JSON.parse(toolCall.function.arguments);
    console.log("Classification:", JSON.stringify(classification, null, 2));

    const now = new Date().toISOString();
    const results = { roi_events: 0, risk_events: 0, recommendations: 0 };

    // Insert ROI events
    if (classification.roi_events?.length > 0) {
      for (const roiEvent of classification.roi_events) {
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

    // Insert Risk events
    if (classification.risk_events?.length > 0) {
      for (const riskEvent of classification.risk_events) {
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

    // Insert Recommendations
    if (classification.recommendations?.length > 0) {
      for (const rec of classification.recommendations) {
        const { error } = await supabase.from("recommendations").insert({
          account_id,
          client_id,
          title: rec.title,
          action_text: rec.action_text,
          priority: rec.priority,
          status: "open",
        });
        if (error) {
          console.error("Error inserting recommendation:", error);
        } else {
          results.recommendations++;
        }
      }
    }

    console.log(`Analysis complete. Created: ${results.roi_events} ROI, ${results.risk_events} Risk, ${results.recommendations} Recommendations`);

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
      JSON.stringify({ success: true, results, classification }),
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
