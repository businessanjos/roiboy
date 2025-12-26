import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SupportWebhookPayload {
  phone: string;
  name?: string;
  content: string;
  message_type?: string;
  external_message_id?: string;
  account_id?: string;
  media_url?: string;
}

interface TicketAnalysis {
  category: string;
  priority: string;
  subject: string;
  needs_attention: boolean;
}

// AI prompt for ticket analysis (categorization, priority, subject extraction)
const TICKET_ANALYSIS_PROMPT = `Você é um assistente que analisa mensagens de suporte para categorizar tickets.

Analise a mensagem do cliente e retorne um JSON com:
- category: categoria do problema (bug, duvida, sugestao, integracao, financeiro, outro)
- priority: prioridade (low, normal, high, urgent)
- subject: assunto resumido em até 50 caracteres
- needs_attention: boolean se parece urgente ou cliente frustrado

Responda APENAS com o JSON, sem explicações.

Exemplo de resposta:
{"category": "bug", "priority": "high", "subject": "Erro ao salvar cliente", "needs_attention": true}`;

async function analyzeTicketWithAI(content: string): Promise<TicketAnalysis | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return null;
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: TICKET_ANALYSIS_PROMPT },
          { role: "user", content: content },
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.error("AI API error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content || "";
    
    // Try to parse JSON from response
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        category: parsed.category || "outro",
        priority: parsed.priority || "normal",
        subject: parsed.subject || content.substring(0, 50),
        needs_attention: parsed.needs_attention || false,
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error analyzing ticket with AI:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: SupportWebhookPayload = await req.json();
    console.log("Support webhook payload:", JSON.stringify(payload));

    const { phone, name, content, message_type = "text", external_message_id, account_id, media_url } = payload;

    if (!phone || !content) {
      return new Response(
        JSON.stringify({ error: "phone and content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone
    const normalizedPhone = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;

    // Find account_id from phone if not provided
    let ticketAccountId = account_id;
    let clientName = name;
    
    if (!ticketAccountId) {
      const { data: client } = await supabase
        .from("clients")
        .select("account_id, full_name")
        .eq("phone_e164", normalizedPhone)
        .maybeSingle();

      if (client) {
        ticketAccountId = client.account_id;
        clientName = clientName || client.full_name;
      }
    }

    if (!ticketAccountId) {
      console.log("Could not determine account_id for support ticket");
      return new Response(
        JSON.stringify({ error: "Could not determine account for this phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Analyze ticket with AI for categorization
    console.log("Analyzing ticket with AI...");
    const analysis = await analyzeTicketWithAI(content);
    console.log("AI analysis result:", analysis);

    // Find or create ticket for this phone
    const { data: existingTicket } = await supabase
      .from("support_tickets")
      .select("id, status")
      .eq("account_id", ticketAccountId)
      .eq("client_phone", normalizedPhone)
      .in("status", ["open", "in_progress", "waiting_response"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let ticketId: string;
    let isNewTicket = false;

    if (existingTicket) {
      ticketId = existingTicket.id;
      console.log(`Found existing ticket: ${ticketId}`);

      // Update ticket with new message info
      const updateData: Record<string, any> = { 
        updated_at: new Date().toISOString(),
        status: "open", // Client sent message, so it's open again
      };

      // Only update analysis fields if we got a result
      if (analysis) {
        if (analysis.needs_attention) {
          updateData.needs_human_attention = true;
        }
      }

      await supabase
        .from("support_tickets")
        .update(updateData)
        .eq("id", ticketId);
    } else {
      isNewTicket = true;
      
      const ticketData: Record<string, any> = {
        account_id: ticketAccountId,
        client_phone: normalizedPhone,
        client_name: clientName || null,
        status: "open",
        priority: analysis?.priority || "normal",
        subject: analysis?.subject || content.substring(0, 100),
        category: analysis?.category || null,
        needs_human_attention: analysis?.needs_attention || false,
      };

      const { data: newTicket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert(ticketData)
        .select("id")
        .single();

      if (ticketError) {
        console.error("Error creating ticket:", ticketError);
        return new Response(
          JSON.stringify({ error: ticketError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      ticketId = newTicket.id;
      console.log(`Created new ticket: ${ticketId}`);
    }

    // Build message content with media if present
    let fullContent = content;
    if (media_url) {
      fullContent = `${content}\n\n[Mídia anexada: ${media_url}]`;
    }

    // Insert client message
    const { error: messageError } = await supabase
      .from("support_messages")
      .insert({
        ticket_id: ticketId,
        sender_type: "client",
        content: fullContent,
        message_type,
        external_message_id,
      });

    if (messageError) {
      console.error("Error inserting message:", messageError);
      return new Response(
        JSON.stringify({ error: messageError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Client message saved successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        ticket_id: ticketId,
        is_new_ticket: isNewTicket,
        analysis: analysis,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Support webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
