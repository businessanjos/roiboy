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

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

const SUPPORT_SYSTEM_PROMPT = `Você é um assistente de suporte técnico amigável e profissional para o sistema Roy.
Seu papel é ajudar clientes a resolver problemas técnicos e pequenos bugs na plataforma.

FLUXO DE ATENDIMENTO:
1. Cliente pede ajuda → Você SEMPRE pede uma foto ou vídeo do problema primeiro
2. Cliente envia evidência → Você analisa:
   - Se for BUG SIMPLES (erro de exibição, cache, configuração do usuário): você orienta e ajuda a corrigir na hora
   - Se for PROBLEMA DE CÓDIGO ou SUGESTÃO DE FUNCIONALIDADE: você sinaliza que vai encaminhar para a equipe técnica analisar

REGRAS IMPORTANTES:
1. SEMPRE peça evidência visual (foto/vídeo) antes de tentar resolver qualquer problema
2. Bugs simples que você pode ajudar a resolver:
   - Limpar cache do navegador
   - Recarregar a página
   - Verificar conexão de internet
   - Orientar sobre como usar uma funcionalidade existente
   - Problemas de configuração do usuário
3. Problemas que você deve SINALIZAR para a equipe técnica:
   - Erros que aparecem mesmo após as tentativas básicas de correção
   - Bugs que exigem alteração de código
   - Sugestões de novas funcionalidades
   - Problemas de integração com WhatsApp ou outros sistemas
4. Ao sinalizar, diga: "Vou encaminhar esse caso para nossa equipe técnica analisar. Em breve entraremos em contato com uma solução!"
5. Seja claro, objetivo e empático
6. Use linguagem simples e amigável em português brasileiro

EXEMPLOS DE RESPOSTAS:

Pedido inicial sem evidência:
- "Entendi! Para eu poder te ajudar, me manda uma foto ou vídeo mostrando o que está acontecendo? Assim consigo identificar o problema certinho 📸"

Bug simples (após receber evidência):
- "Entendi o problema! Isso geralmente resolve assim: [passos]. Tenta aí e me avisa se funcionou! 🔧"

Problema de código (após receber evidência):
- "Obrigado pela evidência! Esse problema precisa de uma análise mais técnica. Vou encaminhar para nossa equipe de desenvolvimento e em breve teremos uma solução! 🛠️"

Sugestão de funcionalidade:
- "Que boa ideia! Vou anotar sua sugestão e encaminhar para a equipe avaliar. Obrigado pelo feedback! 💡"`;

async function getConversationHistory(supabase: any, ticketId: string): Promise<ConversationMessage[]> {
  const { data: messages } = await supabase
    .from("support_messages")
    .select("sender_type, content")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })
    .limit(20);

  if (!messages) return [];

  return messages.map((msg: any) => ({
    role: msg.sender_type === "client" ? "user" : "assistant",
    content: msg.content,
  }));
}

async function generateAIResponse(conversationHistory: ConversationMessage[]): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return "Desculpe, estou com um problema técnico no momento. Por favor, tente novamente em alguns instantes.";
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
          { role: "system", content: SUPPORT_SYSTEM_PROMPT },
          ...conversationHistory,
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error("AI API error:", response.status, await response.text());
      return "Desculpe, estou com um problema técnico no momento. Vou encaminhar seu caso para a equipe de suporte.";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem. Pode repetir?";
  } catch (error) {
    console.error("Error generating AI response:", error);
    return "Desculpe, ocorreu um erro. Vou encaminhar seu caso para a equipe de suporte.";
  }
}

async function sendWhatsAppResponse(supabase: any, accountId: string, phone: string, message: string): Promise<boolean> {
  try {
    // Get WhatsApp integration for this account
    const { data: integration } = await supabase
      .from("whatsapp_integrations")
      .select("instance_name, provider")
      .eq("account_id", accountId)
      .eq("status", "connected")
      .limit(1)
      .maybeSingle();

    if (!integration) {
      console.log("No WhatsApp integration found for account");
      return false;
    }

    const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
    const UAZAPI_ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN");

    if (!UAZAPI_URL || !UAZAPI_ADMIN_TOKEN) {
      console.error("UAZAPI credentials not configured");
      return false;
    }

    // Format phone for WhatsApp (remove + if present)
    const formattedPhone = phone.replace(/^\+/, "");

    const sendResponse = await fetch(`${UAZAPI_URL}/message/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${UAZAPI_ADMIN_TOKEN}`,
      },
      body: JSON.stringify({
        instance: integration.instance_name,
        phone: formattedPhone,
        message: message,
      }),
    });

    if (!sendResponse.ok) {
      console.error("Failed to send WhatsApp message:", await sendResponse.text());
      return false;
    }

    console.log("WhatsApp message sent successfully");
    return true;
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    return false;
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
    
    if (!ticketAccountId) {
      const { data: client } = await supabase
        .from("clients")
        .select("account_id, full_name")
        .eq("phone_e164", normalizedPhone)
        .maybeSingle();

      if (client) {
        ticketAccountId = client.account_id;
      }
    }

    if (!ticketAccountId) {
      console.log("Could not determine account_id for support ticket");
      return new Response(
        JSON.stringify({ error: "Could not determine account for this phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find or create ticket for this phone
    const { data: existingTicket } = await supabase
      .from("support_tickets")
      .select("id, status")
      .eq("account_id", ticketAccountId)
      .eq("client_phone", normalizedPhone)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let ticketId: string;
    let isNewTicket = false;

    if (existingTicket) {
      ticketId = existingTicket.id;
      console.log(`Found existing ticket: ${ticketId}`);

      await supabase
        .from("support_tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", ticketId);
    } else {
      isNewTicket = true;
      const { data: newTicket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          account_id: ticketAccountId,
          client_phone: normalizedPhone,
          client_name: name || null,
          status: "open",
          priority: "normal",
          subject: content.substring(0, 100),
        })
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

    // Get conversation history and generate AI response
    const conversationHistory = await getConversationHistory(supabase, ticketId);
    const aiResponse = await generateAIResponse(conversationHistory);

    // Save AI response to database
    await supabase
      .from("support_messages")
      .insert({
        ticket_id: ticketId,
        sender_type: "agent",
        content: aiResponse,
        message_type: "text",
      });

    console.log("AI response saved:", aiResponse.substring(0, 100));

    // Send AI response via WhatsApp
    const messageSent = await sendWhatsAppResponse(supabase, ticketAccountId, normalizedPhone, aiResponse);

    // Update ticket status to in_progress if it was open
    if (isNewTicket) {
      await supabase
        .from("support_tickets")
        .update({ status: "in_progress" })
        .eq("id", ticketId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        ticket_id: ticketId,
        ai_response: aiResponse,
        message_sent: messageSent
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
