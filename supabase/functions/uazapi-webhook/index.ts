import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================
// IN-MEMORY CACHES (persist between invocations on Deno Deploy)
// ============================================
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 200;

interface CacheEntry<T> {
  data: T;
  ts: number;
}

// Cache: instance_name / token / phone → integration record
const integrationCache = new Map<string, CacheEntry<{ id: string; account_id: string; config: unknown; sector_id: string | null }>>();

// Cache: sector_id → department_id
const departmentCache = new Map<string, CacheEntry<string | null>>();

// Cache: phone+account → client_id
const clientPhoneCache = new Map<string, CacheEntry<string | null>>();

// Cache: phone+integrationId or groupJid+integrationId → conversation record
const conversationCache = new Map<string, CacheEntry<{ id: string; unread_count: number; integration_id: string | null; contact_name: string | null; client_id: string | null; lead_id: string | null; phone_e164?: string | null } | null>>();

// Cache: conversationId → assignment record
const assignmentCache = new Map<string, CacheEntry<{ id: string; status: string; agent_id: string | null; department_id: string | null; assigned_at: string | null; closed_at: string | null } | null>>();

// Shorter TTL for conversation/assignment caches (2 min) - they change more frequently
const CONV_CACHE_TTL_MS = 2 * 60 * 1000;

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string, ttl: number = CACHE_TTL_MS): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > ttl) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  // Evict oldest entries if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { data, ts: Date.now() });
}

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: UazapiWebhookPayload = await req.json();

    // Determine event type (UAZAPI uses EventType, some versions use event)
    const eventType = payload.EventType || payload.event;

    // ============================================
    // EARLY-RETURN: Skip low-value events BEFORE creating Supabase client
    // This saves ~5 DB queries per ignored event
    // ============================================
    
    // 1. Skip "chats" events - they almost always sync 0 chats and waste resources
    if (eventType === "chats" || eventType === "CHATS_UPDATE" || eventType === "chats.upsert") {
      return new Response(JSON.stringify({ ignored: true, reason: "chats_event_skipped" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    
    // 2. Skip "history" events - they just acknowledge
    if (eventType === "history" || eventType === "HISTORY_SYNC" || eventType === "history.sync") {
      return new Response(JSON.stringify({ ignored: true, reason: "history_event_skipped" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    
    // 3. Skip reactions BEFORE any DB queries
    if (payload.message) {
      const msg = payload.message as Record<string, unknown>;
      const msgReaction = msg.reaction;
      if (msgReaction && typeof msgReaction === "object" && msgReaction !== null) {
        return new Response(JSON.stringify({ ignored: true, reason: "reaction_message" }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }
      const msgTypeCheck = msg.messageType as string;
      const typeCheck = msg.type as string;
      if ((msgTypeCheck && String(msgTypeCheck).toLowerCase().includes("reaction")) || 
          (typeCheck && String(typeCheck).toLowerCase().includes("reaction"))) {
        return new Response(JSON.stringify({ ignored: true, reason: "reaction_message" }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }
    }
    
    // 4. LIGHTWEIGHT ACK HANDLER: Process ack events with minimal overhead
    // ACK events are ~30% of all invocations (3 per message: sent→delivered→read)
    // They only need 1 UPDATE query, so we bypass the full integration identification flow
    const isAckEvent = eventType === "messages.ack" || eventType === "message.ack" || 
                       eventType === "ack" || eventType === "messages.update";
    if (isAckEvent) {
      const payloadAny = payload as Record<string, unknown>;
      let messageId = "";
      let ack = 0;
      
      // Extract message ID and ack status from various UAZAPI formats
      const dataObj = payloadAny.data as Record<string, unknown> | undefined;
      const msgObj = payloadAny.message as Record<string, unknown> | undefined;
      
      if (dataObj?.messages && Array.isArray(dataObj.messages)) {
        const msgUpdate = (dataObj.messages as Array<Record<string, unknown>>)[0];
        messageId = (msgUpdate?.key as Record<string, unknown>)?.id as string || "";
        const updateObj = msgUpdate?.update as Record<string, unknown>;
        ack = Number(updateObj?.status || msgUpdate?.ack || 0);
      } else if (dataObj?.id || msgObj?.id) {
        messageId = String(dataObj?.id || msgObj?.id || "");
        ack = Number(dataObj?.ack || payloadAny.ack || 0);
      } else if (payloadAny.ack !== undefined) {
        messageId = String(payloadAny.id || "");
        ack = Number(payloadAny.ack);
      }
      
      if (!messageId) {
        return new Response(JSON.stringify({ ignored: true, reason: "ack_no_message_id" }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }
      
      const status = ack === 4 ? "read" : ack === 3 ? "delivered" : ack === 2 ? "sent" : ack === 1 ? "pending" : "failed";
      
      // Single lightweight query - no integration lookup needed
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const ackSupabase = createClient(supabaseUrl, supabaseKey);
      
      await ackSupabase
        .from("zapp_messages")
        .update({ delivery_status: status })
        .eq("external_message_id", messageId);
      
      return new Response(JSON.stringify({ success: true, event: eventType, status }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    
    // 5. Skip unknown/unhandled event types early
    const handledEvents = [
      "messages", "messages.upsert", 
      "groups", "GROUPS_UPDATE", "groups.upsert",
      "connection", "CONNECTION_UPDATE", "connection.update",
      "QRCODE_UPDATED", "qrcode", "qrcode.updated",
      "status", "STATUS_UPDATE",
      "messages.delete", "message.revoke", "message.deleted", "messages.revoke",
    ];
    if (eventType && !handledEvents.includes(eventType)) {
      return new Response(JSON.stringify({ ignored: true, reason: "unhandled_event", event: eventType }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // ============================================
    // Past early-return: create Supabase client for actual processing
    // ============================================
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract instance from BaseUrl
    const baseUrl = payload.BaseUrl || "";
    const rawInstance = payload.instance;
    
    // Instance can be a string or an object with a 'name' property
    const instanceName = typeof rawInstance === 'string' 
      ? rawInstance 
      : (rawInstance?.name || payload.instanceName || "");

    // Find account - try different methods (with in-memory cache)
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
      
      // Check cache first
      for (const tryName of possibleNames) {
        const cached = getCached(integrationCache, `name:${tryName}`);
        if (cached) {
          integration = cached;
          break;
        }
      }
      
      // If not in cache, query DB
      if (!integration) {
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
            setCache(integrationCache, `name:${tryName}`, integration);
            break;
          }
        }
      }
    }
    
    // Method 2: Find by instance_token from payload (more reliable)
    const payloadToken = (payload as Record<string, unknown>).token as string | undefined;
    if (!integration && payloadToken) {
      const cached = getCached(integrationCache, `token:${payloadToken}`);
      if (cached) {
        integration = cached;
      } else {
        const { data: results } = await supabase
          .from("integrations")
          .select("id, account_id, config, sector_id")
          .eq("type", "whatsapp")
          .filter("config->>instance_token", "eq", payloadToken)
          .order("created_at", { ascending: true })
          .limit(1);
        
        if (results && results.length > 0) {
          integration = results[0];
          setCache(integrationCache, `token:${payloadToken}`, integration);
        }
      }
    }
    
    // Method 3: Find by phone number if available in payload
    const instanceOwner = (payload as Record<string, unknown>).instanceOwner as string | undefined;
    if (!integration && instanceOwner) {
      const phoneClean = String(instanceOwner).replace(/\D/g, "");
      const cached = getCached(integrationCache, `owner:${phoneClean}`);
      if (cached) {
        integration = cached;
      } else {
        const { data: results } = await supabase
          .from("integrations")
          .select("id, account_id, config, sector_id")
          .eq("type", "whatsapp")
          .filter("config->>phone_number", "eq", phoneClean)
          .order("created_at", { ascending: true })
          .limit(1);
        
        if (results && results.length > 0) {
          integration = results[0];
          setCache(integrationCache, `owner:${phoneClean}`, integration);
        }
      }
    }
    
    // CRITICAL SECURITY: NO FALLBACK - Reject if integration cannot be precisely identified
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
    
    

    const accountId = integration.account_id;
    const sectorId = integration.sector_id;
    const integrationId = integration.id;
    
    
    // Find the department for this sector (with cache)
    let sectorDepartmentId: string | null = null;
    if (sectorId) {
      const cachedDept = getCached(departmentCache, `${accountId}:${sectorId}`);
      if (cachedDept !== undefined) {
        sectorDepartmentId = cachedDept;
      } else {
        const { data: dept } = await supabase
          .from("zapp_departments")
          .select("id")
          .eq("account_id", accountId)
          .eq("sector_id", sectorId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        
        sectorDepartmentId = dept?.id || null;
        setCache(departmentCache, `${accountId}:${sectorId}`, sectorDepartmentId);
      }
    }

    // Handle message events (EventType: "messages" or event: "messages.upsert")
    if (eventType === "messages" || eventType === "messages.upsert") {
      // UAZAPI format: chat + message at root level
      if (payload.chat && payload.message) {
        const chat = payload.chat;
        const msg = payload.message;
        
        // Reactions already filtered by early-return above
        
        // Check if this is a group message
        const isGroupMessage = msg.isGroup || chat.wa_isGroup || (chat.wa_chatid?.includes("@g.us"));
        
        
        // Determine message direction (fromMe = sent by us)
        const direction = msg.fromMe ? "outbound" : "inbound";
        
        // ============================================
        // OUTBOUND ECHO DEDUP: Skip echoed messages already saved by frontend
        // The frontend saves outbound messages to zapp_messages BEFORE sending via uazapi-manager.
        // When UAZAPI echoes the message back, we check if it already exists by external_id.
        // This saves 4-6 DB queries (client/lead lookup, conversation upsert, assignment updates)
        // per echoed message (~50% of all message events).
        // Messages sent directly from WhatsApp (not via our app) won't have a pre-existing record,
        // so they will still be processed normally.
        // ============================================
        if (direction === "outbound" && msg.id) {
          const { data: existingOutbound } = await supabase
            .from("zapp_messages")
            .select("id")
            .eq("account_id", accountId)
            .eq("external_id", msg.id)
            .limit(1);
          
          if (existingOutbound && existingOutbound.length > 0) {
            return new Response(JSON.stringify({ ignored: true, reason: "outbound_echo_dedup", msgId: msg.id }), { 
              headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
          }
        }
        
        // For outbound messages not yet in DB (sent directly from WhatsApp), continue processing
        
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
        
        // Detect media type from message type field (UAZAPI uses 'type' or 'mediaType')
        
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
        
        // FALLBACK: Infer mediaType from mimetype or msg.type when specific message fields are absent
        if (mediaUrl && !mediaType) {
          if (mediaMimetype) {
            const mimePrefix = mediaMimetype.split("/")[0].toLowerCase();
            if (mimePrefix === "audio") mediaType = "audio";
            else if (mimePrefix === "image") mediaType = "image";
            else if (mimePrefix === "video") mediaType = "video";
            else mediaType = "document";
          } else {
            const rawType = String(msg.type || msg.messageType || msgAny.messageType || "").toLowerCase();
            if (rawType.includes("ptt") || rawType.includes("audio")) {
              mediaType = "audio";
            } else if (rawType.includes("image")) {
              mediaType = "image";
            } else if (rawType.includes("video")) {
              mediaType = "video";
            } else if (rawType.includes("sticker")) {
              mediaType = "sticker";
            } else if (rawType === "media" || mediaUrl.includes("mmg.whatsapp.net")) {
              mediaType = "document";
            }
          }
          if (mediaType) {
            console.log(`[WEBHOOK] Inferred mediaType="${mediaType}" from mimetype="${mediaMimetype}" / msgType="${msg.type}"`);
          }
        }
        
        // Media content: don't add labels, just use caption if available
        // The UI will show emojis for media types in previews
        
        
        
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
        } else if (isInvalidMediaUrl) {
          initialMediaDownloadStatus = "failed";
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
        
        // isEditedMessage flag used later for upsert logic

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
          
          return new Response(JSON.stringify({ ignored: true, reason: "missing_content_and_media" }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }
        
        // For direct outbound messages, we need the destination phone
        if (direction === "outbound" && !isGroupMessage && !phone) {
          
          return new Response(JSON.stringify({ ignored: true, reason: "missing_phone" }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        

        // ============================================
        // ZAPP: Save ALL conversations (client or not)
        // ============================================
        
        // For group messages, use group_jid as identifier
        // For direct messages, use phone_e164
        // The group identifier might be in wa_chatid (e.g., "123456789@g.us") or msg.chatid
        const groupJid = isGroupMessage ? (msg.chatid || chat.wa_chatid || chat.id) : null;
        const groupName = isGroupMessage ? (msg.groupName || chat.name || chat.wa_name) : null;
        
        
        
        // Find or create zapp_conversation (for ALL contacts)
        let zappConversationId: string | null = null;
        let linkedClientId: string | null = null; // Track client from conversation for reuse in analysis
        
        let existingZappConvo;
        
        // OPTIMIZATION: Check conversation cache first (saves 1-3 queries on cache hit)
        const convCacheKey = isGroupMessage && groupJid 
          ? `group:${groupJid}:${integrationId || sectorId}` 
          : `direct:${phone}:${integrationId || sectorId}`;
        const cachedConvo = getCached(conversationCache, convCacheKey, CONV_CACHE_TTL_MS);
        
        if (cachedConvo !== undefined) {
          existingZappConvo = cachedConvo;
        } else if (isGroupMessage && groupJid) {
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
          // Cache result (even null = no conversation found)
          setCache(conversationCache, convCacheKey, data);
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
          // Cache result
          setCache(conversationCache, convCacheKey, data);
          
          // ============================================
          // LEGACY CONVERSATION FALLBACK
          // ============================================
          // Search for legacy conversations (created before multi-instance) that have no integration_id
          // This prevents duplicate conversations when sending to contacts with existing history
          
          if (!existingZappConvo && phone && sectorId && integrationId) {
            const { data: legacyData } = await supabase
              .from("zapp_conversations")
              .select("id, unread_count, integration_id, contact_name, client_id, lead_id, phone_e164, sector_id")
              .eq("account_id", accountId)
              .eq("phone_e164", phone)
              .eq("sector_id", sectorId)
              .is("integration_id", null)
              .eq("is_group", false)
              .order("last_message_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (legacyData) {
              existingZappConvo = legacyData;
              
              
              // Migrate legacy conversation to new format with integration_id
              await supabase
                .from("zapp_conversations")
                .update({ integration_id: integrationId })
                .eq("id", legacyData.id);
            }
          }
          
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

        // NOTE: AUTO-UNIFY was REMOVED as optimization - legacy conversations are migrated in-place
        // by the fallback blocks above (setting integration_id when found)

        if (existingZappConvo) {
          zappConversationId = existingZappConvo.id;
          linkedClientId = (existingZappConvo as Record<string, unknown>).client_id as string | null;
          
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
          
          
        } else {
        // Find client if exists (to link) - only for direct messages
          // Search by primary phone OR additional_phones
          // Supports both legacy format (["phone"]) and new format ([{"number": "phone", "label": "..."}])
          // Also search with phone variant (with/without 9th digit) for Brazilian numbers
          let clientId = null;
          if (!isGroupMessage && phone) {
            // Build the OR condition with phone variants for Brazilian numbers
            // NEW FORMAT: additional_phones.cs.[{"number":"phone"}] - matches objects with number field
            // LEGACY FORMAT: additional_phones.cs.["phone"] - matches string arrays
            let orCondition = `phone_e164.eq.${phone},additional_phones.cs.["${phone}"],additional_phones.cs.[{"number":"${phone}"}]`;
            
            // Add Brazilian phone variant (12 vs 13 digits)
            if (phone.startsWith("+55") && phone.length === 14) {
              // phone is 13 digits, also search for 12-digit version
              const phoneWithout9 = phone.substring(0, 5) + phone.substring(6);
              orCondition += `,phone_e164.eq.${phoneWithout9},additional_phones.cs.["${phoneWithout9}"],additional_phones.cs.[{"number":"${phoneWithout9}"}]`;
            }
            
            const { data: existingClient } = await supabase
              .from("clients")
              .select("id, phone_e164")
              .eq("account_id", accountId)
              .or(orCondition)
              .maybeSingle();
            
            if (existingClient) {
              clientId = existingClient.id;
              linkedClientId = clientId;
              
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
            // Invalidate conversation cache for this key
            conversationCache.delete(convCacheKey);
            
            // ============================================
            // AUTO-SUGGEST CLIENT LINKS (fire-and-forget, non-blocking)
            // Runs asynchronously to avoid 3-5 queries on the critical path
            // ============================================
            if (!clientId && !isGroupMessage && contactName && contactName !== "Desconhecido") {
              const _suggestionConvoId = zappConversationId;
              const _suggestionAccountId = accountId;
              const _suggestionContactName = contactName;
              const _suggestionPhone = phone;
              const _suggestionSupabase = supabase;
              
              setTimeout(async () => {
                try {
                  const suggestions: { clientId: string; matchType: string; score: number; details: Record<string, unknown> }[] = [];
                  
                  const nameParts = _suggestionContactName
                    .split(/[\s\-\/\(\)]+/)
                    .filter((p: string) => p.length > 2)
                    .slice(0, 3);
                  
                  for (const part of nameParts) {
                    const { data: nameMatches } = await _suggestionSupabase
                      .from("clients")
                      .select("id, full_name, phone_e164")
                      .eq("account_id", _suggestionAccountId)
                      .eq("status", "active")
                      .ilike("full_name", `%${part}%`)
                      .limit(5);
                    
                    if (nameMatches) {
                      for (const client of nameMatches) {
                        const clientNameLower = (client.full_name || "").toLowerCase();
                        const matchingParts = nameParts.filter((np: string) => 
                          clientNameLower.includes(np.toLowerCase())
                        ).length;
                        const score = Math.min(0.95, 0.5 + (matchingParts * 0.15));
                        
                        if (!suggestions.find(s => s.clientId === client.id)) {
                          suggestions.push({
                            clientId: client.id,
                            matchType: matchingParts > 1 ? "name" : "similar_name",
                            score,
                            details: { matchedPart: part, matchingParts, contactName: _suggestionContactName, clientName: client.full_name },
                          });
                        }
                      }
                    }
                  }
                  
                  if (_suggestionPhone) {
                    const phoneDigits = _suggestionPhone.replace(/\D/g, "");
                    const partialPhone = phoneDigits.slice(-9);
                    
                    if (partialPhone.length >= 9) {
                      const { data: phoneMatches } = await _suggestionSupabase
                        .from("clients")
                        .select("id, full_name, phone_e164")
                        .eq("account_id", _suggestionAccountId)
                        .eq("status", "active")
                        .ilike("phone_e164", `%${partialPhone}`)
                        .limit(5);
                      
                      if (phoneMatches) {
                        for (const client of phoneMatches) {
                          const existing = suggestions.find(s => s.clientId === client.id);
                          if (existing) {
                            existing.score = Math.min(0.98, existing.score + 0.2);
                            existing.matchType = "name";
                            (existing.details as Record<string, unknown>).phoneMatch = true;
                          } else {
                            suggestions.push({
                              clientId: client.id,
                              matchType: "partial_phone",
                              score: 0.7,
                              details: { partialPhone, contactName: _suggestionContactName, clientName: client.full_name },
                            });
                          }
                        }
                      }
                    }
                  }
                  
                  const topSuggestions = suggestions.sort((a, b) => b.score - a.score).slice(0, 3);
                  
                  for (const suggestion of topSuggestions) {
                    await _suggestionSupabase.from("zapp_client_suggestions").insert({
                      account_id: _suggestionAccountId,
                      zapp_conversation_id: _suggestionConvoId,
                      suggested_client_id: suggestion.clientId,
                      match_type: suggestion.matchType,
                      match_score: suggestion.score,
                      match_details: suggestion.details,
                    }).maybeSingle();
                  }
                } catch (err) {
                  console.error("[SUGGESTION] Async error:", err);
                }
              }, 0);
            }
          } else if (zappConvoError) {
            console.error("Error creating zapp_conversation:", zappConvoError);
          }
        }

        // Save message to zapp_messages (check for duplicates first)
        // ============================================
        // CONSOLIDATED DEDUPLICATION (Optimization: 1 query instead of up to 4)
        // For outbound: single query fetches all candidate messages for dedup
        // For inbound: single query by external_message_id
        // ============================================
        if (zappConversationId) {
          let skipInsert = false;
          let isDuplicate = false;

          if (direction === "outbound") {
            // SINGLE QUERY: Fetch all recent outbound messages that could be duplicates
            // Covers: exact external_message_id match, edited message echo, content-based dedup, UI echo
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
            
            const { data: candidates } = await supabase
              .from("zapp_messages")
              .select("id, external_message_id, content, is_deleted, is_edited, message_type, media_url, media_filename")
              .eq("zapp_conversation_id", zappConversationId)
              .eq("direction", "outbound")
              .gte("created_at", fifteenMinutesAgo)
              .order("created_at", { ascending: false })
              .limit(20);
            
            const msgs = candidates || [];

            // Layer 1: Exact external_message_id match
            const exactMatch = msgs.find(m => m.external_message_id === messageId);
            if (exactMatch) {
              if (exactMatch.is_deleted) {
                console.log(`[DEDUPE] Message ${messageId} is deleted, ignoring`);
                return new Response(
                  JSON.stringify({ ignored: true, reason: "message_deleted" }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
              console.log(`[DEDUPE] Message ${messageId} already exists (is_edited: ${exactMatch.is_edited}), skipping`);
              skipInsert = true;
            }

            // Layer 2: Edited message echo (new external_message_id for edited content)
            if (!skipInsert && isEditedMessage) {
              const editedOriginal = msgs.find(m => 
                m.content === content && m.is_edited === true && m.external_message_id !== messageId
              );
              if (editedOriginal) {
                console.log(`[EDIT] Found original edited message ${editedOriginal.id}, skipping duplicate`);
                if (editedOriginal.external_message_id !== messageId) {
                  await supabase
                    .from("zapp_messages")
                    .update({ external_message_id: messageId, updated_at: new Date().toISOString() })
                    .eq("id", editedOriginal.id);
                }
                skipInsert = true;
              }
            }

            // Layer 3: Content-based dedup (same content, different external_message_id, within 2 min)
            if (!skipInsert && !isEditedMessage) {
              const contentMatch = msgs.find(m =>
                m.content === content && m.external_message_id && m.external_message_id !== messageId
              );
              if (contentMatch) {
                console.log(`[DEDUPE] Found recent message with same content: ${contentMatch.id}, skipping`);
                skipInsert = true;
              }
            }

            // Layer 4: UI echo dedup (frontend-inserted msg with null external_message_id)
            if (!skipInsert) {
              const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
              let recentDupe: typeof msgs[0] | null = null;

              if (mediaType === "audio") {
                recentDupe = msgs.find(m => 
                  m.message_type === "audio" && !m.external_message_id
                ) || null;
              } else if (mediaType === "document") {
                recentDupe = msgs.find(m => 
                  m.message_type === "document" && !m.external_message_id
                ) || null;
              } else {
                recentDupe = msgs.find(m => 
                  m.content === content && !m.external_message_id
                ) || null;
              }

              if (recentDupe) {
                const updateData: Record<string, unknown> = { external_message_id: messageId };
                if (mediaType === "audio") {
                  if (audioDurationSec) updateData.audio_duration_sec = audioDurationSec;
                  if (permanentMediaUrl) updateData.media_url = permanentMediaUrl;
                }
                await supabase
                  .from("zapp_messages")
                  .update(updateData)
                  .eq("id", recentDupe.id);
                console.log(`[DEDUPE] Updated existing ${mediaType || 'text'} message ${recentDupe.id} with external_message_id ${messageId}`);
                isDuplicate = true;
              }
            }
          } else {
            // INBOUND: Single query for external_message_id match
            const { data: existingMsg } = await supabase
              .from("zapp_messages")
              .select("id, is_deleted, is_edited")
              .eq("zapp_conversation_id", zappConversationId)
              .eq("external_message_id", messageId)
              .maybeSingle();

            if (existingMsg) {
              if (existingMsg.is_deleted) {
                return new Response(
                  JSON.stringify({ ignored: true, reason: "message_deleted" }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
              console.log(`[DEDUPE] Inbound message ${messageId} already exists, skipping`);
              skipInsert = true;
            }
          }

            // OPTIMIZATION: Use .select('id') on INSERT to get the message ID
            // This avoids a separate re-fetch query later for AI queue
            let insertedMessageDbId: string | null = null;
            if (!isDuplicate && !skipInsert) {
              const { data: insertedMsg, error: zappMsgError } = await supabase
                .from("zapp_messages")
                .insert({
                  account_id: accountId,
                  zapp_conversation_id: zappConversationId,
                  direction: direction,
                  content: content,
                  message_type: mediaType || "text",
                  external_message_id: messageId,
                  sent_at: timestamp,
                  sender_phone: isGroupMessage ? phone : null,
                  sender_name: isGroupMessage ? contactName : null,
                  media_url: permanentMediaUrl || null,
                  media_type: mediaType || null,
                  media_mimetype: mediaMimetype || null,
                  media_filename: (mediaFilename && /^\d+[\._]/.test(mediaFilename)) ? null : (mediaFilename || null),
                  audio_duration_sec: audioDurationSec,
                  media_encrypted_url: encryptedMediaUrl || (isInvalidMediaUrl ? mediaUrl : null),
                  media_key: mediaKey || null,
                  media_download_status: initialMediaDownloadStatus,
                  quoted_message_id: quotedMsgId || null,
                  quoted_content: quotedContent || null,
                  quoted_sender_name: quotedSenderName || null,
                })
                .select("id")
                .single();

              if (zappMsgError) {
                console.error("Error saving zapp_message:", zappMsgError);
              } else {
                insertedMessageDbId = insertedMsg?.id || null;
                console.log(`Zapp message saved! Media: ${mediaType || 'none'}, LazyDownload: ${encryptedMediaUrl ? 'pending' : 'no'}`);
              }
            }

          // Create or update zapp_conversation_assignment for the queue
          // OPTIMIZATION: Check assignment cache first
          const assignCacheKey = `assign:${zappConversationId}`;
          let existingAssignment = getCached(assignmentCache, assignCacheKey, CONV_CACHE_TTL_MS) as { id: string; status: string; agent_id: string | null; department_id: string | null; assigned_at: string | null; closed_at: string | null } | null | undefined;
          
          if (existingAssignment === undefined) {
            const { data: existingAssignments } = await supabase
              .from("zapp_conversation_assignments")
              .select("id, status, agent_id, department_id, assigned_at, closed_at")
              .eq("account_id", accountId)
              .eq("zapp_conversation_id", zappConversationId)
              .order("department_id", { nullsFirst: false })
              .limit(5);
            
            existingAssignment = existingAssignments?.find(a => a.department_id !== null) 
              || existingAssignments?.[0] 
              || null;
            setCache(assignmentCache, assignCacheKey, existingAssignment);
          }

          if (existingAssignment) {
            // RACE CONDITION GUARD: If closed_at is very recent (< 10s), skip update
            // This prevents the webhook from overwriting a manual close that just happened
            if (existingAssignment.closed_at) {
              const closedAgo = Date.now() - new Date(existingAssignment.closed_at).getTime();
              if (closedAgo < 10000 && existingAssignment.status === "closed") {
                console.log(`[RACE GUARD] Skipping assignment update - closed ${closedAgo}ms ago (< 10s). Assignment: ${existingAssignment.id}`);
                // Still save the message but don't touch the assignment status
              } else {
                // Normal flow - proceed with status update below
              }
            }
            
            // Update existing assignment - also set department if not set
            // CRITICAL: Update status based on message direction
            let newStatus = existingAssignment.status;
            
            // Skip status recalculation if recently closed (race condition guard)
            const isRecentlyClosed = existingAssignment.closed_at && 
              existingAssignment.status === "closed" &&
              (Date.now() - new Date(existingAssignment.closed_at).getTime()) < 10000;
            
            if (isRecentlyClosed) {
              // Don't change anything - keep closed
              console.log(`[RACE GUARD] Keeping assignment ${existingAssignment.id} as closed`);
            } else if (existingAssignment.status === "closed") {
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
            
          if (!isRecentlyClosed) {
            // BLINDAGEM DE SETOR: Log security alert if trying to change department
            if (sectorDepartmentId && existingAssignment.department_id && 
                sectorDepartmentId !== existingAssignment.department_id) {
              console.warn(`[SECURITY] Blocked department change attempt: ${existingAssignment.department_id} -> ${sectorDepartmentId} for assignment ${existingAssignment.id}`);
            }
            
            // CORREÇÃO: Se reabrindo conversa fechada, limpar atendente para voltar à fila
            const isReopeningFromClosed = existingAssignment.status === "closed" && newStatus === "triage";
            
            await supabase
                .from("zapp_conversation_assignments")
                .update({
                  updated_at: timestamp,
                  status: newStatus,
                  // Limpar agent_id quando reabrindo de closed para que volte à Fila
                  ...(isReopeningFromClosed ? { agent_id: null, assigned_at: null } : {}),
                  // BLINDAGEM: Só define department_id se o assignment NÃO tiver um
                  // NUNCA sobrescrever um department_id existente para evitar migração entre setores
                  ...(sectorDepartmentId && !existingAssignment.department_id ? { department_id: sectorDepartmentId } : {}),
                })
                .eq("id", existingAssignment.id);
              
              console.log(`Updated zapp assignment - direction: ${direction}, newStatus: ${newStatus}`);
          }
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
        // CLIENT ANALYSIS: Moved to BACKGROUND (fire-and-forget)
        // This saves 6-8 queries from the hot path per inbound message
        // ============================================
        
        const lastMsgAt = existingZappConvo?.last_message_at ? new Date(existingZappConvo.last_message_at as string).getTime() : 0;
        const isBurstMessage = lastMsgAt > 0 && (Date.now() - lastMsgAt) < 5000;
        
        if (direction === "inbound" && phone && !isBurstMessage) {
          // Capture variables for async closure
          const _bgAccountId = accountId;
          const _bgLinkedClientId = linkedClientId;
          const _bgZappConvoId = zappConversationId;
          const _bgContent = content;
          const _bgTimestamp = timestamp;
          const _bgChatId = chat.id;
          const _bgProfilePicUrl = chat.image || chat.imagePreview;
          const _bgPhone = phone;
          const _bgInsertedMsgId = insertedMessageDbId;
          const _bgSupabase = supabase;
          
          setTimeout(async () => {
            try {
              // --- CLIENT PATH ---
              if (_bgLinkedClientId) {
                const clientId = _bgLinkedClientId;
                
                // Avatar update (only if client has no avatar)
                if (_bgProfilePicUrl) {
                  const { data: clientData } = await _bgSupabase
                    .from("clients")
                    .select("avatar_url")
                    .eq("id", clientId)
                    .maybeSingle();
                  
                  if (clientData && !clientData.avatar_url) {
                    await _bgSupabase
                      .from("clients")
                      .update({ avatar_url: _bgProfilePicUrl })
                      .eq("id", clientId);
                  }
                }

                // Find or create conversation (for client analysis)
                let conversationId: string | null = null;
                const { data: existingConvo } = await _bgSupabase
                  .from("conversations")
                  .select("id")
                  .eq("account_id", _bgAccountId)
                  .eq("client_id", clientId)
                  .eq("channel", "whatsapp")
                  .maybeSingle();

                if (existingConvo) {
                  conversationId = existingConvo.id;
                } else {
                  const { data: newConvo } = await _bgSupabase
                    .from("conversations")
                    .insert({
                      account_id: _bgAccountId,
                      client_id: clientId,
                      channel: "whatsapp",
                      external_thread_id: _bgChatId,
                    })
                    .select("id")
                    .single();
                  if (newConvo) conversationId = newConvo.id;
                }

                // Insert message event
                await _bgSupabase
                  .from("message_events")
                  .insert({
                    account_id: _bgAccountId,
                    client_id: clientId,
                    conversation_id: conversationId,
                    source: "whatsapp_text",
                    direction: "client_to_team",
                    content_text: _bgContent,
                    sent_at: _bgTimestamp,
                  });

                // Queue AI analysis (use insertedMessageDbId directly - no re-fetch!)
                if (_bgContent.length > 10 && !_bgContent.startsWith("[") && _bgInsertedMsgId) {
                  await _bgSupabase
                    .from("ai_analysis_queue")
                    .insert({
                      account_id: _bgAccountId,
                      message_id: _bgInsertedMsgId,
                      client_id: clientId,
                      status: "pending",
                      priority: 0,
                    });
                }
              } else {
                // --- LEAD PATH ---
                const normalizedPhoneForLead = _bgPhone.replace(/^\+/, '');
                const { data: existingLead } = await _bgSupabase
                  .from("leads")
                  .select("id, avatar_url")
                  .eq("account_id", _bgAccountId)
                  .or(`phone.eq.${normalizedPhoneForLead},phone.eq.${_bgPhone}`)
                  .maybeSingle();

                if (existingLead) {
                  // Avatar update
                  if (_bgProfilePicUrl && !existingLead.avatar_url) {
                    await _bgSupabase
                      .from("leads")
                      .update({ avatar_url: _bgProfilePicUrl })
                      .eq("id", existingLead.id);
                  }
                  // Link lead to conversation
                  if (_bgZappConvoId) {
                    await _bgSupabase
                      .from("zapp_conversations")
                      .update({ lead_id: existingLead.id })
                      .eq("id", _bgZappConvoId);
                  }
                }
              }
            } catch (err) {
              console.error("[BG-ANALYSIS] Async error:", err);
            }
          }, 0);
        }
        

        return new Response(
          JSON.stringify({ 
            success: true, 
            zapp_conversation_id: zappConversationId, 
            phone,
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
              
              // CORREÇÃO: Se reabrindo conversa fechada, limpar atendente para voltar à fila
              const isReopeningFromClosed = existingAssignment.status === "closed";
              
              await supabase
                .from("zapp_conversation_assignments")
                .update({
                  updated_at: timestamp,
                  // If conversation was closed and client sends new message, reopen to triage
                  status: isReopeningFromClosed ? "triage" : existingAssignment.status,
                  // Limpar agent_id quando reabrindo de closed para que volte à Fila
                  ...(isReopeningFromClosed ? { agent_id: null, assigned_at: null } : {}),
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

    // NOTE: ACK events are handled by lightweight early-return at the top of the function

    // NOTE: "chats" events are handled by early-return at the top of the function

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
