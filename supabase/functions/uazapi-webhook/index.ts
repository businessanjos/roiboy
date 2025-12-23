import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface UazapiMessage {
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
    imageMessage?: {
      caption?: string;
    };
    videoMessage?: {
      caption?: string;
    };
    audioMessage?: {
      seconds?: number;
    };
  };
  messageTimestamp?: number | string;
}

interface UazapiWebhook {
  event: string;
  instance: string;
  data?: {
    messages?: UazapiMessage[];
    state?: string;
    qrcode?: {
      base64?: string;
    };
  };
}

function extractPhoneFromJid(jid: string): string {
  if (!jid) return "";
  // Format: 5511999999999@s.whatsapp.net or 5511999999999@g.us (group)
  const match = jid.match(/^(\d+)@/);
  return match ? `+${match[1]}` : "";
}

function isGroupJid(jid: string): boolean {
  return jid?.includes("@g.us") || false;
}

function extractTextContent(message: UazapiMessage["message"]): string | null {
  if (!message) return null;
  
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return `[Imagem] ${message.imageMessage.caption}`;
  if (message.videoMessage?.caption) return `[Vídeo] ${message.videoMessage.caption}`;
  if (message.audioMessage) return "[Áudio]";
  
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const webhook: UazapiWebhook = await req.json();
    const { event, instance, data } = webhook;

    console.log(`UAZAPI Webhook: ${event} from instance ${instance}`);

    // Extract account_id from instance name (roy_accountid)
    const instanceMatch = instance.match(/^roy_(.+)$/);
    if (!instanceMatch) {
      console.log("Invalid instance name format, ignoring");
      return new Response(JSON.stringify({ ignored: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Find account by integration instance_name
    const { data: integration } = await supabase
      .from("integrations")
      .select("account_id, config")
      .eq("type", "whatsapp")
      .filter("config->instance_name", "eq", instance)
      .maybeSingle();

    if (!integration) {
      console.log(`No integration found for instance ${instance}`);
      return new Response(JSON.stringify({ ignored: true, reason: "no_integration" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const accountId = integration.account_id;

    // Handle different event types
    switch (event) {
      case "connection.update": {
        const state = data?.state;
        console.log(`Connection update for ${accountId}: ${state}`);

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

        break;
      }

      case "qrcode.updated": {
        const qrcode = data?.qrcode?.base64;
        console.log(`QR Code updated for ${accountId}`);

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

        break;
      }

      case "messages.upsert": {
        const messages = data?.messages || [];
        
        for (const msg of messages) {
          // Skip outgoing messages
          if (msg.key.fromMe) continue;
          
          // Skip group messages
          if (isGroupJid(msg.key.remoteJid)) continue;

          const phone = extractPhoneFromJid(msg.key.remoteJid);
          const content = extractTextContent(msg.message);
          const contactName = msg.pushName || "Desconhecido";
          const timestamp = msg.messageTimestamp 
            ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
            : new Date().toISOString();

          if (!phone || !content) {
            console.log("Skipping message: no phone or content");
            continue;
          }

          console.log(`Processing message from ${phone}: ${content.substring(0, 50)}...`);

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
            // Create new client
            const { data: newClient } = await supabase
              .from("clients")
              .insert({
                account_id: accountId,
                phone_e164: phone,
                full_name: contactName,
                status: "lead",
              })
              .select("id")
              .single();

            if (newClient) {
              clientId = newClient.id;
              console.log(`Created new client ${clientId} for ${phone}`);
            }
          }

          if (!clientId) {
            console.log("Could not find or create client, skipping");
            continue;
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
                external_thread_id: msg.key.remoteJid,
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
              channel: "whatsapp",
              direction: "client_to_team",
              content: content,
              external_message_id: msg.key.id,
              happened_at: timestamp,
              metadata: {
                source: "uazapi",
                contact_name: contactName,
                instance: instance,
              },
            });

          if (messageError) {
            console.error("Error inserting message:", messageError);
          } else {
            console.log("Message saved successfully");

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
              } catch (err) {
                console.log("AI analysis trigger error (non-blocking):", err);
              }
            }
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event: ${event}`);
    }

    return new Response(
      JSON.stringify({ success: true, event }),
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
