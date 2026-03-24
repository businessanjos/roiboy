import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { message_id, message_ids, account_id: requestedAccountId } = await req.json();
    
    // Support both single message and batch processing
    const idsToProcess = message_ids || (message_id ? [message_id] : []);
    
    if (idsToProcess.length === 0) {
      return new Response(JSON.stringify({ error: "message_id or message_ids required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${idsToProcess.length} media messages for account ${requestedAccountId || 'any'}`);

    // Calculate 5 minutes ago for stuck downloading detection
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // SECURITY: Build query with optional account_id filter
    // Include: pending, OR downloading stuck for >5 min
    let messagesQuery = supabase
      .from("zapp_messages")
      .select("id, account_id, media_type, media_encrypted_url, media_key, media_mimetype, zapp_conversation_id, media_download_status, updated_at")
      .in("id", idsToProcess)
      .not("media_encrypted_url", "is", null);
    
    // SECURITY: If account_id provided, filter to prevent cross-account access
    if (requestedAccountId) {
      messagesQuery = messagesQuery.eq("account_id", requestedAccountId);
    }
    
    // Fetch messages that need processing
    const { data: allMessages, error: fetchError } = await messagesQuery;

    if (fetchError) {
      console.error("Error fetching messages:", fetchError);
      throw fetchError;
    }

    // Filter to only those that need processing:
    // - pending or null status (null = webhook didn't set status)
    // - downloading status but stuck (updated_at > 5 min ago)
    const messages = (allMessages || []).filter((msg: any) => {
      if (!msg.media_download_status || msg.media_download_status === "pending") return true;
      if (msg.media_download_status === "downloading") {
        return msg.updated_at && msg.updated_at < fiveMinutesAgo;
      }
      // Also retry "failed" if explicitly requested
      if (msg.media_download_status === "failed") return true;
      return false;
    });

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        processed: 0, 
        message: "No pending media to download" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${messages.length} messages with pending/stuck media (filtered from ${allMessages?.length || 0})`);

    const results: { id: string; success: boolean; url?: string; error?: string }[] = [];

    // Process in batches of 8 for faster throughput (each has 30s individual timeout)
    const batchSize = 8;
    
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchResults = await Promise.all(batch.map(async (msg: any) => {
        try {
          // Mark as downloading
          await supabase
            .from("zapp_messages")
            .update({ 
              media_download_status: "downloading",
              updated_at: new Date().toISOString()
            })
            .eq("id", msg.id);

          console.log(`Downloading media for message ${msg.id}...`);

          // Download encrypted media with timeout
          const mediaResponse = await downloadWithTimeout(msg.media_encrypted_url, 30000);
          
          if (!mediaResponse.ok) {
            throw new Error(`Download failed: ${mediaResponse.status}`);
          }

          const encryptedData = await mediaResponse.arrayBuffer();
          console.log(`Downloaded ${encryptedData.byteLength} bytes`);

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
              
              const info = new TextEncoder().encode(mediaTypeInfo[msg.media_type] || 'WhatsApp Image Keys');
              
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
              
              const ciphertext = new Uint8Array(encryptedData).slice(0, -10);
              
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
              console.log(`Decrypted: ${finalData.byteLength} bytes`);
            } catch (decryptError) {
              console.error(`Decryption failed:`, decryptError);
              finalData = new Uint8Array(encryptedData);
            }
          } else {
            finalData = new Uint8Array(encryptedData);
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
                updated_at: new Date().toISOString()
              })
              .eq("id", msg.id);

            console.log(`Media uploaded: ${permanentUrl}`);
            return { id: msg.id, success: true, url: permanentUrl };
          } else {
            throw new Error("Data too small after processing");
          }

        } catch (error) {
          console.error(`Error processing message ${msg.id}:`, error);
          
          // Mark as failed
          await supabase
            .from("zapp_messages")
            .update({ 
              media_download_status: "failed",
              updated_at: new Date().toISOString()
            })
            .eq("id", msg.id);

          return { id: msg.id, success: false, error: String(error) };
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
