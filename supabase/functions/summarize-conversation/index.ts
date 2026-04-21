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
    const { conversation_id, assignment_id } = await req.json();

    if (!conversation_id) {
      return new Response(
        JSON.stringify({ error: "conversation_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch last 50 messages from conversation
    const { data: messages, error: messagesError } = await supabase
      .from("zapp_messages")
      .select("content, direction, sender_name, created_at, message_type")
      .eq("zapp_conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(50);

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch messages" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ summary: "Conversa sem mensagens de texto." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format messages for AI (direction: "inbound" = from client, "outbound" = from agent)
    const formattedMessages = messages
      .filter((m: any) => m.content && m.message_type === "text")
      .map((m: any) => {
        const sender = m.direction === "inbound" 
          ? (m.sender_name || "Cliente") 
          : "Atendente";
        return `${sender}: ${m.content}`;
      })
      .join("\n");

    if (!formattedMessages) {
      return new Response(
        JSON.stringify({ summary: "Conversa sem mensagens de texto para resumir." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate summary using Lovable AI
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um assistente que gera resumos concisos de conversas de atendimento ao cliente.

INSTRUÇÕES:
- Resuma o assunto principal tratado na conversa
- Identifique a demanda/problema do cliente
- Mencione a solução/encaminhamento dado
- Use no máximo 2-3 frases curtas
- Seja objetivo e direto
- Escreva em português brasileiro

Formato: Um parágrafo curto com o resumo do atendimento.`,
          },
          {
            role: "user",
            content: `Resuma esta conversa de atendimento:\n\n${formattedMessages}`,
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to generate summary" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content?.trim() || "Não foi possível gerar resumo.";

    console.log("Generated summary for conversation:", conversation_id);

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in summarize-conversation:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
