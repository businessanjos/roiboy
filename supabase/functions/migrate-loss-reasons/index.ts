import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { account_id } = await req.json();
    if (!account_id) throw new Error("account_id is required");

    // 1. Get loss reasons for this account
    const { data: reasons, error: reasonsError } = await supabase
      .from("deal_loss_reasons")
      .select("id, name")
      .eq("account_id", account_id)
      .eq("is_active", true)
      .order("display_order");

    if (reasonsError) throw reasonsError;

    // 2. Get sub-reasons
    const { data: subReasons, error: subError } = await supabase
      .from("deal_loss_sub_reasons")
      .select("id, loss_reason_id, name")
      .eq("account_id", account_id)
      .eq("is_active", true)
      .order("display_order");

    if (subError) throw subError;

    // 3. Get deals with text lost_reason but no structured loss_reason_id (limit to 40 per run)
    const { data: deals, error: dealsError } = await supabase
      .from("deals")
      .select("id, lost_reason")
      .eq("account_id", account_id)
      .eq("status", "lost")
      .not("lost_reason", "is", null)
      .is("loss_reason_id", null)
      .limit(40);

    if (dealsError) throw dealsError;

    if (!deals || deals.length === 0) {
      return new Response(
        JSON.stringify({ message: "No deals to migrate", migrated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build reason catalog for the AI
    const reasonCatalog = reasons!.map((r) => {
      const subs = subReasons!.filter((s) => s.loss_reason_id === r.id);
      return {
        id: r.id,
        name: r.name,
        sub_reasons: subs.map((s) => ({ id: s.id, name: s.name })),
      };
    });

    // Process in batches of 20
    const BATCH_SIZE = 20;
    let migrated = 0;

    for (let i = 0; i < deals.length; i += BATCH_SIZE) {
      const batch = deals.slice(i, i + BATCH_SIZE);

      const prompt = `Classifique cada motivo de perda abaixo em uma das categorias disponíveis. 
O texto original pode conter comentários adicionais misturados com o motivo real - separe-os.

CATEGORIAS DISPONÍVEIS:
${JSON.stringify(reasonCatalog, null, 2)}

DEALS PARA CLASSIFICAR:
${batch.map((d) => `- ID: ${d.id} | Texto: "${d.lost_reason}"`).join("\n")}

REGRAS:
1. Para cada deal, retorne o reason_id mais adequado
2. Se houver um sub_reason que se encaixe, inclua o sub_reason_id
3. O campo "notes" deve conter observações adicionais extraídas do texto original que NÃO são o motivo em si (contexto, detalhes do cliente, etc.)
4. Se o texto inteiro é basicamente o motivo, use o texto como notes também
5. Se não conseguir classificar, use a categoria "Outro"`;

      const response = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  "Você é um classificador de motivos de perda de vendas. Responda APENAS com a tool call solicitada.",
              },
              { role: "user", content: prompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "classify_deals",
                  description: "Classifica deals nos motivos de perda padronizados",
                  parameters: {
                    type: "object",
                    properties: {
                      classifications: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            deal_id: { type: "string" },
                            reason_id: { type: "string" },
                            sub_reason_id: { type: "string" },
                            notes: { type: "string" },
                          },
                          required: ["deal_id", "reason_id", "notes"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["classifications"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: {
              type: "function",
              function: { name: "classify_deals" },
            },
          }),
        }
      );

      if (!response.ok) {
        console.error("AI error:", response.status, await response.text());
        continue;
      }

      const result = await response.json();
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

      if (!toolCall?.function?.arguments) {
        console.error("No tool call in response");
        continue;
      }

      const { classifications } = JSON.parse(toolCall.function.arguments);

      // Update each deal
      for (const c of classifications) {
        const updateData: Record<string, any> = {
          loss_reason_id: c.reason_id,
          loss_notes: c.notes,
        };
        if (c.sub_reason_id) {
          updateData.loss_sub_reason_id = c.sub_reason_id;
        }

        const { error: updateError } = await supabase
          .from("deals")
          .update(updateData)
          .eq("id", c.deal_id);

        if (updateError) {
          console.error(`Error updating deal ${c.deal_id}:`, updateError);
        } else {
          migrated++;
        }
      }

      // Small delay between batches
      if (i + BATCH_SIZE < deals.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    return new Response(
      JSON.stringify({
        message: `Migration complete`,
        total: deals.length,
        migrated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Migration error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
