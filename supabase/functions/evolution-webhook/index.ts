import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Evolution API Webhook Handler
 * 
 * Receives webhooks from Evolution API and processes WhatsApp messages.
 * Supports message types: text, audio, image, video, document
 * 
 * Evolution webhook format: https://doc.evolution-api.com/webhooks
 */

interface EvolutionMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
    audioMessage?: {
      url: string;
      mimetype: string;
      seconds: number;
    };
    imageMessage?: {
      url: string;
      caption?: string;
    };
    videoMessage?: {
      url: string;
      caption?: string;
    };
    documentMessage?: {
      url: string;
      fileName?: string;
    };
  };
  messageTimestamp: number | string;
  messageType?: string;
}

interface EvolutionWebhook {
  event: string;
  instance: string;
  data: EvolutionMessage | any;
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
  apikey?: string;
}

// Extract phone number from WhatsApp JID
function extractPhoneFromJid(jid: string): string {
  // Format: 5511999999999@s.whatsapp.net or 5511999999999-123456@g.us (groups)
  const match = jid.match(/^(\d+)[@-]/);
  if (match) {
    return `+${match[1]}`;
  }
  return jid;
}

// Check if JID is a group
function isGroupJid(jid: string): boolean {
  return jid.includes("@g.us");
}

// Extract text content from message
function extractTextContent(message: EvolutionMessage["message"]): string | null {
  if (!message) return null;
  
  if (message.conversation) {
    return message.conversation;
  }
  
  if (message.extendedTextMessage?.text) {
    return message.extendedTextMessage.text;
  }
  
  if (message.imageMessage?.caption) {
    return `[Imagem] ${message.imageMessage.caption}`;
  }
  
  if (message.videoMessage?.caption) {
    return `[Vídeo] ${message.videoMessage.caption}`;
  }
  
  if (message.documentMessage?.fileName) {
    return `[Documento] ${message.documentMessage.fileName}`;
  }
  
  if (message.audioMessage) {
    return `[Áudio ${message.audioMessage.seconds}s]`;
  }
  
  return null;
}

// Get audio duration if it's an audio message
function getAudioDuration(message: EvolutionMessage["message"]): number | null {
  if (message?.audioMessage?.seconds) {
    return message.audioMessage.seconds;
  }
  return null;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhook: EvolutionWebhook = await req.json();
    
    console.log("Evolution webhook received:", {
      event: webhook.event,
      instance: webhook.instance,
      hasData: !!webhook.data,
    });

    // Only process message events
    if (webhook.event !== "messages.upsert") {
      console.log("Ignoring non-message event:", webhook.event);
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: "Not a message event" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const message = webhook.data as EvolutionMessage;
    
    // Skip messages sent by us (fromMe = true)
    if (message.key.fromMe) {
      console.log("Ignoring outgoing message (fromMe)");
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: "Outgoing message" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract message details
    const isGroup = isGroupJid(message.key.remoteJid);
    const phoneE164 = extractPhoneFromJid(message.key.remoteJid);
    const contactName = message.pushName || null;
    const textContent = extractTextContent(message.message);
    const audioDuration = getAudioDuration(message.message);
    
    // Convert timestamp
    const timestamp = typeof message.messageTimestamp === "string" 
      ? parseInt(message.messageTimestamp) * 1000 
      : message.messageTimestamp * 1000;
    const sentAt = new Date(timestamp).toISOString();

    console.log("Message details:", {
      phone: phoneE164,
      contactName,
      isGroup,
      hasText: !!textContent,
      audioDuration,
      instance: webhook.instance,
    });

    // Skip if no text content
    if (!textContent) {
      console.log("No text content to process");
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: "No text content" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the account by Evolution instance name
    // The instance name should match the account's integration config
    const { data: integration, error: integrationError } = await supabase
      .from("integrations")
      .select("account_id, config")
      .eq("type", "evolution")
      .eq("status", "connected")
      .maybeSingle();

    // If no evolution integration, try to find by whatsapp type with instance in config
    let accountId: string | null = null;
    
    if (integration) {
      accountId = integration.account_id;
    } else {
      // Try finding by instance name in config
      const { data: integrations } = await supabase
        .from("integrations")
        .select("account_id, config")
        .eq("type", "whatsapp")
        .eq("status", "connected");
      
      if (integrations) {
        for (const int of integrations) {
          const config = int.config as Record<string, string> | null;
          if (config?.instance_name === webhook.instance) {
            accountId = int.account_id;
            break;
          }
        }
      }
    }

    if (!accountId) {
      console.log("No matching integration found for instance:", webhook.instance);
      return new Response(
        JSON.stringify({ error: "No matching integration", instance: webhook.instance }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found account:", accountId);

    // Find client by phone
    let client = null;
    
    const { data: clientByPhone } = await supabase
      .from("clients")
      .select("id, account_id, full_name, phone_e164")
      .eq("phone_e164", phoneE164)
      .eq("account_id", accountId)
      .maybeSingle();
    
    if (clientByPhone) {
      client = clientByPhone;
    } else if (contactName) {
      // Try finding by name
      const { data: clientByName } = await supabase
        .from("clients")
        .select("id, account_id, full_name, phone_e164")
        .eq("account_id", accountId)
        .ilike("full_name", contactName)
        .maybeSingle();
      
      if (clientByName) {
        client = clientByName;
      }
    }

    if (!client) {
      // Skip group messages from unknown senders
      if (isGroup) {
        return new Response(
          JSON.stringify({ success: true, ignored: true, reason: "Unknown group sender" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log("Client not found:", { phone: phoneE164, name: contactName });
      return new Response(
        JSON.stringify({ error: "Client not found", phone: phoneE164 }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing for client:", client.id, client.full_name);

    // Find or create conversation
    const threadId = isGroup ? `group:${message.key.remoteJid}` : message.key.remoteJid;
    let conversationId: string | null = null;
    
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id")
      .eq("client_id", client.id)
      .eq("external_thread_id", threadId)
      .maybeSingle();

    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({
          account_id: client.account_id,
          client_id: client.id,
          channel: "whatsapp",
          external_thread_id: threadId,
        })
        .select("id")
        .single();

      if (newConv) {
        conversationId = newConv.id;
      }
    }

    // Determine message source based on content type
    const messageSource = audioDuration ? "whatsapp_audio" : "whatsapp_text";

    // Insert message event
    const { data: messageEvent, error: messageError } = await supabase
      .from("message_events")
      .insert({
        account_id: client.account_id,
        client_id: client.id,
        conversation_id: conversationId,
        source: messageSource,
        direction: "client_to_team",
        content_text: textContent,
        sent_at: sentAt,
        is_group: isGroup,
        group_name: isGroup ? contactName : null,
        audio_duration_sec: audioDuration,
      })
      .select("id")
      .single();

    if (messageError) {
      console.error("Message insert error:", messageError);
      return new Response(
        JSON.stringify({ error: "Failed to save message" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Message saved:", messageEvent.id);

    // Trigger AI analysis for text messages from clients
    if (textContent.length > 10 && !audioDuration) {
      const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-message`;
      
      fetch(analyzeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          message_event_id: messageEvent.id,
          content_text: textContent,
          client_id: client.id,
          account_id: client.account_id,
          source: messageSource,
        }),
      }).catch(err => {
        console.error("AI trigger error:", err);
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageEvent.id,
        client_id: client.id,
        client_name: client.full_name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Webhook processing error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Request failed", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
