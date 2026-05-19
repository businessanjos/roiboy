import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Cache: phone_number_id → integration record
const integrationCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function getCached(key: string) {
  const entry = integrationCache.get(key);
  if (!entry || Date.now() - entry.ts > CACHE_TTL_MS) {
    integrationCache.delete(key);
    return undefined;
  }
  return entry.data;
}

function setCache(key: string, data: any) {
  if (integrationCache.size >= 500) {
    const oldest = integrationCache.keys().next().value;
    if (oldest) integrationCache.delete(oldest);
  }
  integrationCache.set(key, { data, ts: Date.now() });
}

// Normalize Brazilian phone: remove +, ensure country code
function normalizePhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("0")) clean = clean.slice(1);
  if (!clean.startsWith("55") && clean.length <= 11) clean = "55" + clean;
  return clean;
}

// Extract text content from Meta message object
function extractMessageContent(msgObj: any): { content: string; messageType: string; mediaUrl: string | null; mediaMimetype: string | null; mediaFilename: string | null } {
  if (msgObj.text) {
    return { content: msgObj.text.body || "", messageType: "text", mediaUrl: null, mediaMimetype: null, mediaFilename: null };
  }
  if (msgObj.image) {
    return { content: msgObj.image.caption || "", messageType: "image", mediaUrl: msgObj.image.id, mediaMimetype: msgObj.image.mime_type || "image/jpeg", mediaFilename: null };
  }
  if (msgObj.video) {
    return { content: msgObj.video.caption || "", messageType: "video", mediaUrl: msgObj.video.id, mediaMimetype: msgObj.video.mime_type || "video/mp4", mediaFilename: null };
  }
  if (msgObj.audio) {
    return { content: "", messageType: msgObj.audio.voice ? "ptt" : "audio", mediaUrl: msgObj.audio.id, mediaMimetype: msgObj.audio.mime_type || "audio/ogg", mediaFilename: null };
  }
  if (msgObj.document) {
    return { content: msgObj.document.caption || "", messageType: "document", mediaUrl: msgObj.document.id, mediaMimetype: msgObj.document.mime_type, mediaFilename: msgObj.document.filename || null };
  }
  if (msgObj.sticker) {
    return { content: "", messageType: "sticker", mediaUrl: msgObj.sticker.id, mediaMimetype: msgObj.sticker.mime_type || "image/webp", mediaFilename: null };
  }
  if (msgObj.location) {
    return { content: `📍 ${msgObj.location.latitude},${msgObj.location.longitude}`, messageType: "location", mediaUrl: null, mediaMimetype: null, mediaFilename: null };
  }
  if (msgObj.contacts) {
    const name = msgObj.contacts[0]?.name?.formatted_name || "Contato";
    const phone = msgObj.contacts[0]?.phones?.[0]?.phone || "";
    return { content: `👤 ${name}\n${phone}`, messageType: "contact", mediaUrl: null, mediaMimetype: null, mediaFilename: null };
  }
  if (msgObj.reaction) {
    return { content: "", messageType: "reaction", mediaUrl: null, mediaMimetype: null, mediaFilename: null };
  }
  return { content: JSON.stringify(msgObj).substring(0, 200), messageType: "unknown", mediaUrl: null, mediaMimetype: null, mediaFilename: null };
}

// Map Meta status to numeric ack
function metaStatusToAck(status: string): number {
  switch (status) {
    case "sent": return 2;
    case "delivered": return 3;
    case "read": return 4;
    case "failed": return -1;
    default: return 0;
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ============================================
  // GET: Meta Webhook Verification (challenge)
  // ============================================
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const verifyToken = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const expectedToken = Deno.env.get("META_WHATSAPP_VERIFY_TOKEN");

    if (mode === "subscribe" && verifyToken === expectedToken) {
      console.log("[meta-webhook] ✅ Webhook verified successfully");
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    console.error("[meta-webhook] ❌ Webhook verification failed", { mode, verifyToken: verifyToken?.substring(0, 4) });
    return new Response("Forbidden", { status: 403 });
  }

  // ============================================
  // POST: Incoming messages & status updates
  // ============================================
  try {
    const body = await req.json();
    
    // Meta sends: { object: "whatsapp_business_account", entry: [...] }
    if (body.object !== "whatsapp_business_account") {
      return new Response(JSON.stringify({ ignored: true, reason: "not_whatsapp" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;

        const value = change.value;
        const phoneNumberId = value.metadata?.phone_number_id;
        const displayPhone = value.metadata?.display_phone_number;

        if (!phoneNumberId) {
          console.error("[meta-webhook] Missing phone_number_id in metadata");
          continue;
        }

        // Find integration by phone_number_id in config
        let integration = getCached(`meta:${phoneNumberId}`);
        if (!integration) {
          const { data: results } = await supabase
            .from("integrations")
            .select("id, account_id, config, sector_id")
            .eq("type", "whatsapp")
            .filter("config->>provider", "eq", "meta_official")
            .filter("config->>phone_number_id", "eq", phoneNumberId)
            .limit(1);

          if (results && results.length > 0) {
            integration = results[0];
            setCache(`meta:${phoneNumberId}`, integration);
          }
        }

        if (!integration) {
          console.error(`[meta-webhook] No integration found for phone_number_id: ${phoneNumberId}`);
          continue;
        }

        const accountId = integration.account_id;
        const sectorId = integration.sector_id;
        const integrationId = integration.id;

        // Find department for sector
        let departmentId: string | null = null;
        if (sectorId) {
          const { data: dept } = await supabase
            .from("zapp_departments")
            .select("id")
            .eq("account_id", accountId)
            .eq("sector_id", sectorId)
            .limit(1)
            .maybeSingle();
          departmentId = dept?.id || null;
        }

        // ============================================
        // Handle STATUS UPDATES (ack/delivery receipts)
        // ============================================
        if (value.statuses && Array.isArray(value.statuses)) {
          for (const status of value.statuses) {
            const externalId = status.id;
            const ack = metaStatusToAck(status.status);

            if (!externalId || ack <= 0) continue;

            const statusMap: Record<number, string> = { 2: "sent", 3: "delivered", 4: "read" };
            const { error } = await supabase
              .from("zapp_messages")
              .update({
                delivery_status: statusMap[ack] || "sent",
                delivered_at: ack >= 3 ? new Date().toISOString() : undefined,
                read_at: ack >= 4 ? new Date().toISOString() : undefined,
              })
              .eq("account_id", accountId)
              .or(`external_id.eq.${externalId},external_message_id.eq.${externalId}`);

            if (error) {
              console.error(`[meta-webhook] ACK update error for ${externalId}:`, error.message);
            }
          }
        }

        // ============================================
        // Handle INCOMING MESSAGES
        // ============================================
        if (value.messages && Array.isArray(value.messages)) {
          for (const msg of value.messages) {
            // Skip reactions
            if (msg.type === "reaction") continue;

            const senderPhone = normalizePhone(msg.from);
            const externalMessageId = msg.id;
            const timestamp = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000).toISOString() : new Date().toISOString();

            // Extract message content
            const { content, messageType, mediaUrl, mediaMimetype, mediaFilename } = extractMessageContent(msg);

            // Dedup: check if message already exists
            const { data: existing } = await supabase
              .from("zapp_messages")
              .select("id")
              .eq("account_id", accountId)
              .eq("external_message_id", externalMessageId)
              .limit(1);

            if (existing && existing.length > 0) {
              console.log(`[meta-webhook] Dedup: message ${externalMessageId} already exists`);
              continue;
            }

            // Find or create conversation
            const chatJid = `${senderPhone}@s.whatsapp.net`;
            let conversation = null;

            // Try to find existing conversation
            const { data: existingConv } = await supabase
              .from("zapp_conversations")
              .select("id, unread_count, integration_id, contact_name, client_id, lead_id")
              .eq("account_id", accountId)
              .eq("phone_jid", chatJid)
              .eq("integration_id", integrationId)
              .limit(1)
              .maybeSingle();

            if (existingConv) {
              conversation = existingConv;
            } else {
              // Get contact name from Meta payload
              const contactName = value.contacts?.[0]?.profile?.name || senderPhone;

              // Try to find client by phone
              let clientId: string | null = null;
              let leadId: string | null = null;

              const phoneVariants = [senderPhone, senderPhone.replace(/^55/, "")];
              for (const pv of phoneVariants) {
                const { data: clientMatch } = await supabase
                  .from("clients")
                  .select("id")
                  .eq("account_id", accountId)
                  .or(`phone.eq.${pv},phone.eq.+${pv}`)
                  .limit(1)
                  .maybeSingle();
                if (clientMatch) {
                  clientId = clientMatch.id;
                  break;
                }
              }

              if (!clientId) {
                for (const pv of phoneVariants) {
                  const { data: leadMatch } = await supabase
                    .from("leads")
                    .select("id")
                    .eq("account_id", accountId)
                    .or(`phone.eq.${pv},phone.eq.+${pv}`)
                    .limit(1)
                    .maybeSingle();
                  if (leadMatch) {
                    leadId = leadMatch.id;
                    break;
                  }
                }
              }

              // Create conversation
              const { data: newConv, error: convErr } = await supabase
                .from("zapp_conversations")
                .insert({
                  account_id: accountId,
                  phone_jid: chatJid,
                  phone_e164: senderPhone,
                  contact_name: contactName,
                  integration_id: integrationId,
                  client_id: clientId,
                  lead_id: leadId,
                  last_message_at: timestamp,
                  last_message_preview: content?.substring(0, 100) || `[${messageType}]`,
                  unread_count: 1,
                  is_group: false,
                })
                .select("id, unread_count, integration_id, contact_name, client_id, lead_id")
                .single();

              if (convErr) {
                console.error(`[meta-webhook] Error creating conversation:`, convErr.message);
                continue;
              }
              conversation = newConv;

              // Create assignment
              if (conversation && departmentId) {
                await supabase.from("zapp_conversation_assignments").upsert({
                  account_id: accountId,
                  zapp_conversation_id: conversation.id,
                  department_id: departmentId,
                  status: "open",
                }, { onConflict: "account_id,zapp_conversation_id,department_id" });
              }
            }

            if (!conversation) continue;

            // Download media if present (media_id needs to be resolved via Meta API)
            let resolvedMediaUrl: string | null = null;
            if (mediaUrl) {
              // Store the media_id for later download; the download-media function can handle Meta media IDs
              resolvedMediaUrl = `meta_media:${mediaUrl}`;
            }

            // Insert message
            const { error: msgErr } = await supabase.from("zapp_messages").insert({
              account_id: accountId,
              zapp_conversation_id: conversation.id,
              direction: "inbound",
              content: content || null,
              message_type: messageType,
              media_url: resolvedMediaUrl,
              media_mimetype: mediaMimetype,
              media_filename: mediaFilename,
              media_download_status: mediaUrl ? "pending" : null,
              sent_at: timestamp,
              external_message_id: externalMessageId,
              external_id: externalMessageId,
              sender_phone: senderPhone,
              sender_name: value.contacts?.[0]?.profile?.name || null,
              is_from_client: true,
            });

            if (msgErr) {
              console.error(`[meta-webhook] Error inserting message:`, msgErr.message);
              continue;
            }

            // Update conversation metadata
            await supabase
              .from("zapp_conversations")
              .update({
                last_message_at: timestamp,
                last_message_preview: content?.substring(0, 100) || `[${messageType}]`,
                unread_count: (conversation.unread_count || 0) + 1,
              })
              .eq("id", conversation.id);

            // Reopen assignment if closed
            await supabase
              .from("zapp_conversation_assignments")
              .update({
                status: "open",
                closed_at: null,
                closed_by: null,
              })
              .eq("zapp_conversation_id", conversation.id)
              .eq("status", "closed");

            console.log(`[meta-webhook] ✅ Message ${externalMessageId} saved for conversation ${conversation.id}`);
          }
        }
      }
    }

    // Meta requires 200 response
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[meta-webhook] Error:", err);
    // Always return 200 to Meta to avoid retries
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
