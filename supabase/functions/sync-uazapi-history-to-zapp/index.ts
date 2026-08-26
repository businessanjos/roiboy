import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Integration = {
  id: string;
  account_id: string;
  sector_id: string | null;
  display_name: string | null;
  config: Record<string, unknown> | null;
};

type UazChat = {
  name?: string;
  phone?: string;
  image?: string;
  imagePreview?: string;
  wa_chatid?: string;
  wa_isGroup?: boolean;
  wa_name?: string;
  wa_lastMsgTimestamp?: number;
};

type UazMessage = {
  id?: string;
  messageid?: string;
  chatid?: string;
  fromMe?: boolean;
  isGroup?: boolean;
  messageTimestamp?: number;
  messageType?: string;
  text?: string;
  content?: unknown;
  sender?: string;
  sender_pn?: string;
  senderName?: string;
  fileURL?: string;
  mimetype?: string;
  quoted?: string | Record<string, unknown>;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(raw?: string | null): string {
  if (!raw) return "";
  if (raw.includes("@lid")) return "";
  let digits = raw.split("@")[0].split(":")[0].split("-")[0].replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 12 && digits.startsWith("55")) {
    const ddd = Number(digits.slice(2, 4));
    if (ddd >= 11 && ddd <= 99)
      digits = digits.slice(0, 4) + "9" + digits.slice(4);
  }
  if (digits.length < 8 || digits.length > 15) return "";
  // Números BR truncados (ex.: "551899631" vindo de um campo cortado) criam
  // conversas duplicadas. Só aceita BR completo (12 ou 13 dígitos).
  if (digits.startsWith("55") && digits.length < 12) return "";
  return `+${digits}`;
}

/**
 * O campo `chat.phone` da UAZ às vezes chega truncado (últimos dígitos cortados),
 * o que gerava conversas duplicadas. O JID (`wa_chatid`) é sempre completo,
 * então escolhemos o candidato com mais dígitos.
 */
function bestDirectPhone(rawPhone?: string | null, chatId?: string | null): string {
  const fromPhone = normalizePhone(rawPhone);
  const fromChatId = normalizePhone(chatId);
  if (!fromPhone) return fromChatId;
  if (!fromChatId) return fromPhone;
  return fromChatId.length >= fromPhone.length ? fromChatId : fromPhone;
}


function phoneWithoutBrazilNinth(phone: string): string | null {
  return phone.startsWith("+55") && phone.length === 14
    ? phone.slice(0, 5) + phone.slice(6)
    : null;
}

function normalizeUazTimestampMs(raw?: number | string | null): number {
  const value = Number(raw || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value < 10_000_000_000 ? value * 1000 : value;
}

function mediaKeyOf(m: UazMessage): string | null {
  const anyMsg = m as unknown as Record<string, unknown>;
  let c = (m.content && typeof m.content === "object" ? m.content : null) as
    | Record<string, unknown>
    | null;
  for (let depth = 0; c && depth < 5; depth++) {
    const wrapped = (c.viewOnceMessageV2Extension ?? c.viewOnceMessageV2 ?? c.viewOnceMessage ?? c.ephemeralMessage ?? c.documentWithCaptionMessage) as Record<string, unknown> | undefined;
    const nested = wrapped && typeof wrapped === "object"
      ? ((wrapped.message as Record<string, unknown> | undefined) ?? wrapped)
      : null;
    if (!nested) break;
    c = nested;
  }
  const typedMedia = c && typeof c.videoMessage === "object"
    ? c.videoMessage as Record<string, unknown>
    : c && typeof c.imageMessage === "object"
      ? c.imageMessage as Record<string, unknown>
      : c && typeof c.audioMessage === "object"
        ? c.audioMessage as Record<string, unknown>
        : c && typeof c.documentMessage === "object"
          ? c.documentMessage as Record<string, unknown>
          : null;
  const raw = anyMsg.mediaKey ?? anyMsg.mediakey ?? c?.mediaKey ?? c?.mediakey ?? typedMedia?.mediaKey ?? typedMedia?.mediakey;
  return raw ? String(raw) : null;
}

function extractContent(m: UazMessage): {

  content: string;
  messageType: string;
  mediaUrl: string | null;
  mediaType: string | null;
} {
  let c = m.content as Record<string, unknown> | null;
  for (let depth = 0; c && depth < 5; depth++) {
    const wrapped = (c.viewOnceMessageV2Extension ?? c.viewOnceMessageV2 ?? c.viewOnceMessage ?? c.ephemeralMessage ?? c.documentWithCaptionMessage) as Record<string, unknown> | undefined;
    const nested = wrapped && typeof wrapped === "object"
      ? ((wrapped.message as Record<string, unknown> | undefined) ?? wrapped)
      : null;
    if (!nested) break;
    c = nested;
  }
  const typedMedia = c && typeof c.videoMessage === "object"
    ? c.videoMessage as Record<string, unknown>
    : c && typeof c.imageMessage === "object"
      ? c.imageMessage as Record<string, unknown>
      : c && typeof c.audioMessage === "object"
        ? c.audioMessage as Record<string, unknown>
        : c && typeof c.documentMessage === "object"
          ? c.documentMessage as Record<string, unknown>
          : null;
  let content = typeof m.text === "string" ? m.text : "";
  if (!content && typeof m.content === "string") content = m.content;
  if (!content && c && typeof c.text === "string") content = c.text;
  if (!content && c && typeof c.caption === "string") content = c.caption;

  const rawType = String(m.messageType || "").toLowerCase();
  let mediaType: string | null = null;
  if (c && typeof c.videoMessage === "object") mediaType = "video";
  else if (c && typeof c.imageMessage === "object") mediaType = "image";
  else if (c && typeof c.audioMessage === "object") mediaType = "audio";
  else if (c && typeof c.documentMessage === "object") mediaType = "document";
  else if (rawType.includes("image")) mediaType = "image";
  else if (rawType.includes("audio") || rawType.includes("ptt"))
    mediaType = "audio";
  else if (rawType.includes("video")) mediaType = "video";
  else if (rawType.includes("document")) mediaType = "document";
  else if (rawType.includes("sticker")) mediaType = "sticker";

  const mediaUrl =
    m.fileURL ||
    (c && typeof c.URL === "string" ? c.URL : null) ||
    (c && typeof c.url === "string" ? c.url : null) ||
    (typedMedia && typeof typedMedia.url === "string" ? typedMedia.url : null) ||
    null;
  if (!content && mediaType === "image") content = "📷 Imagem";
  if (!content && mediaType === "audio") content = "🎤 Áudio";
  if (!content && mediaType === "video") content = "🎬 Vídeo";
  if (!content && mediaType === "document") content = "📄 Documento";
  if (!content && mediaType === "sticker") content = "🎨 Figurinha";
  if (!content && rawType.includes("reaction"))
    content = String(m.text || "[reação]");

  return { content, messageType: mediaType || "text", mediaUrl, mediaType };
}

function quotedId(raw: UazMessage["quoted"]): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return raw || null;
  return String(raw.id || raw.messageid || raw.stanzaID || "") || null;
}

async function uazFetch(
  host: string,
  token: string,
  path: string,
  body: Record<string, unknown>,
) {
  const res = await fetch(`${host}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token },
    body: JSON.stringify(body),
  });
  if (!res.ok)
    throw new Error(`UAZAPI ${path} ${res.status}: ${await res.text()}`);
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body = await req.json();
    const integrationId = String(body.integration_id || "");
    const sinceLastSync = body.since_last_sync === true || body.mode === "incremental";
    const endMs = body.end ? Date.parse(String(body.end)) : Date.now();
    const maxChats = Number(body.max_chats || 2000);
    const maxMessagesPerChat = Number(body.max_messages_per_chat || 10000);
    const targetPhoneRaw = body.target_phone ? String(body.target_phone) : "";
    const targetPhone = targetPhoneRaw ? normalizePhone(targetPhoneRaw) : "";
    const targetPhoneAlt = targetPhone
      ? phoneWithoutBrazilNinth(targetPhone)
      : null;

    if (!integrationId || Number.isNaN(endMs)) {
      return json(400, { error: "integration_id ou end inválidos" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: integration, error: integrationError } = await supabase
      .from("integrations")
      .select("id, account_id, sector_id, display_name, config")
      .eq("id", integrationId)
      .single<Integration>();

    if (integrationError || !integration)
      return json(404, { error: "Integração não encontrada" });

    const host = String(
      integration.config?.host_url || Deno.env.get("UAZAPI_URL") || "",
    ).replace(/\/$/, "");
    const token = String(integration.config?.instance_token || "");
    if (!host || !token)
      return json(400, { error: "Integração sem host/token UAZAPI" });

    const config = (integration.config || {}) as Record<string, unknown>;
    const lastSyncIso = typeof config.last_history_sync_at === "string"
      ? config.last_history_sync_at
      : null;
    const lastSyncMs = lastSyncIso ? Date.parse(lastSyncIso) : NaN;

    // Overlap of 5 min to catch late-arriving messages around the checkpoint
    const OVERLAP_MS = 5 * 60 * 1000;

    let startMs: number;
    if (body.start) {
      startMs = Date.parse(String(body.start));
    } else if (sinceLastSync && Number.isFinite(lastSyncMs)) {
      startMs = Math.max(0, lastSyncMs - OVERLAP_MS);
    } else if (sinceLastSync) {
      // No previous checkpoint — default to last 7 days
      startMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    } else {
      startMs = Date.parse("2026-04-15T00:00:00Z");
    }
    if (Number.isNaN(startMs)) {
      return json(400, { error: "start inválido" });
    }
    const syncStartedAtMs = Date.now();

    const { data: dept } = await supabase
      .from("zapp_departments")
      .select("id")
      .eq("account_id", integration.account_id)
      .eq("sector_id", integration.sector_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const departmentId = dept?.id || null;

    const stats = {
      chatsScanned: 0,
      chatsSynced: 0,
      messagesFetched: 0,
      messagesInserted: 0,
      mediaMetadataRefreshed: 0,
      duplicates: 0,
      conversationsCreated: 0,
      assignmentsCreated: 0,
      skippedNoPhone: 0,
      skippedNoContent: 0,
      oldestSynced: null as string | null,
      newestSynced: null as string | null,
    };

    let chatOffset = 0;
    const chatLimit = 500;

    while (stats.chatsScanned < maxChats) {
      const chatResult = await uazFetch(host, token, "/chat/find", {
        operator: "AND",
        sort: "-wa_lastMsgTimestamp",
        limit: chatLimit,
        offset: chatOffset,
      });
      const chats = (chatResult.chats || []) as UazChat[];
      if (!chats.length) break;

      for (const chat of chats) {
        stats.chatsScanned++;
        const lastTs = normalizeUazTimestampMs(chat.wa_lastMsgTimestamp || 0);
        if (lastTs && lastTs < startMs) continue;
        if (lastTs && lastTs > endMs) {
          // still sync: message-level filter will apply
        }

        const chatId = chat.wa_chatid || "";
        if (!chatId) continue;
        const isGroup = !!chat.wa_isGroup || chatId.includes("@g.us");
        const groupName = chat.wa_name || chat.name || "Grupo";
        const directPhone = !isGroup
          ? bestDirectPhone(chat.phone, chatId)
          : "";

        // If filtering to a specific phone, skip groups and any chat that doesn't match
        if (targetPhone) {
          if (isGroup) continue;
          const matches =
            directPhone === targetPhone ||
            (targetPhoneAlt && directPhone === targetPhoneAlt);
          if (!matches) continue;
        }

        let msgOffset = 0;
        let syncedThisChat = false;
        while (msgOffset < maxMessagesPerChat) {
          const msgResult = await uazFetch(host, token, "/message/find", {
            operator: "AND",
            sort: "-messageTimestamp",
            limit: 500,
            offset: msgOffset,
            chatid: chatId,
            messageTimestamp: { $gte: Math.floor(startMs / 1000) },
          });
          const messages = (msgResult.messages || []) as UazMessage[];
          if (!messages.length) break;

          const filtered = messages.filter((m) => {
            const ts = normalizeUazTimestampMs(m.messageTimestamp || 0);
            return ts >= startMs && ts <= endMs;
          });

          if (filtered.length) {
            let conversationId: string | null = null;
            let clientId: string | null = null;
            let phoneForConversation = directPhone;

            if (isGroup) {
              const { data: existing } = await supabase
                .from("zapp_conversations")
                .select("id")
                .eq("account_id", integration.account_id)
                .eq("integration_id", integration.id)
                .eq("group_jid", chatId)
                .eq("is_group", true)
                .maybeSingle();
              conversationId = existing?.id || null;

              if (!conversationId) {
                const latest = filtered[0];
                const preview = extractContent(latest).content.slice(0, 100);
                const { data: created, error } = await supabase
                  .from("zapp_conversations")
                  .insert({
                    account_id: integration.account_id,
                    client_id: null,
                    phone_e164: "",
                    contact_name: groupName,
                    channel: "whatsapp",
                    external_thread_id: chatId,
                    last_message_at: new Date(
                      normalizeUazTimestampMs(latest.messageTimestamp),
                    ).toISOString(),
                    last_message_preview: preview,
                    unread_count: 0,
                    is_group: true,
                    group_jid: chatId,
                    avatar_url: chat.image || chat.imagePreview || null,
                    sector_id: integration.sector_id,
                    integration_id: integration.id,
                  })
                  .select("id")
                  .single();
                if (error) throw error;
                conversationId = created.id;
                stats.conversationsCreated++;
              }
            } else {
              if (!phoneForConversation) {
                stats.skippedNoPhone += filtered.length;
                break;
              }
              const phoneAlt = phoneWithoutBrazilNinth(phoneForConversation);
              let query = supabase
                .from("zapp_conversations")
                .select("id, client_id")
                .eq("account_id", integration.account_id)
                .eq("integration_id", integration.id)
                .eq("is_group", false);
              query = phoneAlt
                ? query.in("phone_e164", [phoneForConversation, phoneAlt])
                : query.eq("phone_e164", phoneForConversation);
              const { data: existing } = await query
                .order("last_message_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              conversationId = existing?.id || null;
              clientId = existing?.client_id || null;

              if (!clientId) {
                const phones = phoneAlt
                  ? [phoneForConversation, phoneAlt]
                  : [phoneForConversation];
                const { data: client } = await supabase
                  .from("clients")
                  .select("id")
                  .eq("account_id", integration.account_id)
                  .in("phone_e164", phones)
                  .limit(1)
                  .maybeSingle();
                clientId = client?.id || null;
              }

              if (!conversationId) {
                const latest = filtered[0];
                const preview = extractContent(latest).content.slice(0, 100);
                const { data: created, error } = await supabase
                  .from("zapp_conversations")
                  .insert({
                    account_id: integration.account_id,
                    client_id: clientId,
                    phone_e164: phoneForConversation,
                    contact_name: chat.name || phoneForConversation,
                    channel: "whatsapp",
                    external_thread_id: chatId,
                    last_message_at: new Date(
                      normalizeUazTimestampMs(latest.messageTimestamp),
                    ).toISOString(),
                    last_message_preview: preview,
                    unread_count: 0,
                    is_group: false,
                    avatar_url: chat.image || chat.imagePreview || null,
                    sector_id: integration.sector_id,
                    integration_id: integration.id,
                  })
                  .select("id")
                  .single();
                if (error) throw error;
                conversationId = created.id;
                stats.conversationsCreated++;
              }
            }

            if (!conversationId) break;

            const externalIds = filtered
              .map((m) => String(m.id || `${m.chatid}:${m.messageid}`))
              .filter(Boolean);
            const { data: existingMessages } = await supabase
              .from("zapp_messages")
              .select("external_message_id")
              .eq("zapp_conversation_id", conversationId)
              .in("external_message_id", externalIds);
            const existingSet = new Set(
              (existingMessages || []).map((m) => m.external_message_id),
            );

            const rows = [];
            for (const m of filtered.reverse()) {
              const externalId = String(m.id || `${m.chatid}:${m.messageid}`);
              if (!externalId) {
                stats.duplicates++;
                continue;
              }
              const extracted = extractContent(m);
              if (existingSet.has(externalId)) {
                const refreshedMediaKey = mediaKeyOf(m);
                const refreshedMediaUrl = extracted.mediaUrl;
                if (extracted.mediaType && refreshedMediaUrl && refreshedMediaKey && refreshedMediaUrl.includes("whatsapp.net")) {
                  const refreshedMimetype = m.mimetype || (typedMediaMimetype(m) ?? null);
                  const refreshPatch: Record<string, unknown> = {
                    media_encrypted_url: refreshedMediaUrl,
                    media_key: refreshedMediaKey,
                    media_type: extracted.mediaType,
                    media_download_status: "pending",
                    media_download_attempts: 0,
                    media_last_error: null,
                    updated_at: new Date().toISOString(),
                  };
                  if (refreshedMimetype) refreshPatch.media_mimetype = refreshedMimetype;
                  const { error: refreshError } = await supabase
                    .from("zapp_messages")
                    .update(refreshPatch)
                    .eq("zapp_conversation_id", conversationId)
                    .eq("external_message_id", externalId)
                    .is("media_url", null);
                  if (refreshError) throw refreshError;
                  stats.mediaMetadataRefreshed++;
                } else {
                  stats.duplicates++;
                }
                continue;
              }
              if (!extracted.content) {
                stats.skippedNoContent++;
                continue;
              }
              const senderPhone = isGroup
                ? normalizePhone(m.sender_pn) || normalizePhone(m.sender)
                : null;
              // Mídia vinda do CDN do WhatsApp (mmg.whatsapp.net) está
              // criptografada: precisa ir para media_encrypted_url + media_key
              // para o pipeline de download/descriptografia. Guardar isso em
              // media_url deixava o áudio impossível de tocar e de transcrever.
              const rawMediaUrl = extracted.mediaUrl;
              const isEncryptedCdn = !!rawMediaUrl && rawMediaUrl.includes("whatsapp.net");
              const historyMediaKey = mediaKeyOf(m);
              rows.push({
                account_id: integration.account_id,
                zapp_conversation_id: conversationId,
                direction: m.fromMe ? "outbound" : "inbound",
                content: extracted.content,
                message_type: extracted.messageType,
                external_message_id: externalId,
                sent_at: new Date(
                  normalizeUazTimestampMs(m.messageTimestamp),
                ).toISOString(),
                sender_phone: isGroup ? senderPhone : null,
                sender_name: isGroup ? m.senderName || null : null,
                media_url: isEncryptedCdn ? null : rawMediaUrl,
                media_encrypted_url: isEncryptedCdn ? rawMediaUrl : null,
                media_key: isEncryptedCdn ? historyMediaKey : null,
                media_download_status: !rawMediaUrl
                  ? null
                  : isEncryptedCdn
                    ? (historyMediaKey ? "pending" : "failed")
                    : "completed",
                media_last_error: isEncryptedCdn && !historyMediaKey
                  ? "Mídia histórica sem chave de descriptografia (mediaKey ausente no histórico do provedor)"
                  : null,
                media_type: extracted.mediaType,
                media_mimetype: m.mimetype || null,
                delivery_status: m.fromMe ? "sent" : null,
                quoted_message_id: quotedId(m.quoted),
                synced_from_history: true,
              });
            }


            if (rows.length) {
              const { error: insertError } = await supabase
                .from("zapp_messages")
                .insert(rows);
              if (insertError) throw insertError;
              stats.messagesInserted += rows.length;
              syncedThisChat = true;
              stats.oldestSynced =
                rows[0].sent_at < (stats.oldestSynced || rows[0].sent_at)
                  ? rows[0].sent_at
                  : stats.oldestSynced || rows[0].sent_at;
              stats.newestSynced =
                rows[rows.length - 1].sent_at >
                (stats.newestSynced || rows[rows.length - 1].sent_at)
                  ? rows[rows.length - 1].sent_at
                  : stats.newestSynced || rows[rows.length - 1].sent_at;

              const latestRow = rows[rows.length - 1];
              // Only bump last_message_at when the newly-imported message is
              // actually newer than what's stored — otherwise historical
              // imports would regress the conversation position in the list.
              const { data: convCurrent } = await supabase
                .from("zapp_conversations")
                .select("last_message_at")
                .eq("id", conversationId)
                .maybeSingle();
              const currentAtMs = convCurrent?.last_message_at
                ? new Date(convCurrent.last_message_at).getTime()
                : 0;
              const latestAtMs = new Date(latestRow.sent_at).getTime();
              if (latestAtMs > currentAtMs) {
                await supabase
                  .from("zapp_conversations")
                  .update({
                    last_message_at: latestRow.sent_at,
                    last_message_preview:
                      latestRow.direction === "outbound"
                        ? `Você: ${latestRow.content.slice(0, 80)}`
                        : latestRow.content.slice(0, 100),
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", conversationId);
              }

              const { data: assignment } = await supabase
                .from("zapp_conversation_assignments")
                .select("id")
                .eq("account_id", integration.account_id)
                .eq("zapp_conversation_id", conversationId)
                .limit(1)
                .maybeSingle();
              if (!assignment) {
                const { error } = await supabase
                  .from("zapp_conversation_assignments")
                  .upsert(
                    {
                      account_id: integration.account_id,
                      zapp_conversation_id: conversationId,
                      status: "triage",
                      department_id: departmentId,
                    },
                    {
                      onConflict:
                        "account_id,zapp_conversation_id,department_id",
                      ignoreDuplicates: true,
                    },
                  );
                if (!error) stats.assignmentsCreated++;
              }
            }
          }

          stats.messagesFetched += messages.length;
          if (messages.length < 500) break;
          const lastTs = normalizeUazTimestampMs(
            messages[messages.length - 1].messageTimestamp || 0,
          );
          if (lastTs && lastTs < startMs) break;
          msgOffset += messages.length;
        }
        if (syncedThisChat) stats.chatsSynced++;
      }

      if (chats.length < chatLimit) break;
      chatOffset += chats.length;
    }

    // Advance the incremental checkpoint. Use newest message synced when we
    // inserted something; otherwise advance to the sync start time so future
    // runs don't rescan the same idle window from scratch.
    const newestSyncedMs = stats.newestSynced
      ? Date.parse(stats.newestSynced)
      : NaN;
    const previousCheckpointMs = Number.isFinite(lastSyncMs) ? lastSyncMs : 0;
    const candidateMs = Number.isFinite(newestSyncedMs)
      ? newestSyncedMs
      : syncStartedAtMs;
    const nextCheckpointMs = Math.max(previousCheckpointMs, candidateMs);
    const nextCheckpointIso = new Date(nextCheckpointMs).toISOString();

    // Only persist checkpoint when not filtered to a single phone — a
    // target_phone run isn't a full account sync.
    if (!targetPhone) {
      await supabase
        .from("integrations")
        .update({
          config: { ...config, last_history_sync_at: nextCheckpointIso },
        })
        .eq("id", integration.id);
    }

    return json(200, {
      success: true,
      integration: integration.display_name,
      mode: sinceLastSync ? "incremental" : "range",
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      previous_checkpoint: lastSyncIso,
      next_checkpoint: targetPhone ? lastSyncIso : nextCheckpointIso,
      stats,
    });
  } catch (error) {
    console.error("sync-uazapi-history-to-zapp error", error);
    return json(500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
