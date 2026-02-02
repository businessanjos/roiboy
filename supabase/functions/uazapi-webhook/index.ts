import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Background task to process AI queue
async function processAIQueue(supabaseUrl: string, supabaseKey: string) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check if there are pending jobs
    const { count } = await supabase
      .from("ai_analysis_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    
    if (!count || count === 0) {
      console.log("[BG] No pending jobs in AI queue");
      return;
    }
    
    console.log(`[BG] Found ${count} pending jobs, triggering queue processor`);
    
    // Call the process-ai-queue function
    const response = await fetch(`${supabaseUrl}/functions/v1/process-ai-queue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`[BG] Queue processing result:`, result);
    } else {
      console.error(`[BG] Queue processing failed:`, response.status);
    }
  } catch (err) {
    console.error("[BG] Error in background queue processing:", err);
  }
}

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

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
    extendedTextMessage?: { text?: string; contextInfo?: { quotedMessage?: Record<string, unknown>; stanzaId?: string; participant?: string } };
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
    // Quoted message (reply) fields
    quotedMsg?: Record<string, unknown>;
    quotedMessageId?: string;
    contextInfo?: { quotedMessage?: Record<string, unknown>; stanzaId?: string; participant?: string };
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

/**
 * Normalizes phone numbers to E.164 format.
 * CRITICAL FOR BRAZIL: Adds the 9th digit prefix for mobile numbers if missing.
 * 
 * Brazilian mobile numbers transitioned to 9-digit format (after DDD):
 * - Old format: 55 + DDD(2) + number(8) = 12 digits (e.g., +557197398455)
 * - New format: 55 + DDD(2) + 9 + number(8) = 13 digits (e.g., +5571997398455)
 * 
 * This normalization prevents duplicate contacts when WhatsApp/UAZAPI sends
 * the same number in different formats.
 */
function normalizePhone(phone: string | undefined): string {
  if (!phone) return "";
  
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  
  // BRAZILIAN PHONE NORMALIZATION
  // If we receive a 12-digit BR number (missing 9th digit), add it
  if (digits.length === 12 && digits.startsWith("55")) {
    const ddd = digits.substring(2, 4);
    const dddNumber = parseInt(ddd, 10);
    
    // Valid Brazilian DDDs range from 11 to 99
    // Mobile numbers in Brazil all start with 9 after the DDD
    if (dddNumber >= 11 && dddNumber <= 99) {
      // Insert '9' after the DDD (position 4) to make it 13 digits
      const normalizedDigits = digits.substring(0, 4) + "9" + digits.substring(4);
      console.log(`[PHONE] Normalized BR phone: +${digits} → +${normalizedDigits} (added 9th digit)`);
      digits = normalizedDigits;
    }
  }
  
  return `+${digits}`;
}

serve(async (req) => {
  // ============ LATENCY MONITORING ============
  const latencyMarks: { step: string; timestamp: number; elapsed: number }[] = [];
  const startTime = Date.now();
  
  const markLatency = (step: string) => {
    const now = Date.now();
    latencyMarks.push({
      step,
      timestamp: now,
      elapsed: now - startTime
    });
  };
  
  markLatency("webhook_received");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    markLatency("supabase_client_created");

    const payload: UazapiWebhookPayload = await req.json();
    
    markLatency("payload_parsed");
    
    // Extract message timestamp from payload for end-to-end latency calculation
    const msgTimestamp = payload.message?.timestamp;
    let messageOriginTime: number | null = null;
    if (msgTimestamp) {
      // UAZAPI sends timestamp in seconds
      messageOriginTime = Number(msgTimestamp) * 1000;
      const webhookDelay = startTime - messageOriginTime;
      console.log(`[LATENCY] Message origin → Webhook received: ${webhookDelay}ms (UAZAPI provider delay)`);
    }
    
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
    // Using .limit(1) instead of .maybeSingle() to handle multiple integrations sharing same instance
    if (instanceName) {
      const possibleNames = [
        instanceName,
        instanceName.replace(/_/g, "-"),
        instanceName.replace(/-/g, "_"),
        instanceName.split("_").slice(0, 2).join("-"),
        instanceName.split("_").slice(0, 2).join("_"),
      ];
      
      for (const tryName of possibleNames) {
      const { data: results } = await supabase
          .from("integrations")
          .select("id, account_id, config, sector_id")
          .eq("type", "whatsapp")
          .filter("config->>instance_name", "eq", tryName)
          .order("created_at", { ascending: true })
          .limit(1);
        
        if (results && results.length > 0) {
          integration = results[0];
          console.log(`Found integration by instance_name: ${tryName}, sector: ${integration.sector_id}`);
          break;
        }
      }
    }
    
    // Method 2: Find by instance_token from payload (more reliable)
    // Using .limit(1) to handle multiple integrations sharing same token
    const payloadToken = (payload as Record<string, unknown>).token as string | undefined;
    if (!integration && payloadToken) {
      const { data: results } = await supabase
        .from("integrations")
        .select("id, account_id, config, sector_id")
        .eq("type", "whatsapp")
        .filter("config->>instance_token", "eq", payloadToken)
        .order("created_at", { ascending: true })
        .limit(1);
      
      if (results && results.length > 0) {
        integration = results[0];
        console.log(`Found integration by instance_token: ${payloadToken?.slice(0, 8)}..., sector: ${integration.sector_id}`);
      }
    }
    
    // Method 3: Find by phone number if available in payload
    const instanceOwner = (payload as Record<string, unknown>).instanceOwner as string | undefined;
    if (!integration && instanceOwner) {
      const phoneClean = String(instanceOwner).replace(/\D/g, "");
      const { data: results } = await supabase
        .from("integrations")
        .select("id, account_id, config, sector_id")
        .eq("type", "whatsapp")
        .filter("config->>phone_number", "eq", phoneClean)
        .order("created_at", { ascending: true })
        .limit(1);
      
      if (results && results.length > 0) {
        integration = results[0];
        console.log(`Found integration by phone_number: ${phoneClean}, sector: ${integration.sector_id}`);
      }
    }
    
    // CRITICAL SECURITY: NO FALLBACK - Reject if integration cannot be precisely identified
    // This prevents messages from being routed to the wrong account in multi-tenant environment
    if (!integration) {
      console.error("SECURITY REJECTION: Could not identify specific integration for webhook payload");
      console.error(JSON.stringify({
        event: "webhook_rejected",
        reason: "cannot_identify_account",
        identifiers: { 
          instanceName: instanceName || "none", 
          payloadToken: payloadToken?.slice(0, 8) || "none", 
          instanceOwner: instanceOwner || "none" 
        },
        timestamp: new Date().toISOString()
      }));
      return new Response(JSON.stringify({ 
        rejected: true, 
        reason: "cannot_identify_account",
        message: "Webhook payload could not be matched to a specific integration. This is a security measure to prevent cross-account data leakage." 
      }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    
    markLatency("integration_found");

    const accountId = integration.account_id;
    const sectorId = integration.sector_id;
    const integrationId = integration.id;
    console.log(`Processing for account: ${accountId}, sector: ${sectorId}, integration: ${integrationId}`);
    
    // Find the department for this sector to properly associate conversations
    // Using order by created_at to be deterministic when multiple departments exist
    let sectorDepartmentId: string | null = null;
    if (sectorId) {
      const { data: dept } = await supabase
        .from("zapp_departments")
        .select("id")
        .eq("account_id", accountId)
        .eq("sector_id", sectorId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (dept) {
        sectorDepartmentId = dept.id;
        console.log(`Found department for sector ${sectorId}: ${sectorDepartmentId}`);
      } else {
        console.log(`No department found for sector ${sectorId}`);
      }
    }

    // Handle message events (EventType: "messages" or event: "messages.upsert")
    if (eventType === "messages" || eventType === "messages.upsert") {
      // UAZAPI format: chat + message at root level
      if (payload.chat && payload.message) {
        const chat = payload.chat;
        const msg = payload.message;
        
        // DETAILED LOG: Start of message processing
        console.log(`[WEBHOOK] Processing message - chat.phone: ${chat.phone || 'N/A'}, chat.name: ${chat.name || 'N/A'}, msg.fromMe: ${msg.fromMe}, msg.type: ${msg.type || 'N/A'}, msg.id: ${msg.id || 'N/A'}`);
        
        // Check if this is a reaction (not a real message)
        // UAZAPI includes 'reaction' field for message reactions
        const msgReaction = (msg as Record<string, unknown>).reaction;
        if (msgReaction && typeof msgReaction === "object" && msgReaction !== null) {
          console.log(`Ignoring reaction message:`, JSON.stringify(msgReaction));
          return new Response(JSON.stringify({ ignored: true, reason: "reaction_message" }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }
        
        // Also check messageType and type for reactions (case-insensitive)
        const msgTypeCheck = (msg as Record<string, unknown>).messageType as string;
        const typeCheck = (msg as Record<string, unknown>).type as string;
        const isReaction = (msgTypeCheck && msgTypeCheck.toLowerCase().includes("reaction")) || 
                           (typeCheck && typeCheck.toLowerCase().includes("reaction"));
        if (isReaction) {
          console.log(`Ignoring reaction by messageType: ${msgTypeCheck}, type: ${typeCheck}`);
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
        
        // Check for media URL at various locations (UAZAPI puts it in different places)
        const msgAny = msg as Record<string, unknown>;
        const contentObj = (typeof msg.content === "object" && msg.content !== null) 
          ? msg.content as Record<string, unknown> 
          : null;
        
        // UAZAPI puts media URL in msg.content.URL (uppercase) for media messages
        mediaUrl = msg.mediaUrl || msg.media_url || msg.url || 
          String(msgAny.mediaUrl || msgAny.media_url || msgAny.url || "") ||
          (contentObj ? String(contentObj.URL || contentObj.url || "") : "");
        mediaMimetype = msg.mimetype || String(msgAny.mimetype || "") ||
          (contentObj ? String(contentObj.mimetype || "") : "");
        mediaFilename = msg.fileName || String(msgAny.fileName || msgAny.filename || "") ||
          (contentObj ? String(contentObj.fileName || contentObj.filename || "") : "");
        
        // FIRST: Log ALL type-related fields for debugging
        console.log(`Type fields - msg.type: "${msg.type}", msgAny.mediaType: "${msgAny.mediaType}", msgAny.messageType: "${msgAny.messageType}"`);
        
        // FIRST: Detect media type from message type field (UAZAPI uses 'type' or 'mediaType')
        // Priority: mediaType > messageType > type (since 'type' is often just 'text' even for media)
        const msgTypeField = msgAny.mediaType || msgAny.messageType || msg.type;
        if (msgTypeField && typeof msgTypeField === "string") {
          const msgType = msgTypeField.toLowerCase();
          if (msgType.includes("image")) mediaType = "image";
          else if (msgType.includes("audio") || msgType.includes("ptt")) mediaType = "audio";
          else if (msgType.includes("video")) mediaType = "video";
          else if (msgType.includes("document")) mediaType = "document";
          else if (msgType.includes("sticker")) mediaType = "sticker";
        }
        
        // Log for debugging media messages
        console.log(`Media detection - msgTypeField: "${msgTypeField}", detected mediaType: "${mediaType}", mediaUrl present: ${!!mediaUrl}, mediaUrl: "${String(mediaUrl).substring(0, 100)}"`);
        
        // Log the content structure for debugging
        console.log(`Content analysis - msg.content type: ${typeof msg.content}, msg.type: ${msg.type}, mediaType detected: ${mediaType}`);
        if (typeof msg.content === "object" && msg.content !== null) {
          console.log(`Content object keys: ${Object.keys(msg.content as Record<string, unknown>).join(", ")}`);
        }
        
        // Extract content based on message type
        // Note: For media messages, UAZAPI may send the caption in text/content/body fields
        // So we capture the text first, then if we have media info, we enhance it
        if (typeof msg.body === "string") {
          content = msg.body;
        } else if (typeof msg.content === "string") {
          content = msg.content;
        } else if (typeof msg.text === "string") {
          content = msg.text;
        } else if (typeof msgAny.caption === "string") {
          content = msgAny.caption as string;
        } else if (msg.conversation) {
          content = msg.conversation;
        } else if (msg.extendedTextMessage?.text) {
          content = msg.extendedTextMessage.text;
        } else if (msg.imageMessage) {
          mediaType = "image";
          mediaUrl = mediaUrl || msg.imageMessage.url || "";
          mediaMimetype = mediaMimetype || msg.imageMessage.mimetype || "";
          mediaFilename = mediaFilename || msg.imageMessage.fileName || "";
          content = msg.imageMessage.caption || "";
        } else if (msg.videoMessage) {
          mediaType = "video";
          mediaUrl = mediaUrl || msg.videoMessage.url || "";
          mediaMimetype = mediaMimetype || msg.videoMessage.mimetype || "";
          mediaFilename = mediaFilename || msg.videoMessage.fileName || "";
          content = msg.videoMessage.caption || "";
        } else if (msg.audioMessage) {
          mediaType = "audio";
          mediaUrl = mediaUrl || msg.audioMessage.url || "";
          mediaMimetype = mediaMimetype || msg.audioMessage.mimetype || "";
          audioDurationSec = msg.audioMessage.seconds || null;
          content = "";
        } else if (msg.documentMessage) {
          mediaType = "document";
          mediaUrl = mediaUrl || msg.documentMessage.url || "";
          mediaMimetype = mediaMimetype || msg.documentMessage.mimetype || "";
          mediaFilename = mediaFilename || msg.documentMessage.fileName || "";
          content = msg.documentMessage.caption || "";
        } else if (msg.stickerMessage) {
          mediaType = "sticker";
          mediaUrl = mediaUrl || msg.stickerMessage.url || "";
          mediaMimetype = mediaMimetype || msg.stickerMessage.mimetype || "";
          content = "";
        } else if (typeof msg.content === "object" && msg.content !== null) {
          // UAZAPI format: content is an object with imageMessage, audioMessage, etc.
          const contentObj = msg.content as Record<string, unknown>;
          
          if (contentObj.imageMessage && typeof contentObj.imageMessage === "object") {
            const imgMsg = contentObj.imageMessage as Record<string, unknown>;
            mediaType = "image";
            mediaUrl = mediaUrl || String(imgMsg.url || "");
            mediaMimetype = mediaMimetype || String(imgMsg.mimetype || "");
            mediaFilename = mediaFilename || String(imgMsg.fileName || "");
            content = String(imgMsg.caption || "");
          } else if (contentObj.videoMessage && typeof contentObj.videoMessage === "object") {
            const vidMsg = contentObj.videoMessage as Record<string, unknown>;
            mediaType = "video";
            mediaUrl = mediaUrl || String(vidMsg.url || "");
            mediaMimetype = mediaMimetype || String(vidMsg.mimetype || "");
            mediaFilename = mediaFilename || String(vidMsg.fileName || "");
            content = String(vidMsg.caption || "");
          } else if (contentObj.audioMessage && typeof contentObj.audioMessage === "object") {
            const audMsg = contentObj.audioMessage as Record<string, unknown>;
            mediaType = "audio";
            mediaUrl = mediaUrl || String(audMsg.url || "");
            mediaMimetype = mediaMimetype || String(audMsg.mimetype || "");
            audioDurationSec = Number(audMsg.seconds) || null;
            content = "";
          } else if (contentObj.documentMessage && typeof contentObj.documentMessage === "object") {
            const docMsg = contentObj.documentMessage as Record<string, unknown>;
            mediaType = "document";
            mediaUrl = mediaUrl || String(docMsg.url || "");
            mediaMimetype = mediaMimetype || String(docMsg.mimetype || "");
            mediaFilename = mediaFilename || String(docMsg.fileName || "");
            content = String(docMsg.caption || "");
          } else if (contentObj.stickerMessage && typeof contentObj.stickerMessage === "object") {
            const stickerMsg = contentObj.stickerMessage as Record<string, unknown>;
            mediaType = "sticker";
            mediaUrl = mediaUrl || String(stickerMsg.url || "");
            mediaMimetype = mediaMimetype || String(stickerMsg.mimetype || "");
            content = "";
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
        
        // Media content: don't add labels, just use caption if available
        // The UI will show emojis for media types in previews
        
        console.log(`Media info - type: ${mediaType}, url: ${mediaUrl?.substring(0, 50)}..., mimetype: ${mediaMimetype}`);
        
        // ============================================
        // LAZY MEDIA: Save metadata only, download on-demand
        // This is scalable for 100+ accounts because:
        // 1. Webhook returns fast (no download/decrypt/upload)
        // 2. Media is downloaded only when user opens conversation
        // 3. Processing distributed across user requests
        // ============================================
        const mediaKey = contentObj?.mediaKey ? String(contentObj.mediaKey) : null;
        
        // Check if this is a VALID WhatsApp media URL (mmg.whatsapp.net for actual media)
        // Some messages come with invalid URLs like "https://web.whatsapp.net" for stickers
        const isValidWhatsAppMediaUrl = mediaUrl && mediaType && mediaUrl.includes("mmg.whatsapp.net");
        const isInvalidMediaUrl = mediaUrl && mediaType && !mediaUrl.includes("mmg.whatsapp.net") && mediaUrl.includes("whatsapp.net");
        
        // For valid WhatsApp media, we save encrypted URL + key for lazy download
        // For invalid URLs (like web.whatsapp.net), mark as failed immediately
        // For already-permanent URLs (non-whatsapp.net), we use them directly
        const permanentMediaUrl = (!mediaUrl || isValidWhatsAppMediaUrl || isInvalidMediaUrl) ? null : mediaUrl;
        const encryptedMediaUrl = isValidWhatsAppMediaUrl ? mediaUrl : null;
        
        // Determine initial media download status
        let initialMediaDownloadStatus: string | null = null;
        if (isValidWhatsAppMediaUrl) {
          initialMediaDownloadStatus = "pending";
          console.log(`Saving media metadata for lazy download (mediaKey: ${mediaKey ? 'yes' : 'no'})`);
        } else if (isInvalidMediaUrl) {
          initialMediaDownloadStatus = "failed";
          console.log(`Invalid media URL (${mediaUrl?.substring(0, 50)}...), marking as failed`);
        }
        
        const messageId = msg.id || `${Date.now()}`;
        const timestamp = msg.timestamp 
          ? new Date(Number(msg.timestamp) * 1000).toISOString()
          : new Date().toISOString();

        // ============================================
        // EDITED MESSAGE DETECTION
        // UAZAPI sends 'edited' flag when message was edited
        // This is CRITICAL to prevent duplication when user edits a message
        // ============================================
        const msgAnyEdit = msg as Record<string, unknown>;
        const isEditedMessage = msgAnyEdit.edited === true || 
                                msgAnyEdit.messageType === "editedMessage" ||
                                msgAnyEdit.messageType === "EditedMessage" ||
                                (typeof msgAnyEdit.type === "string" && msgAnyEdit.type.toLowerCase().includes("edited"));
        
        if (isEditedMessage) {
          console.log(`[EDIT] Detected edited message webhook, will check for existing record to update`);
        }

        // ============================================
        // EXTRACT QUOTED MESSAGE DATA (for replies)
        // ============================================
        const msgAnyQuote = msg as Record<string, unknown>;
        
        // UAZAPI sends quoted message data in multiple formats:
        // 1. msg.quoted - Object with body/text/caption + sender info (UAZAPI primary format)
        // 2. msg.contextInfo - Standard WhatsApp format
        // 3. msg.extendedTextMessage?.contextInfo
        // 4. msg.quotedMsg - Alternative format
        const contextInfo = msg.contextInfo || msg.extendedTextMessage?.contextInfo || (msgAnyQuote.contextInfo as Record<string, unknown>);
        
        // CRITICAL FIX: UAZAPI uses 'quoted' field for quoted messages
        const uazapiQuoted = msgAnyQuote.quoted as Record<string, unknown>;
        const quotedMsg = uazapiQuoted || 
                          (msgAnyQuote.quotedMsg as Record<string, unknown>) || 
                          (contextInfo?.quotedMessage as Record<string, unknown>);
        
        // Extract quoted message ID from multiple sources
        const quotedMsgId = msg.quotedMessageId || 
                            (uazapiQuoted?.id as string) ||
                            (uazapiQuoted?.messageid as string) ||
                            (contextInfo?.stanzaId as string) || 
                            null;
        
        // Extract quoted content from various formats (UAZAPI sends in different ways)
        let quotedContent: string | null = null;
        if (quotedMsg) {
          // UAZAPI format: quoted.body, quoted.text, quoted.caption
          quotedContent = 
            (quotedMsg.body as string) ||  // UAZAPI primary field
            (quotedMsg.text as string) ||  // Alternative text field
            (quotedMsg.caption as string) ||  // For media with captions
            (quotedMsg.conversation as string) ||  // Standard WhatsApp
            ((quotedMsg.extendedTextMessage as Record<string, unknown>)?.text as string) ||
            ((quotedMsg.imageMessage as Record<string, unknown>)?.caption as string) ||
            ((quotedMsg.videoMessage as Record<string, unknown>)?.caption as string) ||
            ((quotedMsg.documentMessage as Record<string, unknown>)?.caption as string) ||
            null;
          
          // If still no content and it's media, show placeholder
          if (!quotedContent) {
            // Check UAZAPI format (quoted.type or quoted.mediaType)
            const quotedType = (quotedMsg.type as string) || (quotedMsg.mediaType as string) || "";
            
            if (quotedType.toLowerCase().includes("image") || quotedMsg.imageMessage) {
              quotedContent = "📷 Imagem";
            } else if (quotedType.toLowerCase().includes("video") || quotedMsg.videoMessage) {
              quotedContent = "🎬 Vídeo";
            } else if (quotedType.toLowerCase().includes("audio") || quotedType.toLowerCase().includes("ptt") || quotedMsg.audioMessage) {
              quotedContent = "🎤 Áudio";
            } else if (quotedType.toLowerCase().includes("document") || quotedMsg.documentMessage) {
              quotedContent = "📄 Documento";
            } else if (quotedType.toLowerCase().includes("sticker") || quotedMsg.stickerMessage) {
              quotedContent = "🎨 Figurinha";
            }
          }
        }
        
        // Extract quoted sender name
        // UAZAPI format: quoted.sender, quoted.senderName, quoted.sender_pn
        const quotedParticipant = (uazapiQuoted?.sender as string) ||
                                  (uazapiQuoted?.sender_pn as string) ||
                                  (contextInfo?.participant as string);
                                  
        let quotedSenderName: string | null = null;
        
        // First try senderName from UAZAPI (the actual display name)
        if (uazapiQuoted?.senderName && typeof uazapiQuoted.senderName === "string") {
          quotedSenderName = uazapiQuoted.senderName;
        } else if (quotedParticipant) {
          // Fallback: extract from phone/JID
          quotedSenderName = quotedParticipant.split("@")[0];
          if (quotedSenderName && /^\d+$/.test(quotedSenderName)) {
            quotedSenderName = `+${quotedSenderName}`;
          }
        }
        
        // For outbound quoted messages, show "Você" instead of phone
        if (uazapiQuoted?.fromMe === true) {
          quotedSenderName = "Você";
        }
        
        if (quotedMsgId || quotedContent) {
          console.log(`Quoted message detected - ID: ${quotedMsgId}, content: ${quotedContent?.substring(0, 50)}..., sender: ${quotedSenderName}`);
        }

        console.log(`Extracted - phone: ${phone}, content: ${content.substring(0, 50)}...`);

        // For outbound messages in groups, we don't need a phone, just the group identifier
        // For direct outbound messages, we need phone
        // For inbound messages, we always need phone and (content OR media)
        const hasContent = content && content.trim().length > 0;
        const hasMedia = mediaType && (mediaUrl || encryptedMediaUrl);

        if (direction === "inbound" && !phone) {
          console.error(`[WEBHOOK] CRITICAL: Inbound message BLOCKED - missing phone`);
          console.error(`[WEBHOOK] Full payload snippet:`, JSON.stringify({
            chatPhone: chat.phone,
            chatId: chat.id,
            waChatid: chat.wa_chatid,
            chatJid: chat.jid,
            sender: msg.sender,
            senderPn: msg.sender_pn,
            msgChatid: msg.chatid,
            msgId: msg.id,
            msgType: msg.type,
            instanceName
          }));
          return new Response(JSON.stringify({ ignored: true, reason: "missing_phone", msgId: msg.id }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        if (direction === "inbound" && !hasContent && !hasMedia) {
          console.warn(`[WEBHOOK] BLOCKED: Inbound message without content/media. msgId: ${msg.id}, phone: ${phone}, content: "${content?.substring(0, 50) || ''}", mediaType: ${mediaType}, mediaUrl: ${mediaUrl?.substring(0, 50) || 'N/A'}, msgType: ${msg.type}`);
          return new Response(JSON.stringify({ ignored: true, reason: "missing_content_and_media", msgId: msg.id, phone }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }
        
        if (direction === "outbound" && !hasContent && !hasMedia) {
          console.log(`Skipping outbound message: no content and no media`);
          return new Response(JSON.stringify({ ignored: true, reason: "missing_content_and_media" }), { 
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
          // For groups, search by group_jid + integration_id for multi-instance isolation
          let groupQuery = supabase
            .from("zapp_conversations")
            .select("id, unread_count, integration_id, contact_name, client_id, lead_id")
            .eq("account_id", accountId)
            .eq("group_jid", groupJid);
          
          // CRITICAL: Filter by integration_id for multi-instance isolation within same sector
          if (integrationId) {
            groupQuery = groupQuery.eq("integration_id", integrationId);
          } else if (sectorId) {
            // Fallback to sector_id if no integration_id (legacy support)
            groupQuery = groupQuery.eq("sector_id", sectorId);
          }
          
          const { data } = await groupQuery.maybeSingle();
          existingZappConvo = data;
        } else {
          // For direct messages, search by phone_e164 + integration_id for multi-instance isolation
          // CRITICAL: This ensures same phone number creates separate conversations per instance
          let directQuery = supabase
            .from("zapp_conversations")
            .select("id, unread_count, integration_id, contact_name, client_id, lead_id, phone_e164")
            .eq("account_id", accountId)
            .eq("phone_e164", phone)
            .eq("is_group", false);
          
          // CRITICAL: Filter by integration_id for multi-instance isolation within same sector
          if (integrationId) {
            directQuery = directQuery.eq("integration_id", integrationId);
          } else if (sectorId) {
            // Fallback to sector_id if no integration_id (legacy support)
            directQuery = directQuery.eq("sector_id", sectorId);
          }
          
          const { data } = await directQuery.maybeSingle();
          existingZappConvo = data;
          
          // ============================================
          // PHONE NORMALIZATION FALLBACK (SAME INSTANCE ONLY)
          // ============================================
          // Only try alternate phone format for BR numbers WITHIN THE SAME INSTANCE
          // This preserves instance isolation while handling phone format variations
          
          if (!existingZappConvo && phone && phone.startsWith("+55") && phone.length === 14 && integrationId) {
            const phoneWithout9 = phone.substring(0, 5) + phone.substring(6);
            console.log(`[PHONE] Fallback: trying ${phoneWithout9} (removed 9th digit) for SAME integration ${integrationId}`);
            
            // Search WITH integration_id filter to maintain isolation
            const { data: fallbackData } = await supabase
              .from("zapp_conversations")
              .select("id, unread_count, integration_id, contact_name, client_id, lead_id, phone_e164, sector_id")
              .eq("account_id", accountId)
              .eq("phone_e164", phoneWithout9)
              .eq("integration_id", integrationId)
              .eq("is_group", false)
              .maybeSingle();
            
            if (fallbackData) {
              existingZappConvo = fallbackData;
              console.log(`[PHONE] Found via fallback: old format ${phoneWithout9} in same instance, updating to ${phone}`);
              
              // Only update phone to normalized format (DO NOT change integration_id or sector_id)
              await supabase
                .from("zapp_conversations")
                .update({ phone_e164: phone })
                .eq("id", fallbackData.id);
              
              // Try to link client if not already linked
              if (!fallbackData.client_id) {
                const { data: clientMatch } = await supabase
                  .from("clients")
                  .select("id")
                  .eq("account_id", accountId)
                  .or(`phone_e164.eq.${phone},phone_e164.eq.${phoneWithout9}`)
                  .limit(1)
                  .maybeSingle();
                
                if (clientMatch) {
                  await supabase
                    .from("zapp_conversations")
                    .update({ client_id: clientMatch.id })
                    .eq("id", fallbackData.id);
                  console.log(`[PHONE] Auto-linked client ${clientMatch.id} to conversation ${fallbackData.id}`);
                }
              }
            }
          }
          
          // NOTE: LAYER 2 AUTO-UNIFY was REMOVED intentionally
          // Each WhatsApp instance MUST have its own separate conversation with each contact
          // Cross-integration search and unification was causing conversations to "leak" between sectors
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
          
          // Only update unread_count and avatar for inbound messages
          if (direction === "inbound") {
            updateData.unread_count = (existingZappConvo.unread_count || 0) + 1;
            
            // IMPORTANT: Do NOT update contact_name for existing conversations
            // This prevents name changes from the WhatsApp "push name" overwriting
            // manually set or linked client/lead names.
            // 
            // For groups: NEVER update the group name from incoming messages
            // as it could pick up sender names instead of group names.
            // 
            // For direct messages: Only update if current name is empty/unknown
            // AND the conversation is not linked to a client/lead.
            if (!isGroupMessage) {
              const currentName = existingZappConvo.contact_name;
              const hasClientOrLead = existingZappConvo.client_id || existingZappConvo.lead_id;
              
              // Only update name if: not linked AND (empty OR "Desconhecido")
              const shouldUpdateName = !hasClientOrLead && 
                (!currentName || currentName.trim() === "" || currentName === "Desconhecido");
              
              if (shouldUpdateName && contactName && contactName !== "Desconhecido") {
                updateData.contact_name = contactName;
                console.log(`[WEBHOOK] Updating empty contact_name to: ${contactName}`);
              }
            }
            // Note: For groups, we intentionally do NOT update contact_name
            // to prevent the sender's name from overwriting the group name
            
            // Update avatar from WhatsApp profile picture if available
            // (avatar updates are still allowed as they don't cause confusion)
            const profilePicUrl = chat.image || chat.imagePreview;
            if (profilePicUrl) {
              updateData.avatar_url = profilePicUrl;
            }
          }
          
          // CRITICAL: Update integration_id if missing (migration for existing conversations)
          if (integrationId && !existingZappConvo.integration_id) {
            updateData.integration_id = integrationId;
            console.log(`Updating conversation ${zappConversationId} with integration_id: ${integrationId}`);
          }
          
          await supabase
            .from("zapp_conversations")
            .update(updateData)
            .eq("id", zappConversationId);
          
          markLatency("conversation_updated");
        } else {
        // Find client if exists (to link) - only for direct messages
          // Search by primary phone OR additional_phones
          // Also search with phone variant (with/without 9th digit) for Brazilian numbers
          let clientId = null;
          if (!isGroupMessage && phone) {
            // Build the OR condition with phone variants for Brazilian numbers
            let orCondition = `phone_e164.eq.${phone},additional_phones.cs.["${phone}"]`;
            
            // Add Brazilian phone variant (12 vs 13 digits)
            if (phone.startsWith("+55") && phone.length === 14) {
              // phone is 13 digits, also search for 12-digit version
              const phoneWithout9 = phone.substring(0, 5) + phone.substring(6);
              orCondition += `,phone_e164.eq.${phoneWithout9},additional_phones.cs.["${phoneWithout9}"]`;
            }
            
            const { data: existingClient } = await supabase
              .from("clients")
              .select("id, phone_e164")
              .eq("account_id", accountId)
              .or(orCondition)
              .maybeSingle();
            
            if (existingClient) {
              clientId = existingClient.id;
              
              // Update client's phone to normalized format if it was in old format
              if (existingClient.phone_e164 && existingClient.phone_e164.length === 13 && phone.length === 14) {
                console.log(`[PHONE] Updating client ${clientId} phone from ${existingClient.phone_e164} to ${phone}`);
                await supabase
                  .from("clients")
                  .update({ phone_e164: phone })
                  .eq("id", clientId);
              }
            }
          }
          
          const profilePicUrl = chat.image || chat.imagePreview;
          
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
              // CRITICAL: Set sector_id for multi-sector isolation
              sector_id: sectorId || null,
              // CRITICAL: Set integration_id for multi-instance isolation within same sector
              integration_id: integrationId || null,
              last_message_at: timestamp,
              last_message_preview: direction === "outbound"
                ? `Você: ${content.substring(0, 80)}`
                : (isGroupMessage 
                    ? `${contactName}: ${content.substring(0, 80)}`
                    : content.substring(0, 100)),
              unread_count: direction === "inbound" ? 1 : 0,
              avatar_url: profilePicUrl || null,
            })
            .select("id")
            .single();

          if (newZappConvo) {
            zappConversationId = newZappConvo.id;
            console.log(`Created new zapp_conversation (group: ${isGroupMessage}): ${zappConversationId}`);
            
            // ============================================
            // AUTO-SUGGEST CLIENT LINKS (for direct messages without client)
            // ============================================
            if (!clientId && !isGroupMessage && contactName && contactName !== "Desconhecido") {
              try {
                console.log(`[SUGGESTION] Searching for client suggestions for "${contactName}" / ${phone}`);
                
                const suggestions: { clientId: string; matchType: string; score: number; details: Record<string, unknown> }[] = [];
                
                // Split contact name into parts for searching
                const nameParts = contactName
                  .split(/[\s\-\/\(\)]+/)
                  .filter((p: string) => p.length > 2)
                  .slice(0, 3); // Max 3 parts
                
                // Search by name parts
                for (const part of nameParts) {
                  const { data: nameMatches } = await supabase
                    .from("clients")
                    .select("id, full_name, phone_e164")
                    .eq("account_id", accountId)
                    .eq("status", "active")
                    .ilike("full_name", `%${part}%`)
                    .limit(5);
                  
                  if (nameMatches) {
                    for (const client of nameMatches) {
                      // Calculate simple match score based on name similarity
                      const clientNameLower = (client.full_name || "").toLowerCase();
                      const contactNameLower = contactName.toLowerCase();
                      const partLower = part.toLowerCase();
                      
                      // Higher score if more name parts match
                      const matchingParts = nameParts.filter((np: string) => 
                        clientNameLower.includes(np.toLowerCase())
                      ).length;
                      const score = Math.min(0.95, 0.5 + (matchingParts * 0.15));
                      
                      if (!suggestions.find(s => s.clientId === client.id)) {
                        suggestions.push({
                          clientId: client.id,
                          matchType: matchingParts > 1 ? "name" : "similar_name",
                          score,
                          details: { 
                            matchedPart: part, 
                            matchingParts,
                            contactName,
                            clientName: client.full_name 
                          },
                        });
                      }
                    }
                  }
                }
                
                // Search by partial phone (last 9 digits)
                if (phone) {
                  const phoneDigits = phone.replace(/\D/g, "");
                  const partialPhone = phoneDigits.slice(-9);
                  
                  if (partialPhone.length >= 9) {
                    const { data: phoneMatches } = await supabase
                      .from("clients")
                      .select("id, full_name, phone_e164")
                      .eq("account_id", accountId)
                      .eq("status", "active")
                      .ilike("phone_e164", `%${partialPhone}`)
                      .limit(5);
                    
                    if (phoneMatches) {
                      for (const client of phoneMatches) {
                        const existing = suggestions.find(s => s.clientId === client.id);
                        if (existing) {
                          // Boost score if phone also matches
                          existing.score = Math.min(0.98, existing.score + 0.2);
                          existing.matchType = "name";
                          (existing.details as Record<string, unknown>).phoneMatch = true;
                        } else {
                          suggestions.push({
                            clientId: client.id,
                            matchType: "partial_phone",
                            score: 0.7,
                            details: { 
                              partialPhone,
                              contactName,
                              clientName: client.full_name 
                            },
                          });
                        }
                      }
                    }
                  }
                }
                
                // Save top 3 suggestions
                const topSuggestions = suggestions
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 3);
                
                if (topSuggestions.length > 0) {
                  console.log(`[SUGGESTION] Found ${topSuggestions.length} suggestions for conversation ${zappConversationId}`);
                  
                  for (const suggestion of topSuggestions) {
                    await supabase.from("zapp_client_suggestions").insert({
                      account_id: accountId,
                      zapp_conversation_id: zappConversationId,
                      suggested_client_id: suggestion.clientId,
                      match_type: suggestion.matchType,
                      match_score: suggestion.score,
                      match_details: suggestion.details,
                    }).maybeSingle(); // Ignore conflicts
                  }
                } else {
                  console.log(`[SUGGESTION] No client suggestions found for "${contactName}"`);
                }
              } catch (suggestionError) {
                // Don't fail the webhook for suggestion errors
                console.error("[SUGGESTION] Error creating suggestions:", suggestionError);
              }
            }
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

          // CRITICAL FIX: Flag to skip insert when message already exists
          let skipInsert = false;
          
          if (existingMsg) {
            console.log(`Message already exists with external_message_id ${messageId}, checking if deleted`);
            
            // Check if the message is deleted - don't update if so
            const { data: msgDetails } = await supabase
              .from("zapp_messages")
              .select("is_deleted, is_edited")
              .eq("id", existingMsg.id)
              .maybeSingle();
            
            if (msgDetails?.is_deleted) {
              console.log(`Message ${messageId} is deleted, ignoring webhook update`);
              return new Response(
                JSON.stringify({ ignored: true, reason: "message_deleted" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            
            // CRITICAL FIX: If message exists and is NOT deleted, skip insert
            // This prevents duplication when UAZAPI sends confirmation webhooks for edited messages
            console.log(`[DEDUPE] Message ${messageId} already exists (is_edited: ${msgDetails?.is_edited}), skipping insert`);
            skipInsert = true;
          }
          
          // ============================================
          // EDITED MESSAGE DEDUPLICATION
          // When UAZAPI sends confirmation of an edited message, it comes with a NEW external_message_id
          // The original message was already updated in the DB by the frontend with is_edited=true
          // We need to find that original message and skip inserting a duplicate
          // ============================================
          if (!skipInsert && isEditedMessage && direction === "outbound") {
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
            
            // Strategy 1: Find message with same content that was recently marked as edited
            const { data: editedOriginal } = await supabase
              .from("zapp_messages")
              .select("id, content, external_message_id")
              .eq("zapp_conversation_id", zappConversationId)
              .eq("direction", "outbound")
              .eq("content", content)
              .eq("is_edited", true)
              .gte("created_at", fifteenMinutesAgo)
              .order("updated_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (editedOriginal) {
              console.log(`[EDIT] Found original edited message ${editedOriginal.id}, skipping duplicate insert`);
              
              // Update the external_message_id to the new one from UAZAPI
              if (editedOriginal.external_message_id !== messageId) {
                await supabase
                  .from("zapp_messages")
                  .update({ 
                    external_message_id: messageId,
                    updated_at: new Date().toISOString()
                  })
                  .eq("id", editedOriginal.id);
                console.log(`[EDIT] Updated external_message_id from ${editedOriginal.external_message_id} to ${messageId}`);
              }
              
              skipInsert = true;
            } else {
              console.log(`[EDIT] No matching edited message found for content, will proceed with insert check`);
            }
          }
          
          // ============================================
          // FALLBACK: Content-based deduplication for recent outbound messages
          // This catches cases where edited message wasn't detected by the above check
          // ============================================
          if (!skipInsert && direction === "outbound" && !isEditedMessage) {
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
            
            const { data: recentSameContent } = await supabase
              .from("zapp_messages")
              .select("id, external_message_id, is_edited")
              .eq("zapp_conversation_id", zappConversationId)
              .eq("direction", "outbound")
              .eq("content", content)
              .gte("created_at", twoMinutesAgo)
              .neq("external_message_id", messageId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (recentSameContent) {
              console.log(`[DEDUPE] Found recent message with same content: ${recentSameContent.id}, ` +
                          `is_edited: ${recentSameContent.is_edited}, skipping insert`);
              skipInsert = true;
            }
          }
          
          if (!skipInsert) {
            // For outbound messages, check for recent duplicates without external_message_id
            // This handles messages sent from the UI that are then echoed back by the webhook
            // CRITICAL FIX: Use 5-minute window (increased from 2) to handle race conditions
            let isDuplicate = false;
            if (direction === "outbound") {
              const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
              
              // For audio messages, search by message_type (content differs between frontend/webhook)
              let recentDupe = null;
              
              if (mediaType === "audio") {
                // Search for audio messages without external_message_id (frontend-inserted, awaiting webhook)
                const { data } = await supabase
                  .from("zapp_messages")
                  .select("id, media_url")
                  .eq("zapp_conversation_id", zappConversationId)
                  .eq("direction", "outbound")
                  .eq("message_type", "audio")
                  .is("external_message_id", null)
                  .gte("created_at", fiveMinutesAgo)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                recentDupe = data;
                
                if (recentDupe) {
                  console.log(`[DEDUPE] Found pending audio message ${recentDupe.id} to update with external_message_id ${messageId}`);
                }
              } else if (mediaType === "document") {
                // DOCUMENT DEDUPLICATION: Search by message_type since content/filename differs between frontend and webhook
                // Frontend saves filename in content, webhook receives empty caption with different filename (WhatsApp code)
                const { data } = await supabase
                  .from("zapp_messages")
                  .select("id, media_url, media_filename")
                  .eq("zapp_conversation_id", zappConversationId)
                  .eq("direction", "outbound")
                  .eq("message_type", "document")
                  .is("external_message_id", null)
                  .gte("created_at", fiveMinutesAgo)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                recentDupe = data;
                
                if (recentDupe) {
                  console.log(`[DEDUPE] Found pending document message ${recentDupe.id} (filename: ${recentDupe.media_filename}) to update with external_message_id ${messageId}`);
                }
              } else {
                // For text and image messages, use content-based matching
                const { data } = await supabase
                  .from("zapp_messages")
                  .select("id")
                  .eq("zapp_conversation_id", zappConversationId)
                  .eq("direction", "outbound")
                  .eq("content", content)
                  .is("external_message_id", null)
                  .gte("created_at", fiveMinutesAgo)
                  .limit(1)
                  .maybeSingle();
                recentDupe = data;
              }

              if (recentDupe) {
                // Update the existing message with the external_message_id and audio duration
                const updateData: Record<string, unknown> = { external_message_id: messageId };
                if (mediaType === "audio") {
                  if (audioDurationSec) {
                    updateData.audio_duration_sec = audioDurationSec;
                  }
                  // Also update media_url if webhook has a permanent URL
                  if (permanentMediaUrl) {
                    updateData.media_url = permanentMediaUrl;
                  }
                }
                await supabase
                  .from("zapp_messages")
                  .update(updateData)
                  .eq("id", recentDupe.id);
                console.log(`[DEDUPE] Updated existing ${mediaType || 'text'} message ${recentDupe.id} with external_message_id ${messageId}`);
                isDuplicate = true;
              } else if (mediaType === "audio") {
                console.log(`[DEDUPE] No pending audio message found for conversation ${zappConversationId} in last 5 minutes`);
              }
            }

            // CRITICAL FIX: Also check skipInsert flag to prevent duplication from edit webhooks
            if (!isDuplicate && !skipInsert) {
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
                  // Media fields - permanent URL if available, otherwise save encrypted for lazy download
                  media_url: permanentMediaUrl || null,
                  media_type: mediaType || null,
                  media_mimetype: mediaMimetype || null,
                  media_filename: mediaFilename || null,
                  audio_duration_sec: audioDurationSec,
                  // Lazy download fields - for WhatsApp media that needs processing
                  media_encrypted_url: encryptedMediaUrl || (isInvalidMediaUrl ? mediaUrl : null),
                  media_key: mediaKey || null,
                  media_download_status: initialMediaDownloadStatus,
                  // Quoted message (reply) fields
                  quoted_message_id: quotedMsgId || null,
                  quoted_content: quotedContent || null,
                  quoted_sender_name: quotedSenderName || null,
                });

              if (zappMsgError) {
                console.error("Error saving zapp_message:", zappMsgError);
              } else {
                markLatency("message_saved");
                console.log(`Zapp message saved! Media: ${mediaType || 'none'}, LazyDownload: ${encryptedMediaUrl ? 'pending' : 'no'}`);
              }
            }
          }

          // Create or update zapp_conversation_assignment for the queue
          // CRITICAL: Prioritize assignment with department_id to avoid duplicates
          const { data: existingAssignments } = await supabase
            .from("zapp_conversation_assignments")
            .select("id, status, agent_id, department_id, assigned_at")
            .eq("account_id", accountId)
            .eq("zapp_conversation_id", zappConversationId)
            .order("department_id", { nullsFirst: false }) // Prioritize with department
            .limit(5);
          
          // Find the best assignment: prefer one with department_id
          const existingAssignment = existingAssignments?.find(a => a.department_id !== null) 
            || existingAssignments?.[0] 
            || null;

          if (existingAssignment) {
            // Update existing assignment - also set department if not set
            // CRITICAL: Update status based on message direction
            let newStatus = existingAssignment.status;
            
            if (existingAssignment.status === "closed") {
              // Reopen closed conversations only for inbound messages
              newStatus = direction === "inbound" ? "triage" : "closed";
            } else if (direction === "outbound" && existingAssignment.status !== "closed") {
              // Outbound message: we're waiting for client response
              newStatus = "waiting";
            } else if (direction === "inbound") {
              // Inbound message: only go to "active" if officially assigned (has assigned_at)
              // Otherwise, conversation should go to queue (pending)
              const wasOfficiallyAssigned = existingAssignment.agent_id && existingAssignment.assigned_at;
              newStatus = wasOfficiallyAssigned ? "active" : "pending";
            }
            
          // BLINDAGEM DE SETOR: Log security alert if trying to change department
          if (sectorDepartmentId && existingAssignment.department_id && 
              sectorDepartmentId !== existingAssignment.department_id) {
            console.warn(`[SECURITY] Blocked department change attempt: ${existingAssignment.department_id} -> ${sectorDepartmentId} for assignment ${existingAssignment.id}`);
          }
          
          await supabase
              .from("zapp_conversation_assignments")
              .update({
                updated_at: timestamp,
                status: newStatus,
                // BLINDAGEM: Só define department_id se o assignment NÃO tiver um
                // NUNCA sobrescrever um department_id existente para evitar migração entre setores
                ...(sectorDepartmentId && !existingAssignment.department_id ? { department_id: sectorDepartmentId } : {}),
              })
              .eq("id", existingAssignment.id);
            markLatency("assignment_updated");
            console.log(`Updated zapp assignment - direction: ${direction}, newStatus: ${newStatus}`);
          } else {
            const { error: assignmentError } = await supabase
              .from("zapp_conversation_assignments")
              .insert({
                account_id: accountId,
                zapp_conversation_id: zappConversationId,
                status: "triage", // New conversations start in triage
                department_id: sectorDepartmentId, // Associate with sector's department
              });

            if (assignmentError) {
              console.error("Error creating zapp assignment:", assignmentError);
            } else {
              console.log(`Created new zapp assignment in queue (department: ${sectorDepartmentId})`);
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
            .select("id, avatar_url")
            .eq("account_id", accountId)
            .eq("phone_e164", phone)
            .maybeSingle();

          if (existingClient) {
            const clientId = existingClient.id;
            console.log(`Found existing client: ${clientId} - saving to message_events for AI analysis`);
            
            // Auto-update client avatar from WhatsApp profile picture if available
            const profilePicUrl = chat.image || chat.imagePreview;
            if (profilePicUrl && !existingClient.avatar_url) {
              const { error: avatarError } = await supabase
                .from("clients")
                .update({ avatar_url: profilePicUrl })
                .eq("id", clientId);
              
              if (avatarError) {
                console.log("Error updating client avatar:", avatarError.message);
              } else {
                console.log(`Updated client ${clientId} avatar from WhatsApp profile picture`);
              }
            }

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

            // Queue AI analysis for text messages (async processing for scalability)
            if (content.length > 10 && !content.startsWith("[")) {
              try {
                // Get the message ID we just inserted
                const { data: insertedMsg } = await supabase
                  .from("zapp_messages")
                  .select("id")
                  .eq("zapp_conversation_id", zappConversationId)
                  .eq("external_message_id", messageId)
                  .maybeSingle();

                if (insertedMsg) {
                  // Insert job into queue instead of calling analyze-message directly
                  const { error: queueError } = await supabase
                    .from("ai_analysis_queue")
                    .insert({
                      account_id: accountId,
                      message_id: insertedMsg.id,
                      client_id: clientId,
                      status: "pending",
                      priority: 0, // Normal priority
                    });

                  if (queueError) {
                    console.log("Queue insert error (non-blocking):", queueError.message);
                  } else {
                    console.log("AI analysis queued for message:", insertedMsg.id);
                    // Trigger background queue processing
                    EdgeRuntime.waitUntil(processAIQueue(supabaseUrl, supabaseKey));
                  }
                }
              } catch (err) {
                console.log("AI queue error (non-blocking):", err);
              }
            }
          } else {
            // Not a registered client - check if there's a lead with this phone
            const normalizedPhoneForLead = phone.replace(/^\+/, ''); // Remove leading + for phone field
            const { data: existingLead } = await supabase
              .from("leads")
              .select("id, avatar_url")
              .eq("account_id", accountId)
              .or(`phone.eq.${normalizedPhoneForLead},phone.eq.${phone}`)
              .maybeSingle();

            if (existingLead) {
              console.log(`Found existing lead: ${existingLead.id}`);
              
              // Auto-update lead avatar from WhatsApp profile picture if available
              const profilePicUrl = chat.image || chat.imagePreview;
              if (profilePicUrl && !existingLead.avatar_url) {
                const { error: avatarError } = await supabase
                  .from("leads")
                  .update({ avatar_url: profilePicUrl })
                  .eq("id", existingLead.id);
                
                if (avatarError) {
                  console.log("Error updating lead avatar:", avatarError.message);
                } else {
                  console.log(`Updated lead ${existingLead.id} avatar from WhatsApp profile picture`);
                }
              }
              
              // Also update zapp_conversation to link to lead_id
              if (zappConversationId) {
                await supabase
                  .from("zapp_conversations")
                  .update({ lead_id: existingLead.id })
                  .eq("id", zappConversationId);
              }
            } else {
              console.log(`Message from ${phone} saved to Zapp only (not a registered client or lead)`);
            }
          }
        } else if (direction === "outbound") {
          console.log(`Outbound message saved to Zapp`);
        }
        
        // Log final latency summary
        markLatency("processing_complete");
        console.log(`[LATENCY SUMMARY] Total processing: ${Date.now() - startTime}ms`);
        console.log(`[LATENCY DETAILS]`, JSON.stringify(latencyMarks));

        return new Response(
          JSON.stringify({ 
            success: true, 
            zapp_conversation_id: zappConversationId, 
            phone,
            latency_ms: Date.now() - startTime,
            latency_breakdown: latencyMarks
          }),
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
          
          // SECURITY: Filter by sector_id for complete multi-tenant isolation
          if (isGroupMsg && groupJid) {
            // For groups, search by group_jid + sector
            let groupQuery = supabase
              .from("zapp_conversations")
              .select("id, unread_count")
              .eq("account_id", accountId)
              .eq("group_jid", groupJid);
            
            if (sectorId) {
              groupQuery = groupQuery.eq("sector_id", sectorId);
            }
            
            const { data } = await groupQuery.maybeSingle();
            existingZappConvo = data;
          } else {
            // For direct messages, search by phone_e164 + sector
            let directQuery = supabase
              .from("zapp_conversations")
              .select("id, unread_count")
              .eq("account_id", accountId)
              .eq("phone_e164", phone)
              .eq("is_group", false);
            
            if (sectorId) {
              directQuery = directQuery.eq("sector_id", sectorId);
            }
            
            const { data } = await directQuery.maybeSingle();
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
            
            // SECURITY: Include sector_id for multi-tenant isolation
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
                sector_id: sectorId || null, // CRITICAL: Associate with sector for isolation
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
              .select("id, status, department_id")
              .eq("account_id", accountId)
              .eq("zapp_conversation_id", zappConversationId)
              .maybeSingle();

            if (existingAssignment) {
              // BLINDAGEM DE SETOR: Log security alert if trying to change department
              if (sectorDepartmentId && existingAssignment.department_id && 
                  sectorDepartmentId !== existingAssignment.department_id) {
                console.warn(`[SECURITY] Blocked department change attempt: ${existingAssignment.department_id} -> ${sectorDepartmentId} for assignment ${existingAssignment.id}`);
              }
              
              await supabase
                .from("zapp_conversation_assignments")
                .update({
                  updated_at: timestamp,
                  // If conversation was closed and client sends new message, reopen to triage
                  status: existingAssignment.status === "closed" ? "triage" : existingAssignment.status,
                  // BLINDAGEM: Só define department_id se o assignment NÃO tiver um
                  // NUNCA sobrescrever um department_id existente para evitar migração entre setores
                  ...(sectorDepartmentId && !existingAssignment.department_id ? { department_id: sectorDepartmentId } : {}),
                })
                .eq("id", existingAssignment.id);
            } else {
              await supabase
                .from("zapp_conversation_assignments")
                .insert({
                  account_id: accountId,
                  zapp_conversation_id: zappConversationId,
                  status: "triage", // New conversations start in triage
                  department_id: sectorDepartmentId, // Associate with sector's department
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

    // Handle message deletion events
    if (eventType === "messages.delete" || eventType === "message.revoke" || eventType === "message.deleted" || eventType === "messages.revoke") {
      console.log(`Processing message deletion event: ${eventType}`, JSON.stringify(payload).substring(0, 1000));
      
      const payloadAny = payload as any;
      const msg = payloadAny.message || payloadAny.data || payloadAny;
      
      // Helper function to mark a message as deleted with exact and partial matching
      const markMessageAsDeleted = async (msgId: string): Promise<number> => {
        if (!msgId) return 0;
        
        console.log(`[DELETE] Attempting to mark message as deleted: ${msgId}`);
        
        // Try exact match first
        const { data: exactMatch, error: exactError } = await supabase
          .from("zapp_messages")
          .update({ 
            is_deleted: true, 
            deleted_at: new Date().toISOString()
          })
          .eq("account_id", accountId)
          .eq("external_message_id", msgId)
          .select("id");
        
        if (exactError) {
          console.error(`[DELETE] Exact match error:`, exactError);
        }
        
        if (exactMatch && exactMatch.length > 0) {
          console.log(`[DELETE] Exact match found and updated: ${exactMatch.length} message(s)`);
          return exactMatch.length;
        }
        
        // Try partial match (ID ends with the value - handles phone:msgId format)
        console.log(`[DELETE] No exact match, trying partial match with %${msgId}`);
        const { data: partialMatch, error: partialError } = await supabase
          .from("zapp_messages")
          .update({ 
            is_deleted: true, 
            deleted_at: new Date().toISOString()
          })
          .eq("account_id", accountId)
          .ilike("external_message_id", `%${msgId}`)
          .select("id");
        
        if (partialError) {
          console.error(`[DELETE] Partial match error:`, partialError);
        }
        
        if (partialMatch && partialMatch.length > 0) {
          console.log(`[DELETE] Partial match found and updated: ${partialMatch.length} message(s)`);
          return partialMatch.length;
        }
        
        console.log(`[DELETE] No message found for ID: ${msgId}`);
        return 0;
      };
      
      let totalDeleted = 0;
      
      // Try to extract message ID from various formats
      // Format 1: Simple ID fields
      let deletedMessageId = msg?.id || msg?.key?.id || msg?.messageId || 
                             payloadAny?.key?.id || msg?.messageid;
      
      // Format 2: Array in data.keys (Evolution API / WASender style)
      if (!deletedMessageId && payloadAny.data?.keys) {
        const keys = payloadAny.data.keys;
        if (Array.isArray(keys) && keys.length > 0) {
          console.log(`[DELETE] Processing ${keys.length} keys from data.keys array`);
          for (const key of keys) {
            const keyId = key?.id || key;
            if (keyId && typeof keyId === 'string') {
              const count = await markMessageAsDeleted(keyId);
              totalDeleted += count;
            }
          }
          // Set flag to indicate we processed array
          deletedMessageId = "processed_array";
        }
      }
      
      // Format 3: Array in data.messages
      if (!deletedMessageId && payloadAny.data?.messages) {
        const messages = payloadAny.data.messages;
        if (Array.isArray(messages) && messages.length > 0) {
          console.log(`[DELETE] Processing ${messages.length} messages from data.messages array`);
          for (const m of messages) {
            const msgId = m?.key?.id || m?.id || m?.messageId || m?.messageid;
            if (msgId) {
              const count = await markMessageAsDeleted(msgId);
              totalDeleted += count;
            }
          }
          deletedMessageId = "processed_array";
        }
      }
      
      // Format 4: message.key.id nested structure
      if (!deletedMessageId && msg?.key) {
        deletedMessageId = msg.key.id;
      }
      
      // Format 5: Check for participant-based ID (group messages)
      if (!deletedMessageId && payloadAny.participant && payloadAny.id) {
        deletedMessageId = payloadAny.id;
      }
      
      // Process single message ID (if not already processed as array)
      if (deletedMessageId && deletedMessageId !== "processed_array") {
        const count = await markMessageAsDeleted(deletedMessageId);
        totalDeleted += count;
      }
      
      console.log(`[DELETE] Total messages marked as deleted: ${totalDeleted}`);
      
      return new Response(
        JSON.stringify({ success: true, event: eventType, deleted: true, count: totalDeleted }),
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

    // =============================================
    // Handle "chats" event - sync conversation list from WhatsApp
    // This event is sent when WhatsApp syncs its chat list
    // =============================================
    if (eventType === "chats" || eventType === "CHATS_UPDATE" || eventType === "chats.upsert") {
      // deno-lint-ignore no-explicit-any
      const payloadAny = payload as any;
      const chatsData = payloadAny.data?.chats || payloadAny.chats || payloadAny.data || [];
      const chatList = Array.isArray(chatsData) ? chatsData : [chatsData];
      
      console.log(`[WEBHOOK] Processing chats event with ${chatList.length} chats for sector ${sectorId}`);
      
      let syncedCount = 0;
      let errorCount = 0;
      
      for (const chat of chatList) {
        try {
          // Determine if it's a group or individual chat
          const chatId = chat.id || chat.jid || chat.wa_chatid || "";
          const isGroup = chat.wa_isGroup || isGroupJid(chatId);
          
          // Extract phone for individual chats
          const chatPhone = isGroup ? "" : normalizePhone(chat.phone || extractPhoneFromJid(chatId));
          const groupJid = isGroup ? chatId : null;
          const chatName = chat.name || chat.wa_name || chat.pushName || chat.notifyName || "Desconhecido";
          
          // Skip if no identifiable data
          if (!isGroup && !chatPhone) continue;
          if (isGroup && !groupJid) continue;
          
          // Check if conversation already exists
          let existingConvo;
          if (isGroup && groupJid) {
            const { data } = await supabase
              .from("zapp_conversations")
              .select("id, integration_id")
              .eq("account_id", accountId)
              .eq("group_jid", groupJid)
              .maybeSingle();
            existingConvo = data;
          } else {
            // Try normalized phone and variants
            const phoneVariants = [chatPhone];
            const digits = chatPhone.replace(/\D/g, "");
            if (digits.length === 13 && digits.startsWith("55")) {
              // Also try 12-digit variant (without 9th digit)
              phoneVariants.push(`+${digits.slice(0, 4)}${digits.slice(5)}`);
            } else if (digits.length === 12 && digits.startsWith("55")) {
              // Also try 13-digit variant (with 9th digit)
              phoneVariants.push(`+${digits.slice(0, 4)}9${digits.slice(4)}`);
            }
            
            const { data } = await supabase
              .from("zapp_conversations")
              .select("id, integration_id")
              .eq("account_id", accountId)
              .in("phone_e164", phoneVariants)
              .eq("is_group", false)
              .limit(1);
            existingConvo = data?.[0];
          }
          
          if (existingConvo) {
            // Update existing conversation - ensure integration_id is set for legacy conversations
            if (!existingConvo.integration_id && integrationId) {
              await supabase
                .from("zapp_conversations")
                .update({ 
                  integration_id: integrationId,
                  contact_name: chatName,
                })
                .eq("id", existingConvo.id);
              console.log(`[CHATS] Updated legacy conversation ${existingConvo.id} with integration_id`);
            }
          } else {
            // Create new zapp_conversation
            const { data: newConvo, error: convError } = await supabase
              .from("zapp_conversations")
              .insert({
                account_id: accountId,
                sector_id: sectorId,
                integration_id: integrationId,
                phone_e164: chatPhone || null,
                contact_name: chatName,
                is_group: isGroup,
                group_jid: groupJid,
                last_message_at: new Date().toISOString(),
              })
              .select("id")
              .single();
            
            if (convError) {
              console.error(`[CHATS] Error creating conversation:`, convError.message);
              errorCount++;
              continue;
            }
            
            // Create assignment for the conversation
            if (newConvo && sectorDepartmentId) {
              await supabase
                .from("zapp_conversation_assignments")
                .insert({
                  account_id: accountId,
                  zapp_conversation_id: newConvo.id,
                  department_id: sectorDepartmentId,
                  status: "waiting",
                });
              console.log(`[CHATS] Created new conversation ${newConvo.id} with assignment`);
            }
          }
          
          syncedCount++;
        } catch (chatError) {
          console.error(`[CHATS] Error processing chat:`, chatError);
          errorCount++;
        }
      }
      
      console.log(`[CHATS] Synced ${syncedCount} conversations, ${errorCount} errors`);
      
      return new Response(
        JSON.stringify({ success: true, event: eventType, synced: syncedCount, errors: errorCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =============================================
    // Handle "groups" event - sync groups from WhatsApp
    // This event is sent when WhatsApp syncs group information
    // =============================================
    if (eventType === "groups" || eventType === "GROUPS_UPDATE" || eventType === "groups.upsert") {
      // deno-lint-ignore no-explicit-any
      const payloadAny = payload as any;
      const groupsData = payloadAny.data?.groups || payloadAny.groups || payloadAny.data || [];
      const groupList = Array.isArray(groupsData) ? groupsData : [groupsData];
      
      console.log(`[WEBHOOK] Processing groups event with ${groupList.length} groups for sector ${sectorId}`);
      
      let syncedCount = 0;
      let errorCount = 0;
      
      for (const group of groupList) {
        try {
          const groupJid = group.JID || group.jid || group.id || group.wa_chatid || "";
          
          // Validate group JID format
          if (!groupJid || !groupJid.includes("@g.us")) {
            console.log(`[GROUPS] Skipping invalid group JID: ${groupJid}`);
            continue;
          }
          
          const groupName = group.Name || group.name || group.Subject || group.subject || group.wa_name || "Grupo";
          const participantCount = group.Participants?.length || group.participants?.length || group.size || 0;
          const groupDesc = group.Desc || group.desc || group.Description || group.description || null;
          
          // Upsert to whatsapp_groups table
          const { error: groupError } = await supabase
            .from("whatsapp_groups")
            .upsert({
              account_id: accountId,
              group_jid: groupJid,
              name: groupName,
              description: groupDesc,
              participant_count: participantCount,
            }, { onConflict: "account_id,group_jid" });
          
          if (groupError) {
            console.error(`[GROUPS] Error upserting group ${groupJid}:`, groupError.message);
            errorCount++;
            continue;
          }
          
          // Also ensure zapp_conversation exists for this group
          const { data: existingConvo } = await supabase
            .from("zapp_conversations")
            .select("id, integration_id")
            .eq("account_id", accountId)
            .eq("group_jid", groupJid)
            .maybeSingle();
          
          if (!existingConvo) {
            // Create zapp_conversation for the group
            const { data: newConvo, error: convError } = await supabase
              .from("zapp_conversations")
              .insert({
                account_id: accountId,
                sector_id: sectorId,
                integration_id: integrationId,
                contact_name: groupName,
                is_group: true,
                group_jid: groupJid,
                last_message_at: new Date().toISOString(),
              })
              .select("id")
              .single();
            
            if (convError) {
              console.error(`[GROUPS] Error creating conversation for group ${groupJid}:`, convError.message);
            } else if (newConvo && sectorDepartmentId) {
              // Create assignment
              await supabase
                .from("zapp_conversation_assignments")
                .insert({
                  account_id: accountId,
                  zapp_conversation_id: newConvo.id,
                  department_id: sectorDepartmentId,
                  status: "waiting",
                });
              console.log(`[GROUPS] Created new group conversation ${newConvo.id} for ${groupName}`);
            }
          } else if (!existingConvo.integration_id && integrationId) {
            // Update legacy group conversation with integration_id
            await supabase
              .from("zapp_conversations")
              .update({ integration_id: integrationId })
              .eq("id", existingConvo.id);
            console.log(`[GROUPS] Updated legacy group conversation ${existingConvo.id} with integration_id`);
          }
          
          syncedCount++;
        } catch (groupError) {
          console.error(`[GROUPS] Error processing group:`, groupError);
          errorCount++;
        }
      }
      
      console.log(`[GROUPS] Synced ${syncedCount} groups, ${errorCount} errors`);
      
      return new Response(
        JSON.stringify({ success: true, event: eventType, synced: syncedCount, errors: errorCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =============================================
    // Handle "history" event - sync historical messages
    // This event is sent when WhatsApp syncs message history
    // =============================================
    if (eventType === "history" || eventType === "HISTORY_SYNC" || eventType === "history.sync") {
      // deno-lint-ignore no-explicit-any
      const payloadAny = payload as any;
      const historyData = payloadAny.data || payloadAny.history || payloadAny;
      
      console.log(`[WEBHOOK] Processing history event for sector ${sectorId}`);
      console.log(`[HISTORY] Data keys:`, Object.keys(historyData || {}));
      
      // History sync can contain chats, messages, contacts
      // We mainly care about ensuring conversations exist
      const chats = historyData.chats || historyData.conversations || [];
      
      if (Array.isArray(chats) && chats.length > 0) {
        console.log(`[HISTORY] Found ${chats.length} chats to sync`);
        // Process similar to chats event but don't need full implementation
        // The main goal is to acknowledge the event
      }
      
      return new Response(
        JSON.stringify({ success: true, event: eventType, message: "History event acknowledged" }),
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
