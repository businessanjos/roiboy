import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// UAZAPI sends messages in this format (from actual webhook payload)
interface UazapiWebhookPayload {
  BaseUrl?: string;
  EventType?: string;
  // Alternative formats
  event?: string;
  instance?: string;
  // Chat info - UAZAPI uses 'phone' or extracts from 'id'
  chat?: {
    id?: string;
    image?: string;
    imagePreview?: string;
    name?: string;
    phone?: string;
    lead_email?: string;
    // Additional phone fields UAZAPI might use
    jid?: string;
    number?: string;
  };
  // Message data - UAZAPI format
  message?: {
    id?: string;
    body?: string | Record<string, unknown>;
    content?: string | Record<string, unknown>;
    text?: string;
    type?: string;
    fromMe?: boolean;
    timestamp?: number | string;
    // Nested message content
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
    audioMessage?: { seconds?: number };
  };
  // Alternative message format
  data?: {
    messages?: Array<{
      key: {
        remoteJid: string;
        fromMe: boolean;
        id: string;
      };
      pushName?: string;
      message?: {
        conversation?: string;
        extendedTextMessage?: { text: string };
        imageMessage?: { caption?: string };
        videoMessage?: { caption?: string };
        audioMessage?: { seconds?: number };
      };
      messageTimestamp?: number | string;
    }>;
    state?: string;
    qrcode?: { base64?: string };
  };
}

function extractPhoneFromJid(jid: string): string {
  if (!jid) return "";
  const match = jid.match(/^(\d+)@/);
  return match ? `+${match[1]}` : "";
}

function isGroupJid(jid: string): boolean {
  return jid?.includes("@g.us") || false;
}

function normalizePhone(phone: string | undefined): string {
  if (!phone) return "";
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: UazapiWebhookPayload = await req.json();
    
    // Log the raw payload for debugging
    console.log("UAZAPI Webhook raw payload:", JSON.stringify(payload).substring(0, 1000));

    // Determine event type (UAZAPI uses EventType, some versions use event)
    const eventType = payload.EventType || payload.event;
    console.log(`Event type: ${eventType}`);

    // Extract instance from BaseUrl (e.g., https://cxroycom.uazapi.com -> find integration by account)
    const baseUrl = payload.BaseUrl || "";
    const instance = payload.instance;
    
    console.log(`BaseUrl: ${baseUrl}, instance: ${instance}`);

    // Find account - try different methods
    let integration = null;
    
    // Method 1: Find by instance name if provided
    if (instance) {
      const possibleNames = [
        instance,
        instance.replace(/_/g, "-"),
        instance.replace(/-/g, "_"),
        instance.split("_").slice(0, 2).join("-"),
        instance.split("_").slice(0, 2).join("_"),
      ];
      
      for (const tryName of possibleNames) {
        const { data: found } = await supabase
          .from("integrations")
          .select("account_id, config")
          .eq("type", "whatsapp")
          .filter("config->>instance_name", "eq", tryName)
          .maybeSingle();
        
        if (found) {
          integration = found;
          console.log(`Found integration by instance_name: ${tryName}`);
          break;
        }
      }
    }
    
    // Method 2: Find by provider type (for now, get first UAZAPI integration)
    if (!integration) {
      const { data: found } = await supabase
        .from("integrations")
        .select("account_id, config")
        .eq("type", "whatsapp")
        .filter("config->>provider", "eq", "uazapi")
        .limit(1)
        .maybeSingle();
      
      if (found) {
        integration = found;
        console.log("Found integration by provider=uazapi");
      }
    }

    if (!integration) {
      console.log("No UAZAPI integration found");
      return new Response(JSON.stringify({ ignored: true, reason: "no_integration" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const accountId = integration.account_id;
    console.log(`Processing for account: ${accountId}`);

    // Handle message events (EventType: "messages" or event: "messages.upsert")
    if (eventType === "messages" || eventType === "messages.upsert") {
      // UAZAPI format: chat + message at root level
      if (payload.chat && payload.message) {
        const chat = payload.chat;
        const msg = payload.message;
        
        // Log structure for debugging
        console.log("Chat object keys:", Object.keys(chat));
        console.log("Message object keys:", Object.keys(msg));
        console.log("Chat phone:", chat.phone, "Chat jid:", chat.jid, "Chat number:", chat.number, "Chat id:", chat.id);
        console.log("Message body type:", typeof msg.body, "Message content type:", typeof msg.content);
        
        // Skip outgoing messages
        if (msg.fromMe) {
          console.log("Skipping outgoing message");
          return new Response(JSON.stringify({ ignored: true, reason: "outgoing" }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }
        
        // Extract phone from multiple possible locations
        let phone = normalizePhone(chat.phone) || normalizePhone(chat.jid) || normalizePhone(chat.number);
        
        // If still no phone, try to extract from chat.id (format: 5511999999999@s.whatsapp.net or similar)
        if (!phone && chat.id) {
          const idMatch = chat.id.match(/(\d{10,15})/);
          if (idMatch) {
            phone = `+${idMatch[1]}`;
          }
        }
        
        const contactName = chat.name || "Desconhecido";
        
        // Extract content from various formats
        let content = "";
        if (typeof msg.body === "string") {
          content = msg.body;
        } else if (typeof msg.content === "string") {
          content = msg.content;
        } else if (typeof msg.text === "string") {
          content = msg.text;
        } else if (msg.conversation) {
          content = msg.conversation;
        } else if (msg.extendedTextMessage?.text) {
          content = msg.extendedTextMessage.text;
        } else if (msg.imageMessage?.caption) {
          content = `[Imagem] ${msg.imageMessage.caption}`;
        } else if (msg.videoMessage?.caption) {
          content = `[Vídeo] ${msg.videoMessage.caption}`;
        } else if (msg.audioMessage) {
          content = "[Áudio]";
        } else if (typeof msg.body === "object" && msg.body !== null) {
          // Try to extract from nested structure
          const bodyObj = msg.body as Record<string, unknown>;
          if (bodyObj.conversation) content = String(bodyObj.conversation);
          else if (bodyObj.text) content = String(bodyObj.text);
          else if (bodyObj.extendedTextMessage && typeof bodyObj.extendedTextMessage === "object") {
            const ext = bodyObj.extendedTextMessage as Record<string, unknown>;
            if (ext.text) content = String(ext.text);
          }
        }
        
        const messageId = msg.id || `${Date.now()}`;
        const timestamp = msg.timestamp 
          ? new Date(Number(msg.timestamp) * 1000).toISOString()
          : new Date().toISOString();

        console.log(`Extracted - phone: ${phone}, content: ${content.substring(0, 50)}...`);

        if (!phone || !content) {
          console.log(`Skipping message: no phone (${phone}) or content (${content})`);
          return new Response(JSON.stringify({ ignored: true, reason: "missing_data" }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        console.log(`Processing message from ${phone} (${contactName}): ${content.substring(0, 50)}...`);

        // Find or create client
        let clientId: string | null = null;
        
        const { data: existingClient } = await supabase
          .from("clients")
          .select("id")
          .eq("account_id", accountId)
          .eq("phone_e164", phone)
          .maybeSingle();

        if (existingClient) {
          clientId = existingClient.id;
          console.log(`Found existing client: ${clientId}`);
        } else {
          const { data: newClient, error: createError } = await supabase
            .from("clients")
            .insert({
              account_id: accountId,
              phone_e164: phone,
              full_name: contactName,
              status: "no_contract",
            })
            .select("id")
            .single();

          if (newClient) {
            clientId = newClient.id;
            console.log(`Created new client: ${clientId} for ${phone}`);
          } else if (createError) {
            console.error("Error creating client:", createError);
          }
        }

        if (!clientId) {
          console.log("Could not find or create client");
          return new Response(JSON.stringify({ error: "client_creation_failed" }), { 
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        // Find or create conversation
        let conversationId: string | null = null;
        
        const { data: existingConvo } = await supabase
          .from("conversations")
          .select("id")
          .eq("account_id", accountId)
          .eq("client_id", clientId)
          .eq("channel", "whatsapp")
          .maybeSingle();

        if (existingConvo) {
          conversationId = existingConvo.id;
        } else {
          const { data: newConvo } = await supabase
            .from("conversations")
            .insert({
              account_id: accountId,
              client_id: clientId,
              channel: "whatsapp",
              external_thread_id: chat.id,
            })
            .select("id")
            .single();

          if (newConvo) {
            conversationId = newConvo.id;
          }
        }

        // Insert message event
        const { error: messageError } = await supabase
          .from("message_events")
          .insert({
            account_id: accountId,
            client_id: clientId,
            conversation_id: conversationId,
            source: "whatsapp_text",
            direction: "client_to_team",
            content_text: content,
            sent_at: timestamp,
          });

        if (messageError) {
          console.error("Error inserting message:", messageError);
          return new Response(JSON.stringify({ error: messageError.message }), { 
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }
        
        console.log("Message saved successfully!");

        // Trigger AI analysis for text messages
        if (content.length > 10 && !content.startsWith("[")) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/analyze-message`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                account_id: accountId,
                client_id: clientId,
                message_content: content,
              }),
            });
            console.log("AI analysis triggered");
          } catch (err) {
            console.log("AI analysis trigger error (non-blocking):", err);
          }
        }

        return new Response(
          JSON.stringify({ success: true, client_id: clientId, message_saved: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Alternative format: data.messages array
      if (payload.data?.messages) {
        const messages = payload.data.messages;
        let processedCount = 0;
        
        for (const msg of messages) {
          if (msg.key.fromMe) continue;
          if (isGroupJid(msg.key.remoteJid)) continue;

          const phone = extractPhoneFromJid(msg.key.remoteJid);
          const contactName = msg.pushName || "Desconhecido";
          
          let content = "";
          if (msg.message?.conversation) content = msg.message.conversation;
          else if (msg.message?.extendedTextMessage?.text) content = msg.message.extendedTextMessage.text;
          else if (msg.message?.imageMessage?.caption) content = `[Imagem] ${msg.message.imageMessage.caption}`;
          else if (msg.message?.videoMessage?.caption) content = `[Vídeo] ${msg.message.videoMessage.caption}`;
          else if (msg.message?.audioMessage) content = "[Áudio]";
          
          if (!phone || !content) continue;

          console.log(`Processing alt format message from ${phone}: ${content.substring(0, 50)}...`);

          // Find or create client
          let clientId: string | null = null;
          
          const { data: existingClient } = await supabase
            .from("clients")
            .select("id")
            .eq("account_id", accountId)
            .eq("phone_e164", phone)
            .maybeSingle();

          if (existingClient) {
            clientId = existingClient.id;
          } else {
            const { data: newClient } = await supabase
              .from("clients")
              .insert({
                account_id: accountId,
                phone_e164: phone,
                full_name: contactName,
                status: "no_contract",
              })
              .select("id")
              .single();

            if (newClient) clientId = newClient.id;
          }

          if (!clientId) continue;

          // Find or create conversation
          let conversationId: string | null = null;
          
          const { data: existingConvo } = await supabase
            .from("conversations")
            .select("id")
            .eq("account_id", accountId)
            .eq("client_id", clientId)
            .eq("channel", "whatsapp")
            .maybeSingle();

          if (existingConvo) {
            conversationId = existingConvo.id;
          } else {
            const { data: newConvo } = await supabase
              .from("conversations")
              .insert({
                account_id: accountId,
                client_id: clientId,
                channel: "whatsapp",
                external_thread_id: msg.key.remoteJid,
              })
              .select("id")
              .single();

            if (newConvo) conversationId = newConvo.id;
          }

          const timestamp = msg.messageTimestamp 
            ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
            : new Date().toISOString();

          await supabase
            .from("message_events")
            .insert({
              account_id: accountId,
              client_id: clientId,
              conversation_id: conversationId,
              source: "whatsapp_text",
              direction: "client_to_team",
              content_text: content,
              sent_at: timestamp,
            });

          processedCount++;
        }

        console.log(`Processed ${processedCount} messages`);
        return new Response(
          JSON.stringify({ success: true, processed: processedCount }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Handle connection update
    if (eventType === "connection" || eventType === "connection.update") {
      const state = payload.data?.state;
      console.log(`Connection update: ${state}`);

      await supabase
        .from("integrations")
        .update({
          status: state === "open" ? "connected" : "disconnected",
          config: {
            ...((integration.config as Record<string, unknown>) || {}),
            connection_state: state,
            last_connection_update: new Date().toISOString(),
          },
        })
        .eq("account_id", accountId)
        .eq("type", "whatsapp");

      return new Response(
        JSON.stringify({ success: true, event: eventType }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle QR code update
    if (eventType === "qrcode" || eventType === "qrcode.updated") {
      const qrcode = payload.data?.qrcode?.base64;
      console.log("QR Code updated");

      await supabase
        .from("integrations")
        .update({
          status: "pending",
          config: {
            ...((integration.config as Record<string, unknown>) || {}),
            qrcode_base64: qrcode,
            qrcode_updated_at: new Date().toISOString(),
          },
        })
        .eq("account_id", accountId)
        .eq("type", "whatsapp");

      return new Response(
        JSON.stringify({ success: true, event: eventType }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Unhandled event type: ${eventType}`);
    return new Response(
      JSON.stringify({ success: true, event: eventType, handled: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("UAZAPI Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
