import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// UAZAPI sends messages in this format (from actual webhook payload)
interface UazapiInstance {
  name?: string;
  status?: string;
  lastDisconnect?: string;
  lastDisconnectReason?: string;
}

interface UazapiWebhookPayload {
  BaseUrl?: string;
  EventType?: string;
  instanceName?: string;
  // Alternative formats
  event?: string;
  instance?: string | UazapiInstance;
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
    // Group chat fields
    wa_chatid?: string;
    wa_isGroup?: boolean;
    wa_name?: string;
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
    // Sender info for group messages
    sender?: string;
    sender_pn?: string;
    senderName?: string;
    isGroup?: boolean;
    chatid?: string;
    groupName?: string;
    // Nested message content
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string; url?: string; mimetype?: string; fileName?: string };
    videoMessage?: { caption?: string; url?: string; mimetype?: string; fileName?: string };
    audioMessage?: { seconds?: number; url?: string; mimetype?: string };
    documentMessage?: { fileName?: string; url?: string; mimetype?: string; caption?: string };
    stickerMessage?: { url?: string; mimetype?: string };
    // Media URL at root level (UAZAPI sometimes puts it here)
    mediaUrl?: string;
    media_url?: string;
    url?: string;
    mimetype?: string;
    fileName?: string;
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
    const rawInstance = payload.instance;
    
    // Instance can be a string or an object with a 'name' property
    const instanceName = typeof rawInstance === 'string' 
      ? rawInstance 
      : (rawInstance?.name || payload.instanceName || "");
    
    console.log(`BaseUrl: ${baseUrl}, instanceName: ${instanceName}`);

    // Find account - try different methods
    let integration = null;
    
    // Method 1: Find by instance name if provided
    if (instanceName) {
      const possibleNames = [
        instanceName,
        instanceName.replace(/_/g, "-"),
        instanceName.replace(/-/g, "_"),
        instanceName.split("_").slice(0, 2).join("-"),
        instanceName.split("_").slice(0, 2).join("_"),
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
        
        // Check if this is a reaction (not a real message)
        // UAZAPI includes 'reaction' field for message reactions
        const msgReaction = (msg as Record<string, unknown>).reaction;
        if (msgReaction && typeof msgReaction === "object" && msgReaction !== null) {
          console.log(`Ignoring reaction message:`, JSON.stringify(msgReaction));
          return new Response(JSON.stringify({ ignored: true, reason: "reaction_message" }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }
        
        // Also check messageType for reactions
        const msgType = (msg as Record<string, unknown>).messageType as string;
        if (msgType === "reaction" || msgType === "reactionMessage") {
          console.log(`Ignoring reaction by messageType: ${msgType}`);
          return new Response(JSON.stringify({ ignored: true, reason: "reaction_message" }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }
        
        // Check if this is a group message
        const isGroupMessage = msg.isGroup || chat.wa_isGroup || (chat.wa_chatid?.includes("@g.us"));
        
        // Log structure for debugging
        console.log("Chat object keys:", Object.keys(chat));
        console.log("Message object keys:", Object.keys(msg));
        console.log("Is group message:", isGroupMessage);
        console.log("Chat phone:", chat.phone, "Sender:", msg.sender, "Sender PN:", msg.sender_pn);
        console.log("Message body type:", typeof msg.body, "Message content type:", typeof msg.content);
        
        // Determine message direction (fromMe = sent by us)
        const direction = msg.fromMe ? "outbound" : "inbound";
        console.log(`Message direction: ${direction}`);
        
        // For outbound messages, we still need to process them to show in conversation
        
        // Extract phone - for group messages, use sender; for direct messages, use chat.phone
        // For outbound messages, we use the destination (chat.phone/wa_chatid)
        let phone = "";
        
        if (isGroupMessage) {
          if (direction === "outbound") {
            // For outbound group messages, we don't need sender phone
            // We use the group's info instead
            phone = ""; // Will be handled separately for groups
          } else {
            // For inbound group messages, extract sender's phone from sender or sender_pn field
            phone = normalizePhone(msg.sender_pn) || normalizePhone(msg.sender);
            
            // sender might be in format "5511999999999@s.whatsapp.net"
            if (!phone && msg.sender) {
              const senderMatch = msg.sender.match(/^(\d{10,15})/);
              if (senderMatch) {
                phone = `+${senderMatch[1]}`;
              }
            }
            console.log(`Group message - extracted sender phone: ${phone}`);
          }
        } else {
          // For direct messages, use chat.phone
          phone = normalizePhone(chat.phone) || normalizePhone(chat.jid) || normalizePhone(chat.number);
          
          // If still no phone, try to extract from chat.id
          if (!phone && chat.id) {
            const idMatch = chat.id.match(/(\d{10,15})/);
            if (idMatch) {
              phone = `+${idMatch[1]}`;
            }
          }
          
          // Try to extract from wa_chatid for direct messages
          if (!phone && chat.wa_chatid && !isGroupJid(chat.wa_chatid)) {
            phone = extractPhoneFromJid(chat.wa_chatid);
          }
        }
        
        const contactName = (isGroupMessage ? msg.senderName : chat.name) || "Desconhecido";
        
        // Extract content and media from various formats
        let content = "";
        let mediaUrl = "";
        let mediaType = "";
        let mediaMimetype = "";
        let mediaFilename = "";
        let audioDurationSec: number | null = null;
        
        // Check for media URL at various locations
        mediaUrl = msg.mediaUrl || msg.media_url || msg.url || "";
        mediaMimetype = msg.mimetype || "";
        mediaFilename = msg.fileName || "";
        
        // FIRST: Detect media type from message type field (UAZAPI uses 'type' or 'mediaType')
        const msgTypeField = msg.type || (msg as Record<string, unknown>).mediaType;
        if (msgTypeField && typeof msgTypeField === "string") {
          const msgType = msgTypeField.toLowerCase();
          if (msgType.includes("image")) mediaType = "image";
          else if (msgType.includes("audio") || msgType.includes("ptt")) mediaType = "audio";
          else if (msgType.includes("video")) mediaType = "video";
          else if (msgType.includes("document")) mediaType = "document";
          else if (msgType.includes("sticker")) mediaType = "sticker";
        }
        
        // Log the content structure for debugging
        console.log(`Content analysis - msg.content type: ${typeof msg.content}, msg.type: ${msg.type}, mediaType detected: ${mediaType}`);
        if (typeof msg.content === "object" && msg.content !== null) {
          console.log(`Content object keys: ${Object.keys(msg.content as Record<string, unknown>).join(", ")}`);
        }
        
        // Extract content based on message type
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
        } else if (msg.imageMessage) {
          mediaType = "image";
          mediaUrl = mediaUrl || msg.imageMessage.url || "";
          mediaMimetype = mediaMimetype || msg.imageMessage.mimetype || "";
          mediaFilename = mediaFilename || msg.imageMessage.fileName || "";
          content = msg.imageMessage.caption || "[Imagem]";
        } else if (msg.videoMessage) {
          mediaType = "video";
          mediaUrl = mediaUrl || msg.videoMessage.url || "";
          mediaMimetype = mediaMimetype || msg.videoMessage.mimetype || "";
          mediaFilename = mediaFilename || msg.videoMessage.fileName || "";
          content = msg.videoMessage.caption || "[Vídeo]";
        } else if (msg.audioMessage) {
          mediaType = "audio";
          mediaUrl = mediaUrl || msg.audioMessage.url || "";
          mediaMimetype = mediaMimetype || msg.audioMessage.mimetype || "";
          audioDurationSec = msg.audioMessage.seconds || null;
          content = "[Áudio]";
        } else if (msg.documentMessage) {
          mediaType = "document";
          mediaUrl = mediaUrl || msg.documentMessage.url || "";
          mediaMimetype = mediaMimetype || msg.documentMessage.mimetype || "";
          mediaFilename = mediaFilename || msg.documentMessage.fileName || "";
          content = msg.documentMessage.caption || `[Documento: ${mediaFilename}]`;
        } else if (msg.stickerMessage) {
          mediaType = "sticker";
          mediaUrl = mediaUrl || msg.stickerMessage.url || "";
          mediaMimetype = mediaMimetype || msg.stickerMessage.mimetype || "";
          content = "[Figurinha]";
        } else if (typeof msg.content === "object" && msg.content !== null) {
          // UAZAPI format: content is an object with imageMessage, audioMessage, etc.
          const contentObj = msg.content as Record<string, unknown>;
          
          if (contentObj.imageMessage && typeof contentObj.imageMessage === "object") {
            const imgMsg = contentObj.imageMessage as Record<string, unknown>;
            mediaType = "image";
            mediaUrl = mediaUrl || String(imgMsg.url || "");
            mediaMimetype = mediaMimetype || String(imgMsg.mimetype || "");
            mediaFilename = mediaFilename || String(imgMsg.fileName || "");
            content = String(imgMsg.caption || "[Imagem]");
          } else if (contentObj.videoMessage && typeof contentObj.videoMessage === "object") {
            const vidMsg = contentObj.videoMessage as Record<string, unknown>;
            mediaType = "video";
            mediaUrl = mediaUrl || String(vidMsg.url || "");
            mediaMimetype = mediaMimetype || String(vidMsg.mimetype || "");
            mediaFilename = mediaFilename || String(vidMsg.fileName || "");
            content = String(vidMsg.caption || "[Vídeo]");
          } else if (contentObj.audioMessage && typeof contentObj.audioMessage === "object") {
            const audMsg = contentObj.audioMessage as Record<string, unknown>;
            mediaType = "audio";
            mediaUrl = mediaUrl || String(audMsg.url || "");
            mediaMimetype = mediaMimetype || String(audMsg.mimetype || "");
            audioDurationSec = Number(audMsg.seconds) || null;
            content = "[Áudio]";
          } else if (contentObj.documentMessage && typeof contentObj.documentMessage === "object") {
            const docMsg = contentObj.documentMessage as Record<string, unknown>;
            mediaType = "document";
            mediaUrl = mediaUrl || String(docMsg.url || "");
            mediaMimetype = mediaMimetype || String(docMsg.mimetype || "");
            mediaFilename = mediaFilename || String(docMsg.fileName || "");
            content = String(docMsg.caption || `[Documento: ${mediaFilename}]`);
          } else if (contentObj.stickerMessage && typeof contentObj.stickerMessage === "object") {
            const stickerMsg = contentObj.stickerMessage as Record<string, unknown>;
            mediaType = "sticker";
            mediaUrl = mediaUrl || String(stickerMsg.url || "");
            mediaMimetype = mediaMimetype || String(stickerMsg.mimetype || "");
            content = "[Figurinha]";
          } else if (contentObj.conversation) {
            content = String(contentObj.conversation);
          } else if (contentObj.extendedTextMessage && typeof contentObj.extendedTextMessage === "object") {
            const ext = contentObj.extendedTextMessage as Record<string, unknown>;
            if (ext.text) content = String(ext.text);
          }
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
        
        // If still no content but we detected a media type, set default content
        if (!content && mediaType) {
          const mediaLabels: Record<string, string> = {
            image: "[Imagem]",
            video: "[Vídeo]",
            audio: "[Áudio]",
            document: "[Documento]",
            sticker: "[Figurinha]",
          };
          content = mediaLabels[mediaType] || "[Mídia]";
        }
        
        console.log(`Media info - type: ${mediaType}, url: ${mediaUrl?.substring(0, 50)}..., mimetype: ${mediaMimetype}`);
        
        const messageId = msg.id || `${Date.now()}`;
        const timestamp = msg.timestamp 
          ? new Date(Number(msg.timestamp) * 1000).toISOString()
          : new Date().toISOString();

        console.log(`Extracted - phone: ${phone}, content: ${content.substring(0, 50)}...`);

        // For outbound messages in groups, we don't need a phone, just the group identifier
        // For direct outbound messages, we need phone
        // For inbound messages, we always need phone and content
        if (direction === "inbound" && (!phone || !content)) {
          console.log(`Skipping inbound message: no phone (${phone}) or content (${content})`);
          return new Response(JSON.stringify({ ignored: true, reason: "missing_data" }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }
        
        if (direction === "outbound" && !content) {
          console.log(`Skipping outbound message: no content`);
          return new Response(JSON.stringify({ ignored: true, reason: "missing_content" }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }
        
        // For direct outbound messages, we need the destination phone
        if (direction === "outbound" && !isGroupMessage && !phone) {
          console.log(`Skipping outbound direct message: no destination phone`);
          return new Response(JSON.stringify({ ignored: true, reason: "missing_phone" }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        console.log(`Processing ${direction} message ${isGroupMessage ? 'in group' : 'from/to ' + phone} (${contactName}): ${content.substring(0, 50)}...`);

        // ============================================
        // ZAPP: Save ALL conversations (client or not)
        // ============================================
        
        // For group messages, use group_jid as identifier
        // For direct messages, use phone_e164
        // The group identifier might be in wa_chatid (e.g., "123456789@g.us") or msg.chatid
        const groupJid = isGroupMessage ? (msg.chatid || chat.wa_chatid || chat.id) : null;
        const groupName = isGroupMessage ? (msg.groupName || chat.name || chat.wa_name) : null;
        
        console.log(`Group info - isGroup: ${isGroupMessage}, groupJid: ${groupJid}, groupName: ${groupName}, chat.id: ${chat.id}, msg.chatid: ${msg.chatid}`);
        
        // Find or create zapp_conversation (for ALL contacts)
        let zappConversationId: string | null = null;
        
        let existingZappConvo;
        
        if (isGroupMessage && groupJid) {
          // For groups, search by group_jid
          const { data } = await supabase
            .from("zapp_conversations")
            .select("id, unread_count")
            .eq("account_id", accountId)
            .eq("group_jid", groupJid)
            .maybeSingle();
          existingZappConvo = data;
        } else {
          // For direct messages, search by phone_e164
          const { data } = await supabase
            .from("zapp_conversations")
            .select("id, unread_count")
            .eq("account_id", accountId)
            .eq("phone_e164", phone)
            .eq("is_group", false)
            .maybeSingle();
          existingZappConvo = data;
        }

        if (existingZappConvo) {
          zappConversationId = existingZappConvo.id;
          
          // Update last message info
          // Only increment unread count for inbound messages
          const updateData: Record<string, unknown> = {
            last_message_at: timestamp,
            last_message_preview: direction === "outbound"
              ? `Você: ${content.substring(0, 80)}`
              : (isGroupMessage 
                  ? `${contactName}: ${content.substring(0, 80)}`
                  : content.substring(0, 100)),
          };
          
          // Only update contact_name for inbound messages
          if (direction === "inbound") {
            updateData.contact_name = isGroupMessage ? groupName : contactName;
            updateData.unread_count = (existingZappConvo.unread_count || 0) + 1;
          }
          
          await supabase
            .from("zapp_conversations")
            .update(updateData)
            .eq("id", zappConversationId);
        } else {
          // Find client if exists (to link) - only for direct messages
          let clientId = null;
          if (!isGroupMessage) {
            const { data: existingClient } = await supabase
              .from("clients")
              .select("id")
              .eq("account_id", accountId)
              .eq("phone_e164", phone)
              .maybeSingle();
            clientId = existingClient?.id || null;
          }
          
          const { data: newZappConvo, error: zappConvoError } = await supabase
            .from("zapp_conversations")
            .insert({
              account_id: accountId,
              client_id: clientId,
              phone_e164: isGroupMessage ? "" : phone,
              contact_name: isGroupMessage ? groupName : contactName,
              channel: "whatsapp",
              external_thread_id: chat.id,
              is_group: isGroupMessage,
              group_jid: groupJid,
              last_message_at: timestamp,
              last_message_preview: direction === "outbound"
                ? `Você: ${content.substring(0, 80)}`
                : (isGroupMessage 
                    ? `${contactName}: ${content.substring(0, 80)}`
                    : content.substring(0, 100)),
              unread_count: direction === "inbound" ? 1 : 0,
            })
            .select("id")
            .single();

          if (newZappConvo) {
            zappConversationId = newZappConvo.id;
            console.log(`Created new zapp_conversation (group: ${isGroupMessage}): ${zappConversationId}`);
          } else if (zappConvoError) {
            console.error("Error creating zapp_conversation:", zappConvoError);
          }
        }

        // Save message to zapp_messages (check for duplicates first)
        if (zappConversationId) {
          // Check if message already exists (by external_message_id or by content+timestamp for messages sent from UI)
          const { data: existingMsg } = await supabase
            .from("zapp_messages")
            .select("id")
            .eq("zapp_conversation_id", zappConversationId)
            .eq("external_message_id", messageId)
            .maybeSingle();

          if (existingMsg) {
            console.log(`Message already exists with external_message_id ${messageId}, skipping insert`);
          } else {
            // For outbound messages, also check for recent duplicates without external_message_id
            // This handles messages sent from the UI that are then echoed back by the webhook
            let isDuplicate = false;
            if (direction === "outbound") {
              const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
              const { data: recentDupe } = await supabase
                .from("zapp_messages")
                .select("id")
                .eq("zapp_conversation_id", zappConversationId)
                .eq("direction", "outbound")
                .eq("content", content)
                .is("external_message_id", null)
                .gte("created_at", twoMinutesAgo)
                .limit(1)
                .maybeSingle();

              if (recentDupe) {
                // Update the existing message with the external_message_id
                await supabase
                  .from("zapp_messages")
                  .update({ external_message_id: messageId })
                  .eq("id", recentDupe.id);
                console.log(`Updated existing message ${recentDupe.id} with external_message_id ${messageId}`);
                isDuplicate = true;
              }
            }

            if (!isDuplicate) {
              const { error: zappMsgError } = await supabase
                .from("zapp_messages")
                .insert({
                  account_id: accountId,
                  zapp_conversation_id: zappConversationId,
                  direction: direction,
                  content: content,
                  message_type: mediaType || "text",
                  external_message_id: messageId,
                  sent_at: timestamp,
                  // For group messages, store sender info
                  sender_phone: isGroupMessage ? phone : null,
                  sender_name: isGroupMessage ? contactName : null,
                  // Media fields
                  media_url: mediaUrl || null,
                  media_type: mediaType || null,
                  media_mimetype: mediaMimetype || null,
                  media_filename: mediaFilename || null,
                  audio_duration_sec: audioDurationSec,
                });

              if (zappMsgError) {
                console.error("Error saving zapp_message:", zappMsgError);
              } else {
                console.log(`Zapp message saved successfully! Media: ${mediaType || 'none'}, URL: ${mediaUrl ? 'yes' : 'no'}`);
              }
            }
          }

          // Create or update zapp_conversation_assignment for the queue
          const { data: existingAssignment } = await supabase
            .from("zapp_conversation_assignments")
            .select("id, status")
            .eq("account_id", accountId)
            .eq("zapp_conversation_id", zappConversationId)
            .maybeSingle();

          if (existingAssignment) {
            await supabase
              .from("zapp_conversation_assignments")
              .update({
                updated_at: timestamp,
                // If conversation was closed and client sends new message, reopen to triage
                status: existingAssignment.status === "closed" ? "triage" : existingAssignment.status,
              })
              .eq("id", existingAssignment.id);
            console.log("Updated existing zapp assignment");
          } else {
            const { error: assignmentError } = await supabase
              .from("zapp_conversation_assignments")
              .insert({
                account_id: accountId,
                zapp_conversation_id: zappConversationId,
                status: "triage", // New conversations start in triage
              });

            if (assignmentError) {
              console.error("Error creating zapp assignment:", assignmentError);
            } else {
              console.log("Created new zapp assignment in queue");
            }
          }
        }

        // ============================================
        // CLIENT ANALYSIS: Only for registered clients (inbound messages)
        // ============================================
        
        // Only process client analysis for inbound messages with a phone
        if (direction === "inbound" && phone) {
          const { data: existingClient } = await supabase
            .from("clients")
            .select("id")
            .eq("account_id", accountId)
            .eq("phone_e164", phone)
            .maybeSingle();

          if (existingClient) {
            const clientId = existingClient.id;
            console.log(`Found existing client: ${clientId} - saving to message_events for AI analysis`);

            // Find or create conversation (for client analysis)
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

            // Insert message event for AI analysis
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
              console.error("Error inserting message_event:", messageError);
            }

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
          } else {
            console.log(`Message from ${phone} saved to Zapp only (not a registered client)`);
          }
        } else if (direction === "outbound") {
          console.log(`Outbound message saved to Zapp`);
        }

        return new Response(
          JSON.stringify({ success: true, zapp_conversation_id: zappConversationId, phone }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Alternative format: data.messages array
      if (payload.data?.messages) {
        const messages = payload.data.messages;
        let processedCount = 0;
        
        for (const msg of messages) {
          if (msg.key.fromMe) continue;
          
          const isGroupMsg = isGroupJid(msg.key.remoteJid);
          const groupJid = isGroupMsg ? msg.key.remoteJid : null;

          // For group messages, we need to extract sender phone differently
          // The msg.key.participant contains the sender's JID in group messages
          let phone = "";
          if (isGroupMsg) {
            // In group messages, participant field contains sender's JID
            const participantJid = (msg.key as any).participant || "";
            phone = extractPhoneFromJid(participantJid);
          } else {
            phone = extractPhoneFromJid(msg.key.remoteJid);
          }
          
          const contactName = msg.pushName || "Desconhecido";
          
          let content = "";
          if (msg.message?.conversation) content = msg.message.conversation;
          else if (msg.message?.extendedTextMessage?.text) content = msg.message.extendedTextMessage.text;
          else if (msg.message?.imageMessage?.caption) content = `[Imagem] ${msg.message.imageMessage.caption}`;
          else if (msg.message?.videoMessage?.caption) content = `[Vídeo] ${msg.message.videoMessage.caption}`;
          else if (msg.message?.audioMessage) content = "[Áudio]";
          
          // For groups, phone might be empty but we can still process if we have groupJid
          if (!content) continue;
          if (!isGroupMsg && !phone) continue;

          console.log(`Processing alt format message (group: ${isGroupMsg}) from ${phone}: ${content.substring(0, 50)}...`);

          const timestamp = msg.messageTimestamp 
            ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
            : new Date().toISOString();
          
          const messageId = msg.key.id || `${Date.now()}`;

          // ============================================
          // ZAPP: Save ALL conversations (client or not)
          // ============================================
          
          let zappConversationId: string | null = null;
          let existingZappConvo;
          
          if (isGroupMsg && groupJid) {
            // For groups, search by group_jid
            const { data } = await supabase
              .from("zapp_conversations")
              .select("id, unread_count")
              .eq("account_id", accountId)
              .eq("group_jid", groupJid)
              .maybeSingle();
            existingZappConvo = data;
          } else {
            // For direct messages, search by phone_e164
            const { data } = await supabase
              .from("zapp_conversations")
              .select("id, unread_count")
              .eq("account_id", accountId)
              .eq("phone_e164", phone)
              .eq("is_group", false)
              .maybeSingle();
            existingZappConvo = data;
          }

          if (existingZappConvo) {
            zappConversationId = existingZappConvo.id;
            
            await supabase
              .from("zapp_conversations")
              .update({
                last_message_at: timestamp,
                last_message_preview: isGroupMsg 
                  ? `${contactName}: ${content.substring(0, 80)}`
                  : content.substring(0, 100),
                unread_count: (existingZappConvo.unread_count || 0) + 1,
              })
              .eq("id", zappConversationId);
          } else {
            // For direct messages, try to find client
            let clientId = null;
            if (!isGroupMsg && phone) {
              const { data: existingClientForZapp } = await supabase
                .from("clients")
                .select("id")
                .eq("account_id", accountId)
                .eq("phone_e164", phone)
                .maybeSingle();
              clientId = existingClientForZapp?.id || null;
            }
            
            const { data: newZappConvo } = await supabase
              .from("zapp_conversations")
              .insert({
                account_id: accountId,
                client_id: clientId,
                phone_e164: isGroupMsg ? "" : phone,
                contact_name: contactName,
                channel: "whatsapp",
                external_thread_id: msg.key.remoteJid,
                is_group: isGroupMsg,
                group_jid: groupJid,
                last_message_at: timestamp,
                last_message_preview: isGroupMsg 
                  ? `${contactName}: ${content.substring(0, 80)}`
                  : content.substring(0, 100),
                unread_count: 1,
              })
              .select("id")
              .single();

            if (newZappConvo) {
              zappConversationId = newZappConvo.id;
            }
          }

          // Save to zapp_messages
          if (zappConversationId) {
            await supabase
              .from("zapp_messages")
              .insert({
                account_id: accountId,
                zapp_conversation_id: zappConversationId,
                direction: "inbound",
                content: content,
                message_type: msg.message?.audioMessage ? "audio" : "text",
                external_message_id: messageId,
                sent_at: timestamp,
                // For group messages, store sender info
                sender_phone: isGroupMsg ? phone : null,
                sender_name: isGroupMsg ? contactName : null,
              });

            // Create or update zapp assignment
            const { data: existingAssignment } = await supabase
              .from("zapp_conversation_assignments")
              .select("id, status")
              .eq("account_id", accountId)
              .eq("zapp_conversation_id", zappConversationId)
              .maybeSingle();

            if (existingAssignment) {
              await supabase
                .from("zapp_conversation_assignments")
                .update({
                  updated_at: timestamp,
                  // If conversation was closed and client sends new message, reopen to triage
                  status: existingAssignment.status === "closed" ? "triage" : existingAssignment.status,
                })
                .eq("id", existingAssignment.id);
            } else {
              await supabase
                .from("zapp_conversation_assignments")
                .insert({
                  account_id: accountId,
                  zapp_conversation_id: zappConversationId,
                  status: "triage", // New conversations start in triage
                });
            }
          }

          // ============================================
          // CLIENT ANALYSIS: Only for registered clients
          // ============================================
          
          const { data: existingClient } = await supabase
            .from("clients")
            .select("id")
            .eq("account_id", accountId)
            .eq("phone_e164", phone)
            .maybeSingle();

          if (existingClient) {
            const clientId = existingClient.id;

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
          }

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

    // Handle message status updates (ack events)
    if (eventType === "messages.ack" || eventType === "message.ack" || eventType === "ack" || eventType === "messages.update") {
      console.log("Message status update received:", JSON.stringify(payload).substring(0, 500));
      
      // UAZAPI sends status updates in various formats
      // Try to extract message ID and status
      let messageId = "";
      let status = "";
      
      // Use type assertion to handle dynamic payload structure
      const payloadAny = payload as any;
      
      // Format 1: { data: { messages: [{ key: { id }, update: { status } }] } }
      if (payloadAny.data?.messages) {
        for (const msgUpdate of payloadAny.data.messages) {
          messageId = msgUpdate.key?.id || "";
          // UAZAPI ack values: 0=error, 1=pending, 2=sent, 3=delivered, 4=read
          const ack = msgUpdate.update?.status || msgUpdate.ack;
          status = ack === 4 ? "read" : ack === 3 ? "delivered" : ack === 2 ? "sent" : ack === 1 ? "pending" : "failed";
        }
      } else if (payloadAny.data?.id || payloadAny.message?.id) {
        // Format 2: { data: { id, ack } }
        messageId = payloadAny.data?.id || payloadAny.message?.id || "";
        const ack = payloadAny.data?.ack || payloadAny.ack || 0;
        status = ack === 4 ? "read" : ack === 3 ? "delivered" : ack === 2 ? "sent" : ack === 1 ? "pending" : "failed";
      } else if (payloadAny.ack !== undefined) {
        // Format 3: { id, ack } at root level
        messageId = payloadAny.id || "";
        const ack = payloadAny.ack;
        status = ack === 4 ? "read" : ack === 3 ? "delivered" : ack === 2 ? "sent" : ack === 1 ? "pending" : "failed";
      }
      
      if (messageId && status) {
        console.log(`Updating message ${messageId} status to: ${status}`);
        
        const { error: updateError } = await supabase
          .from("zapp_messages")
          .update({ delivery_status: status })
          .eq("account_id", accountId)
          .eq("external_message_id", messageId);
        
        if (updateError) {
          console.error("Error updating message status:", updateError);
        } else {
          console.log(`Message ${messageId} status updated to ${status}`);
        }
      } else {
        console.log("Could not extract message ID or status from payload");
      }
      
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
