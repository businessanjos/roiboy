import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Lazy Media Download Function
 * 
 * Downloads, decrypts, and stores WhatsApp media on demand.
 * Called when a user opens a conversation with pending media.
 * 
 * This approach is scalable because:
 * 1. Webhook only saves metadata (fast, no CPU)
 * 2. Media is only downloaded when actually viewed
 * 3. Processing is distributed across user requests
 * 
 * Improvements in this version:
 * - Includes stuck "downloading" messages (>5 min old)
 * - Processes in batches of 5 to avoid timeout
 * - Individual timeout per download (30s)
 * - Better error handling and logging
 */

// Limite de tamanho por mídia (memória do isolate é compartilhada)
const MAX_MEDIA_BYTES = 90 * 1024 * 1024;

const BodySchema = z.object({
  message_id: z.string().uuid().optional(),
  message_ids: z.array(z.string().uuid()).min(1).max(25).optional(),
  account_id: z.string().uuid().optional(),
  force: z.boolean().optional().default(false),
}).refine((body) => body.message_id || body.message_ids?.length, {
  message: "message_id or message_ids required",
});

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

function hasExpectedMediaSignature(data: Uint8Array, mediaType: string, mimetype: string | null): boolean {
  if (data.byteLength < 12) return false;
  if (mediaType === "video") {
    // ISO BMFF containers used by MP4/MOV have an `ftyp` box near the start.
    return new TextDecoder().decode(data.subarray(4, 12)).includes("ftyp");
  }
  if (mediaType === "image") {
    return (data[0] === 0xff && data[1] === 0xd8) ||
      (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) ||
      new TextDecoder().decode(data.subarray(0, 12)).includes("WEBP");
  }
  if (mediaType === "audio") {
    const header = new TextDecoder().decode(data.subarray(0, 12));
    return header.startsWith("OggS") || header.startsWith("ID3") || header.includes("ftyp") ||
      (data[0] === 0xff && (data[1] & 0xe0) === 0xe0);
  }
  // Documents can be any binary format; the authenticated WhatsApp MAC is the validation.
  return mediaType === "document" || Boolean(mimetype);
}

// Download with timeout
async function downloadWithTimeout(url: string, timeoutMs: number = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const parsedBody = BodySchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return new Response(JSON.stringify({ error: parsedBody.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { message_id, message_ids, account_id: requestedAccountId, force } = parsedBody.data;
    
    // Support both single message and batch processing
    const idsToProcess = message_ids || (message_id ? [message_id] : []);
    
    const authorization = req.headers.get("Authorization") || "";
    const bearerToken = authorization.replace(/^Bearer\s+/i, "");
    const isInternalCall = bearerToken === supabaseKey;
    let authorizedAccountId = requestedAccountId || null;

    if (!isInternalCall) {
      const { data: authData, error: authError } = await supabase.auth.getUser(bearerToken);
      if (authError || !authData.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: appUser } = await supabase
        .from("users")
        .select("account_id")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle();
      if (!appUser?.account_id) {
        return new Response(JSON.stringify({ error: "Account not found" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      authorizedAccountId = appUser.account_id;
    }

    console.log(`Processing ${idsToProcess.length} media messages for account ${requestedAccountId || 'any'}`);

    // Calculate 5 minutes ago for stuck downloading detection
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // SECURITY: Build query with optional account_id filter
    // Fetch ALL requested messages (no media_encrypted_url filter) to handle auto-correction
    let messagesQuery = supabase
      .from("zapp_messages")
      .select("id, account_id, message_type, media_type, media_url, media_encrypted_url, media_key, media_mimetype, zapp_conversation_id, media_download_status, media_download_attempts, updated_at")
      .in("id", idsToProcess);
    
    // SECURITY: If account_id provided, filter to prevent cross-account access
    if (authorizedAccountId) {
      messagesQuery = messagesQuery.eq("account_id", authorizedAccountId);
    }
    
    // Fetch messages that need processing
    const { data: allMessages, error: fetchError } = await messagesQuery;

    if (fetchError) {
      console.error("Error fetching messages:", fetchError);
      throw fetchError;
    }

    // Auto-correct: messages that already have a permanent media_url (e.g. Supabase Storage)
    // but are stuck with wrong status — fix them immediately without downloading
    const autoCorrectMsgs = force ? [] : (allMessages || []).filter((msg: any) => {
      return msg.media_url 
        && msg.media_url.includes("supabase") 
        && msg.media_download_status !== "completed";
    });

    if (autoCorrectMsgs.length > 0) {
      console.log(`Auto-correcting ${autoCorrectMsgs.length} messages with existing permanent URLs`);
      await Promise.all(autoCorrectMsgs.map((msg: any) =>
        supabase.from("zapp_messages")
          .update({ media_download_status: "completed", updated_at: new Date().toISOString() })
          .eq("id", msg.id)
      ));
    }

    const unresolvedMsgs = (allMessages || []).filter((msg: any) =>
      msg.media_type && !msg.media_url && !msg.media_encrypted_url
    );
    if (unresolvedMsgs.length > 0) {
      await Promise.all(unresolvedMsgs.map((msg: any) =>
        supabase.from("zapp_messages").update({
          media_download_status: "failed",
          media_last_error: "URL de mídia não recebida do provedor",
          updated_at: new Date().toISOString(),
        }).eq("id", msg.id).eq("account_id", msg.account_id)
      ));
    }

    // Filter to only those that actually need downloading:
    // Must have media_encrypted_url AND be in pending/failed/stuck-downloading state
    const messages = (allMessages || []).filter((msg: any) => {
      // Skip if no encrypted URL to download from
      if (!msg.media_encrypted_url) return false;
      // Skip already completed
      if (msg.media_download_status === "completed" && !force) return false;
      // Skip auto-corrected
      if (autoCorrectMsgs.some((ac: any) => ac.id === msg.id)) return false;
      
      if (!msg.media_download_status || msg.media_download_status === "pending") return true;
      if (msg.media_download_status === "downloading") {
        return msg.updated_at && msg.updated_at < fiveMinutesAgo;
      }
      if (msg.media_download_status === "failed" || msg.media_download_status === "abandoned") return true;
      if (force) return true;
      return false;
    });

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        processed: 0, 
        auto_corrected: autoCorrectMsgs.length,
        failed_unresolved: unresolvedMsgs.length,
        message: autoCorrectMsgs.length > 0 
          ? `Auto-corrected ${autoCorrectMsgs.length} messages, no downloads needed` 
          : "No pending media to download"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${messages.length} messages with pending/stuck media (filtered from ${allMessages?.length || 0})`);

    const results: { id: string; success: boolean; url?: string; error?: string }[] = [];

    // Vídeos e documentos são grandes: baixar 8 em paralelo estourava a memória
    // do isolate ("Memory limit exceeded"), matando o processo e deixando as
    // mensagens presas em "downloading". Mídia pesada roda uma por vez.
    const isHeavy = (msg: any) => msg.media_type === "video" || msg.media_type === "document";
    const ordered = [
      ...messages.filter((m: any) => !isHeavy(m)),
      ...messages.filter((m: any) => isHeavy(m)),
    ];

    const chunks: any[][] = [];
    for (const msg of ordered) {
      const last = chunks[chunks.length - 1];
      if (isHeavy(msg)) {
        chunks.push([msg]);
      } else if (last && last.length < 8 && !isHeavy(last[0])) {
        last.push(msg);
      } else {
        chunks.push([msg]);
      }
    }

    for (const batch of chunks) {
      // Process batch in parallel
      const batchResults = await Promise.all(batch.map(async (msg: any) => {
        try {
          // Mark as downloading + bump attempt counter
          await supabase
            .from("zapp_messages")
            .update({
              media_download_status: "downloading",
              media_download_attempts: ((msg.media_download_attempts as number) || 0) + 1,
              media_last_attempt_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("id", msg.id);


          console.log(`Downloading media for message ${msg.id}...`);

          // Download encrypted media with timeout
          const mediaResponse = await downloadWithTimeout(msg.media_encrypted_url, 30000);
          
          if (!mediaResponse.ok) {
            throw new Error(`Download failed: ${mediaResponse.status}`);
          }

          // Guard de memória: arquivo grande demais derruba o isolate inteiro.
          const declaredSize = Number(mediaResponse.headers.get("content-length") || 0);
          if (declaredSize > MAX_MEDIA_BYTES) {
            await mediaResponse.body?.cancel();
            throw new Error(`Media too large: ${declaredSize} bytes`);
          }

          const encryptedData = await mediaResponse.arrayBuffer();
          console.log(`Downloaded ${encryptedData.byteLength} bytes`);
          if (encryptedData.byteLength > MAX_MEDIA_BYTES) {
            throw new Error(`Media too large: ${encryptedData.byteLength} bytes`);
          }

          let finalData: Uint8Array;

          // Decrypt if we have a mediaKey
          if (msg.media_key && encryptedData.byteLength > 10) {
            console.log(`Decrypting media...`);
            try {
              const keyBytes = Uint8Array.from(atob(msg.media_key), c => c.charCodeAt(0));
              
              const mediaTypeInfo: Record<string, string> = {
                'image': 'WhatsApp Image Keys',
                'video': 'WhatsApp Video Keys',
                'audio': 'WhatsApp Audio Keys',
                'document': 'WhatsApp Document Keys',
                'sticker': 'WhatsApp Image Keys',
              };
              
              const normalizedMediaType = msg.media_type || (
                ['image', 'video', 'audio', 'document', 'sticker'].includes(msg.message_type)
                  ? msg.message_type
                  : null
              );
              if (!normalizedMediaType) {
                throw new Error('Media type missing; cannot derive the correct WhatsApp decryption key');
              }
              const info = new TextEncoder().encode(mediaTypeInfo[normalizedMediaType]);
              
              const importedKey = await crypto.subtle.importKey(
                'raw',
                keyBytes,
                { name: 'HKDF' },
                false,
                ['deriveBits']
              );
              
              const derivedBits = await crypto.subtle.deriveBits(
                {
                  name: 'HKDF',
                  hash: 'SHA-256',
                  salt: new Uint8Array(0),
                  info: info,
                },
                importedKey,
                112 * 8
              );
              
              const derivedBytes = new Uint8Array(derivedBits);
              const iv = derivedBytes.slice(0, 16);
              const cipherKey = derivedBytes.slice(16, 48);
              const macKey = derivedBytes.slice(48, 80);
              
              // subarray (view) em vez de slice: evita duplicar o buffer inteiro
              // em memória, o que derrubava o isolate em vídeos grandes.
              const ciphertext = new Uint8Array(encryptedData).subarray(0, -10);
              const receivedMac = new Uint8Array(encryptedData).subarray(-10);
              const macPayload = new Uint8Array(iv.byteLength + ciphertext.byteLength);
              macPayload.set(iv, 0);
              macPayload.set(ciphertext, iv.byteLength);
              const importedMacKey = await crypto.subtle.importKey(
                "raw", macKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
              );
              const calculatedMac = new Uint8Array(await crypto.subtle.sign("HMAC", importedMacKey, macPayload)).subarray(0, 10);
              if (!constantTimeEqual(receivedMac, calculatedMac)) {
                throw new Error("WhatsApp media authentication failed");
              }
              
              const aesKey = await crypto.subtle.importKey(
                'raw',
                cipherKey,
                { name: 'AES-CBC' },
                false,
                ['decrypt']
              );
              
              const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-CBC', iv: iv },
                aesKey,
                ciphertext
              );
              
              finalData = new Uint8Array(decrypted);
              if (!hasExpectedMediaSignature(finalData, msg.media_type, msg.media_mimetype)) {
                throw new Error(`Invalid decrypted ${msg.media_type} format`);
              }
              console.log(`Decrypted: ${finalData.byteLength} bytes`);
            } catch (decryptError) {
              console.error(`Decryption failed:`, decryptError);
              throw new Error(`Media decryption failed: ${String(decryptError)}`);
            }
          } else {
            throw new Error("Missing media key for encrypted WhatsApp media");
          }

          // Upload to storage if data is valid
          if (finalData.byteLength > 100) {
            // Get account_id from conversation
            const { data: convo } = await supabase
              .from("zapp_conversations")
              .select("account_id")
              .eq("id", msg.zapp_conversation_id)
              .single();

            const accountId = convo?.account_id || "unknown";
            const timestamp = Date.now();
            const extension = msg.media_mimetype 
              ? msg.media_mimetype.split("/")[1]?.split(";")[0] || "bin" 
              : (msg.media_type === "image" ? "jpg" : msg.media_type === "video" ? "mp4" : msg.media_type === "audio" ? "ogg" : "bin");
            const fileName = `${accountId}/${msg.media_type}_${timestamp}_${msg.id.substring(0, 8)}.${extension}`;

            const { error: uploadError } = await supabase.storage
              .from("zapp-media")
              .upload(fileName, finalData, {
                contentType: msg.media_mimetype || `${msg.media_type}/*`,
                upsert: false,
              });

            if (uploadError) {
              throw uploadError;
            }

            const { data: publicUrlData } = supabase.storage
              .from("zapp-media")
              .getPublicUrl(fileName);

            const permanentUrl = publicUrlData.publicUrl;

            // Update message with permanent URL
            await supabase
              .from("zapp_messages")
              .update({
                media_url: permanentUrl,
                media_download_status: "completed",
                media_last_error: null,
                updated_at: new Date().toISOString()
              })
              .eq("id", msg.id);

            console.log(`Media uploaded: ${permanentUrl}`);
            return { id: msg.id, success: true, url: permanentUrl };
          } else {
            throw new Error("Data too small after processing");
          }

        } catch (error) {
          const errMsg = String(error);
          console.error(`Error processing message ${msg.id}:`, errMsg);

          const nextAttempts = ((msg.media_download_attempts as number) || 0) + 1;
          const MAX_ATTEMPTS = 10;
          const finalStatus = nextAttempts >= MAX_ATTEMPTS ? "abandoned" : "failed";

          await supabase
            .from("zapp_messages")
            .update({
              media_download_status: finalStatus,
              media_last_error: errMsg.slice(0, 500),
              updated_at: new Date().toISOString()
            })
            .eq("id", msg.id);

          return { id: msg.id, success: false, error: errMsg };
        }
      }));

      
      results.push(...batchResults);
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Processed ${successCount}/${results.length} successfully`);

    return new Response(JSON.stringify({ 
      success: true, 
      processed: results.length,
      successful: successCount,
      results 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in download-media:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
