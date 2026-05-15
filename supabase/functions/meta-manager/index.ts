import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_API_URL = "https://graph.facebook.com/v21.0";

async function metaApi(endpoint: string, method: string, token: string, body?: unknown) {
  const url = `${META_API_URL}${endpoint}`;
  console.log(`[meta-manager] ${method} ${url}`);
  
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseText = await response.text();
  console.log(`[meta-manager] Response: ${response.status} - ${responseText.substring(0, 300)}`);

  let json: any;
  try {
    json = JSON.parse(responseText);
  } catch {
    throw new Error(`Invalid Meta API response: ${responseText.substring(0, 200)}`);
  }

  if (json.error) {
    throw new Error(`Meta API error: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}

// Upload media to Meta and get media ID
async function uploadMediaToMeta(phoneNumberId: string, token: string, mediaUrl: string, mimeType: string): Promise<string> {
  // First download the media from the URL
  const mediaResponse = await fetch(mediaUrl);
  if (!mediaResponse.ok) throw new Error(`Failed to download media: ${mediaResponse.status}`);
  const mediaBlob = await mediaResponse.blob();

  const formData = new FormData();
  formData.append("file", mediaBlob, "media");
  formData.append("messaging_product", "whatsapp");
  formData.append("type", mimeType);

  const url = `${META_API_URL}/${phoneNumberId}/media`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` },
    body: formData,
  });

  const result = await response.json();
  if (result.error) throw new Error(`Media upload error: ${result.error.message}`);
  return result.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const tokenJwt = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(tokenJwt);
    if (authError || !authData?.user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: userData } = await supabase.from("users").select("id, name, account_id").eq("auth_user_id", authData.user.id).single();
    if (!userData) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const payload = await req.json();
    const { action, sector_id, phone, message, group_id, integration_id, media_url, media_type, caption, file_name } = payload;
    const accountId = userData.account_id;

    console.log(`[meta-manager] Action: ${action}, integration_id: ${integration_id}, sector_id: ${sector_id}`);

    // Test mode: bypass integration lookup, use provided phone_number_id + env token
    const testPhoneNumberId = payload.test_phone_number_id;
    let intData: any = null;
    if (testPhoneNumberId) {
      intData = { id: null, config: { provider: "meta_official", phone_number_id: testPhoneNumberId }, status: "disconnected" };
    } else if (integration_id) {
      const { data } = await supabase.from("integrations").select("id, config, status")
        .eq("id", integration_id).eq("account_id", accountId)
        .single();
      intData = data;
    } else if (sector_id) {
      const { data } = await supabase.from("integrations").select("id, config, status")
        .eq("account_id", accountId).eq("type", "whatsapp")
        .eq("sector_id", sector_id)
        .filter("config->>provider", "eq", "meta_official")
        .limit(1);
      intData = data?.[0] || null;
    }

    if (!intData || intData.config?.provider !== "meta_official") {
      return new Response(JSON.stringify({ error: "Meta WhatsApp integration not found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const metaToken = intData.config?.meta_token || Deno.env.get("META_WHATSAPP_TOKEN");
    const phoneNumberId = intData.config?.phone_number_id || Deno.env.get("META_WHATSAPP_PHONE_NUMBER_ID");
    const wabaId = intData.config?.waba_id || Deno.env.get("META_WHATSAPP_WABA_ID");

    if (!metaToken || !phoneNumberId) {
      return new Response(JSON.stringify({ error: "Meta API credentials not configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let result: any = { success: true };

    // ============================================
    // UPDATE CONFIG (e.g. set waba_id)
    // ============================================
    if (action === "update_config") {
      if (!intData.id) {
        return new Response(JSON.stringify({ error: "Cannot update test integration" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const patch = payload.config_patch || {};
      const newConfig = { ...(intData.config || {}), ...patch };
      const { error: upErr } = await supabase.from("integrations").update({ config: newConfig }).eq("id", intData.id);
      if (upErr) throw new Error(`Failed to update config: ${upErr.message}`);
      result = { success: true, config: newConfig };

    // ============================================
    // REGISTER PHONE NUMBER ON CLOUD API
    // ============================================
    } else if (action === "register_phone") {
      const pin = payload.pin;
      if (!pin || !/^\d{6}$/.test(String(pin))) {
        return new Response(JSON.stringify({ error: "PIN deve ter exatamente 6 dígitos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const regResp = await metaApi(`/${phoneNumberId}/register`, "POST", metaToken, {
        messaging_product: "whatsapp",
        pin: String(pin),
      });
      result = { success: true, response: regResp };

    // ============================================
    // LIST TEMPLATES
    // ============================================
    } else if (action === "list_templates") {
      if (!wabaId) {
        result = {
          templates: [],
          needs_waba_id: true,
          code: "missing_waba_id",
          message: "WABA ID não configurado. Informe o WhatsApp Business Account ID na integração.",
        };
      } else {
        const tplResp = await metaApi(`/${wabaId}/message_templates?limit=100&fields=name,language,status,category,components`, "GET", metaToken);
        const all = tplResp.data || [];
        const approved = all.filter((t: any) => t.status === "APPROVED");
        const others = all.filter((t: any) => t.status !== "APPROVED").map((t: any) => ({ name: t.name, status: t.status, language: t.language }));
        result = { templates: approved, all_count: all.length, non_approved: others };
      }

    // ============================================
    // SEND TEMPLATE
    // ============================================
    } else if (action === "send_template") {
      const cleanPhone = phone?.replace(/\D/g, "");
      if (!cleanPhone || cleanPhone.length < 10) {
        return new Response(JSON.stringify({ error: "Número de telefone inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { template_name, template_language, body_params } = payload;
      if (!template_name || !template_language) {
        return new Response(JSON.stringify({ error: "template_name e template_language são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const components: any[] = [];
      if (Array.isArray(body_params) && body_params.length > 0) {
        components.push({
          type: "body",
          parameters: body_params.map((v: any) => {
            // Support: string (positional), { text }, or { name, text } (named)
            if (typeof v === "string") return { type: "text", text: v };
            if (v && typeof v === "object") {
              if (v.name) return { type: "text", parameter_name: String(v.name), text: String(v.text ?? "") };
              return { type: "text", text: String(v.text ?? "") };
            }
            return { type: "text", text: String(v ?? "") };
          }),
        });
      }
      const messageBody: any = {
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "template",
        template: {
          name: template_name,
          language: { code: template_language },
          ...(components.length > 0 ? { components } : {}),
        },
      };
      result = await metaApi(`/${phoneNumberId}/messages`, "POST", metaToken, messageBody);

      // Persist outbound template message into conversation history
      try {
        const externalMessageId = result?.messages?.[0]?.id || null;
        const chatJid = `${cleanPhone}@s.whatsapp.net`;

        // Find or create conversation
        let { data: conv } = await supabase
          .from("zapp_conversations")
          .select("id")
          .eq("account_id", accountId)
          .eq("phone_jid", chatJid)
          .eq("integration_id", intData.id)
          .limit(1)
          .maybeSingle();

        if (!conv && intData.id) {
          // Try to match client/lead by phone
          let clientId: string | null = null;
          let leadId: string | null = null;
          const phoneVariants = [cleanPhone, cleanPhone.replace(/^55/, "")];
          for (const pv of phoneVariants) {
            const { data: c } = await supabase.from("clients").select("id")
              .eq("account_id", accountId).or(`phone.eq.${pv},phone.eq.+${pv}`).limit(1).maybeSingle();
            if (c) { clientId = c.id; break; }
          }
          if (!clientId) {
            for (const pv of phoneVariants) {
              const { data: l } = await supabase.from("leads").select("id")
                .eq("account_id", accountId).or(`phone.eq.${pv},phone.eq.+${pv}`).limit(1).maybeSingle();
              if (l) { leadId = l.id; break; }
            }
          }

          const { data: newConv } = await supabase
            .from("zapp_conversations")
            .insert({
              account_id: accountId,
              phone_jid: chatJid,
              phone_e164: cleanPhone,
              contact_name: cleanPhone,
              integration_id: intData.id,
              client_id: clientId,
              lead_id: leadId,
              last_message_at: new Date().toISOString(),
              last_message_preview: `[Template] ${template_name}`,
              unread_count: 0,
              is_group: false,
            })
            .select("id")
            .single();
          conv = newConv;
        }

        if (conv) {
          const previewText = `[Template: ${template_name}]${
            Array.isArray(body_params) && body_params.length > 0
              ? " " + body_params.map((p: any) => typeof p === "string" ? p : (p?.text ?? "")).join(" | ")
              : ""
          }`;
          await supabase.from("zapp_messages").insert({
            account_id: accountId,
            zapp_conversation_id: conv.id,
            direction: "outbound",
            content: previewText,
            message_type: "template",
            external_message_id: externalMessageId,
            sender_phone: cleanPhone,
            sender_name: userData.name,
            sender_user_id: userData.id,
            delivery_status: "sent",
            sent_at: new Date().toISOString(),
          });
          await supabase.from("zapp_conversations")
            .update({
              last_message_at: new Date().toISOString(),
              last_message_preview: previewText.substring(0, 100),
            })
            .eq("id", conv.id);
        }
      } catch (persistErr) {
        console.error("[meta-manager] Failed to persist template message:", persistErr);
      }

    } else { const _placeholder = true;

    // ============================================
    // STATUS CHECK
    // ============================================
    if (action === "status") {
      try {
        // Check if we can reach the Meta API with this token
        const phoneInfo = await metaApi(`/${phoneNumberId}`, "GET", metaToken);
        result = {
          state: "connected",
          connected: true,
          owner: phoneInfo.display_phone_number || phoneInfo.verified_name || phoneNumberId,
          provider: "meta_official",
          phone_number: phoneInfo.display_phone_number,
          verified_name: phoneInfo.verified_name,
          quality_rating: phoneInfo.quality_rating,
        };

        // Update integration status
        if (intData.id) {
          await supabase.from("integrations").update({ status: "connected" }).eq("id", intData.id);
        }
      } catch (err) {
        console.error("[meta-manager] Status check failed:", err);
        result = { state: "disconnected", connected: false, error: (err as Error).message };

        if (intData.id) {
          await supabase.from("integrations").update({ status: "disconnected" }).eq("id", intData.id);
        }
      }

    // ============================================
    // SEND TEXT
    // ============================================
    } else if (action === "send_text") {
      const cleanPhone = phone?.replace(/\D/g, "");
      if (!cleanPhone || cleanPhone.length < 10) {
        return new Response(JSON.stringify({ error: "Número de telefone inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const messageBody: any = {
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "text",
        text: { body: message },
      };

      // Reply context
      if (payload.quoted_message_id) {
        messageBody.context = { message_id: payload.quoted_message_id };
      }

      result = await metaApi(`/${phoneNumberId}/messages`, "POST", metaToken, messageBody);

    // ============================================
    // SEND MEDIA
    // ============================================
    } else if (action === "send_media") {
      const cleanPhone = phone?.replace(/\D/g, "");
      if (!cleanPhone || cleanPhone.length < 10) {
        return new Response(JSON.stringify({ error: "Número de telefone inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const mType = media_type || "image";
      let metaMediaType = mType;
      if (mType === "ptt") metaMediaType = "audio";

      const messageBody: any = {
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: metaMediaType,
      };

      // For media, Meta accepts either a media ID or a link
      const mediaContent: any = { link: media_url };
      if (caption) mediaContent.caption = caption;
      if (file_name) mediaContent.filename = file_name;

      messageBody[metaMediaType] = mediaContent;

      if (payload.quoted_message_id) {
        messageBody.context = { message_id: payload.quoted_message_id };
      }

      result = await metaApi(`/${phoneNumberId}/messages`, "POST", metaToken, messageBody);

    // ============================================
    // SEND TO GROUP (Meta doesn't support groups natively the same way)
    // For Meta Cloud API, groups are handled differently - messages go to individual numbers
    // ============================================
    } else if (action === "send_to_group") {
      return new Response(JSON.stringify({ error: "Meta Cloud API does not support sending to WhatsApp groups directly. Use UAZAPI for group messaging." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ============================================
    // DELETE MESSAGE
    // ============================================
    } else if (action === "delete_message") {
      // Meta doesn't support deleting messages via API
      return new Response(JSON.stringify({ error: "Meta Cloud API does not support message deletion" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ============================================
    // DOWNLOAD MEDIA (get media URL from Meta media ID)
    // ============================================
    } else if (action === "download_media") {
      const mediaId = payload.media_id;
      if (!mediaId) {
        return new Response(JSON.stringify({ error: "media_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get media URL from Meta
      const mediaInfo = await metaApi(`/${mediaId}`, "GET", metaToken);
      
      // Download the actual media file
      const mediaResponse = await fetch(mediaInfo.url, {
        headers: { "Authorization": `Bearer ${metaToken}` },
      });

      if (!mediaResponse.ok) {
        throw new Error(`Failed to download media: ${mediaResponse.status}`);
      }

      // Upload to Supabase storage
      const blob = await mediaResponse.blob();
      const extension = (mediaInfo.mime_type || "application/octet-stream").split("/")[1] || "bin";
      const storagePath = `zapp-media/${accountId}/${mediaId}.${extension}`;

      const { error: uploadErr } = await supabase.storage
        .from("zapp-media")
        .upload(storagePath, blob, { contentType: mediaInfo.mime_type, upsert: true });

      if (uploadErr) {
        console.error("[meta-manager] Storage upload error:", uploadErr.message);
        throw new Error(`Storage upload failed: ${uploadErr.message}`);
      }

      const { data: publicUrl } = supabase.storage.from("zapp-media").getPublicUrl(storagePath);

      result = { url: publicUrl.publicUrl, mime_type: mediaInfo.mime_type };

    } else {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    } // end outer placeholder else

    // Normalize response to match uazapi-manager format
    const normalizedResult: any = { ...result };
    if (result.messages && result.messages[0]) {
      normalizedResult.id = result.messages[0].id;
      normalizedResult.messageid = result.messages[0].id;
    }

    return new Response(JSON.stringify({ data: normalizedResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[meta-manager] Error:", err);
    const message = (err as Error).message || "Unknown error";
    let code: string | undefined;
    const m = message.match(/\(#(\d+)\)/);
    if (m) code = `meta_${m[1]}`;
    if (/Account not registered/i.test(message)) code = "phone_not_registered";
    return new Response(JSON.stringify({ error: message, code }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
