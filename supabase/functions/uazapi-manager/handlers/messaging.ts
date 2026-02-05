import { corsHeaders } from "../lib/cors.ts";
import type { UazapiRequest, UserData, ExistingWhatsapp, IntegrationConfig, SupabaseClient } from "../lib/types.ts";

interface HandlerContext {
  supabase: SupabaseClient;
  supabaseUrl: string;
  // deno-lint-ignore no-explicit-any
  user: any;
  userData: UserData;
  accountId: string;
  payload: UazapiRequest;
  existingWhatsapp: ExistingWhatsapp | null;
  savedInstanceToken: string | undefined;
  savedInstanceName: string | undefined;
  instanceName: string;
  sector_id: string | undefined;
  integration_id: string | undefined;
  // deno-lint-ignore no-explicit-any
  uazapiAdminRequest: any;
  // deno-lint-ignore no-explicit-any
  uazapiInstanceRequest: any;
  // deno-lint-ignore no-explicit-any
  uazapiInstanceRequestWithRetry: any;
  // deno-lint-ignore no-explicit-any
  logWhatsAppChangeAndNotify: any;
  // deno-lint-ignore no-explicit-any
  configureWebhook: any;
}

export async function handleMessagingAction(ctx: HandlerContext): Promise<unknown | Response> {
  const { 
    supabase, accountId, payload, existingWhatsapp, savedInstanceToken,
    sector_id, uazapiInstanceRequest, uazapiInstanceRequestWithRetry
  } = ctx;
  const { action, phone, message, group_id, mentions, media_url, media_type, caption, file_name } = payload;

  switch (action) {
    case "send_text": {
      if (!savedInstanceToken) {
        throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
      }
      
      if (!phone) {
        throw new Error("Número de telefone é obrigatório");
      }
      
      if (!message) {
        throw new Error("Mensagem é obrigatória");
      }

      const cleanPhone = phone.replace(/\D/g, "");
      console.log(`Sending text to ${cleanPhone}: ${message.substring(0, 50)}...`);

      // Build message body with optional quote (reply) info
      // deno-lint-ignore no-explicit-any
      const messageBody: any = {
        number: cleanPhone,
        text: message,
      };

      // Handle mentions
      if (mentions && mentions.length > 0) {
        messageBody.mentionsEveryOne = mentions.includes("@everyone");
        messageBody.mentioned = mentions.filter((m: string) => m !== "@everyone").map((m: string) => m.replace(/\D/g, ""));
      }

      // Handle quoted message (reply)
      if (payload.quoted_message_id) {
        let actualQuotedId = payload.quoted_message_id;
        if (payload.quoted_message_id.includes(':')) {
          actualQuotedId = payload.quoted_message_id.split(':').pop() || payload.quoted_message_id;
        }
        
        messageBody.quoted = {
          key: {
            id: actualQuotedId,
            fromMe: payload.quoted_from_me ?? false,
            remoteJid: payload.quoted_participant 
              ? `${payload.quoted_participant.replace(/\D/g, "")}@s.whatsapp.net`
              : `${cleanPhone}@s.whatsapp.net`,
          }
        };
        console.log(`[send_text] Including quote for message ${actualQuotedId}, fromMe: ${payload.quoted_from_me}`);
      }

      const sendEndpoints = [
        { url: `/message/sendText`, method: "POST" },
        { url: `/send/text`, method: "POST" },
        { url: `/message/text`, method: "POST" },
      ];

      let sendResult: unknown = null;
      let sent = false;
      
      for (const endpoint of sendEndpoints) {
        if (sent) break;
        try {
          console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
          sendResult = await uazapiInstanceRequestWithRetry(
            endpoint.url, 
            endpoint.method, 
            savedInstanceToken,
            messageBody
          );
          console.log("Send result:", JSON.stringify(sendResult));
          
          const sendData = sendResult as { 
            error?: boolean | string; 
            messageId?: string; 
            key?: { id?: string };
            Message?: { ID?: string };
            id?: string;
          };
          
          if (
            sendData.error === false || 
            sendData.messageId || 
            sendData.key?.id ||
            sendData.id ||
            sendData.Message?.ID
          ) {
            sent = true;
          }
        } catch (err) {
          console.log(`${endpoint.url} failed:`, (err as Error).message);
          // Re-throw permanent errors
          if ((err as Error).message.includes("WHATSAPP_DISCONNECTED")) {
            throw err;
          }
        }
      }

      return sent 
        ? { success: true, message: "Mensagem enviada", data: sendResult }
        : { success: false, message: "Não foi possível enviar a mensagem", lastResult: sendResult };
    }

    case "send_media": {
      if (!savedInstanceToken) {
        throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
      }
      
      if (!phone) {
        throw new Error("Número de telefone é obrigatório");
      }
      
      if (!media_url) {
        throw new Error("URL da mídia é obrigatória");
      }

      const cleanPhone = phone.replace(/\D/g, "");
      console.log(`Sending media to ${cleanPhone}: ${media_url}`);

      const mediaEndpoints = [
        { url: `/message/sendMedia`, method: "POST" },
        { url: `/send/media`, method: "POST" },
        { url: `/message/media`, method: "POST" },
      ];

      let sendMediaResult: unknown = null;
      let mediaSent = false;
      
      for (const endpoint of mediaEndpoints) {
        if (mediaSent) break;
        try {
          console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
          sendMediaResult = await uazapiInstanceRequestWithRetry(
            endpoint.url, 
            endpoint.method, 
            savedInstanceToken,
            {
              number: cleanPhone,
              mediaUrl: media_url,
              mediaType: media_type || "image",
              caption: caption || "",
              fileName: file_name || undefined,
            }
          );
          console.log("Send media result:", JSON.stringify(sendMediaResult));
          
          const mediaData = sendMediaResult as { 
            error?: boolean | string; 
            messageId?: string; 
            key?: { id?: string };
            id?: string;
            Message?: { ID?: string };
          };
          
          if (
            mediaData.error === false || 
            mediaData.messageId || 
            mediaData.key?.id ||
            mediaData.id ||
            mediaData.Message?.ID
          ) {
            mediaSent = true;
          }
        } catch (err) {
          console.log(`${endpoint.url} failed:`, (err as Error).message);
          if ((err as Error).message.includes("WHATSAPP_DISCONNECTED")) {
            throw err;
          }
        }
      }

      return mediaSent 
        ? { success: true, message: "Mídia enviada", data: sendMediaResult }
        : { success: false, message: "Não foi possível enviar a mídia", lastResult: sendMediaResult };
    }

    case "send_to_group": {
      if (!savedInstanceToken) {
        throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
      }
      
      if (!group_id) {
        throw new Error("ID do grupo é obrigatório");
      }
      
      if (!message) {
        throw new Error("Mensagem é obrigatória");
      }

      const groupJid = group_id.includes("@g.us") ? group_id : `${group_id}@g.us`;
      console.log(`Sending to group ${groupJid}: ${message.substring(0, 50)}...`);

      // deno-lint-ignore no-explicit-any
      const groupMessageBody: any = {
        groupJid: groupJid,
        text: message,
      };

      if (mentions && mentions.length > 0) {
        groupMessageBody.mentionsEveryOne = mentions.includes("@everyone");
        groupMessageBody.mentioned = mentions.filter((m: string) => m !== "@everyone").map((m: string) => m.replace(/\D/g, ""));
      }

      if (payload.quoted_message_id) {
        let actualQuotedId = payload.quoted_message_id;
        if (payload.quoted_message_id.includes(':')) {
          actualQuotedId = payload.quoted_message_id.split(':').pop() || payload.quoted_message_id;
        }
        
        groupMessageBody.quoted = {
          key: {
            id: actualQuotedId,
            fromMe: payload.quoted_from_me ?? false,
            remoteJid: groupJid,
            participant: payload.quoted_participant 
              ? `${payload.quoted_participant.replace(/\D/g, "")}@s.whatsapp.net`
              : undefined,
          }
        };
      }

      const groupEndpoints = [
        { url: `/message/sendText`, method: "POST" },
        { url: `/group/sendText`, method: "POST" },
        { url: `/send/text`, method: "POST" },
      ];

      let groupResult: unknown = null;
      let groupSent = false;
      
      for (const endpoint of groupEndpoints) {
        if (groupSent) break;
        try {
          console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
          groupResult = await uazapiInstanceRequestWithRetry(
            endpoint.url, 
            endpoint.method, 
            savedInstanceToken,
            groupMessageBody
          );
          console.log("Group send result:", JSON.stringify(groupResult));
          
          const groupData = groupResult as { 
            error?: boolean | string; 
            messageId?: string; 
            key?: { id?: string };
            id?: string;
            Message?: { ID?: string };
          };
          
          if (
            groupData.error === false || 
            groupData.messageId || 
            groupData.key?.id ||
            groupData.id ||
            groupData.Message?.ID
          ) {
            groupSent = true;
          }
        } catch (err) {
          console.log(`${endpoint.url} failed:`, (err as Error).message);
          if ((err as Error).message.includes("WHATSAPP_DISCONNECTED")) {
            throw err;
          }
        }
      }

      return groupSent 
        ? { success: true, message: "Mensagem enviada ao grupo", data: groupResult }
        : { success: false, message: "Não foi possível enviar ao grupo", lastResult: groupResult };
    }

    case "send_media_to_group": {
      if (!savedInstanceToken) {
        throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
      }
      
      if (!group_id) {
        throw new Error("ID do grupo é obrigatório");
      }
      
      if (!media_url) {
        throw new Error("URL da mídia é obrigatória");
      }

      const groupJid = group_id.includes("@g.us") ? group_id : `${group_id}@g.us`;
      console.log(`Sending media to group ${groupJid}: ${media_url}`);

      const groupMediaEndpoints = [
        { url: `/message/sendMedia`, method: "POST" },
        { url: `/group/sendMedia`, method: "POST" },
        { url: `/send/media`, method: "POST" },
      ];

      let sendMediaResult: unknown = null;
      let mediaSuccess = false;
      
      for (const endpoint of groupMediaEndpoints) {
        if (mediaSuccess) break;
        try {
          console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
          sendMediaResult = await uazapiInstanceRequestWithRetry(
            endpoint.url, 
            endpoint.method, 
            savedInstanceToken,
            {
              groupJid: groupJid,
              mediaUrl: media_url,
              mediaType: media_type || "image",
              caption: caption || "",
              fileName: file_name || undefined,
            }
          );
          console.log("Group media result:", JSON.stringify(sendMediaResult));
          
          const mediaData = sendMediaResult as { 
            error?: boolean | string; 
            messageId?: string; 
            key?: { id?: string };
            id?: string;
            Message?: { ID?: string };
          };
          
          if (
            mediaData.error === false || 
            mediaData.messageId || 
            mediaData.key?.id ||
            mediaData.id ||
            mediaData.Message?.ID
          ) {
            mediaSuccess = true;
          }
        } catch (err) {
          console.log(`${endpoint.url} failed:`, (err as Error).message);
        }
      }

      return mediaSuccess 
        ? { success: true, message: "Mídia enviada com sucesso ao grupo", data: sendMediaResult }
        : { success: false, message: "Não foi possível enviar a mídia ao grupo", lastResult: sendMediaResult };
    }

    case "delete_message": {
      const { message_id, phone: targetPhone } = payload;
      
      console.log("=== DELETE MESSAGE REQUEST ===");
      console.log("External Message ID (raw):", message_id);
      console.log("Target Phone (raw):", targetPhone);
      
      if (!message_id) {
        return new Response(
          JSON.stringify({ error: "message_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let deleteIntQuery = supabase
        .from("integrations")
        .select("config")
        .eq("account_id", accountId)
        .eq("type", "whatsapp");
      
      if (sector_id) {
        deleteIntQuery = deleteIntQuery.eq("sector_id", sector_id);
      }
      
      const { data: integration } = await deleteIntQuery.maybeSingle();

      const instanceToken = (integration?.config as IntegrationConfig)?.instance_token;
      
      if (!instanceToken) {
        return new Response(
          JSON.stringify({ error: "WhatsApp não está conectado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      let actualMessageId = message_id;
      if (message_id.includes(':')) {
        actualMessageId = message_id.split(':').pop() || message_id;
      }
      
      console.log("Original Message ID:", message_id);
      console.log("Actual Message ID (extracted):", actualMessageId);
      
      let deleted = false;
      let result: unknown;
      try {
        result = await uazapiInstanceRequest(`/message/delete`, "POST", instanceToken, { id: actualMessageId });
        console.log(`[delete_message] Delete successful:`, JSON.stringify(result));
        deleted = true;
      } catch (err) {
        const errorMsg = (err as Error).message;
        console.error(`[delete_message] Delete failed:`, errorMsg);
      }
      
      if (!deleted) {
        return { 
          deleted: false, 
          message_id, 
          soft_delete_only: true,
          error: "Não foi possível deletar no WhatsApp - apagada apenas localmente"
        };
      }
      
      return { deleted: true, message_id, success: true };
    }

    case "edit_message": {
      const { message_id, new_content, phone: targetPhone } = payload;
      
      console.log("=== EDIT MESSAGE REQUEST ===");
      console.log("External Message ID (raw):", message_id);
      console.log("New Content:", new_content);
      
      if (!message_id || !new_content) {
        return new Response(
          JSON.stringify({ error: "message_id and new_content are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let editIntQuery = supabase
        .from("integrations")
        .select("config")
        .eq("account_id", accountId)
        .eq("type", "whatsapp");
      
      if (sector_id) {
        editIntQuery = editIntQuery.eq("sector_id", sector_id);
      }
      
      const { data: editIntegration } = await editIntQuery.maybeSingle();

      const editInstanceToken = (editIntegration?.config as IntegrationConfig)?.instance_token;
      
      if (!editInstanceToken) {
        return new Response(
          JSON.stringify({ error: "WhatsApp não está conectado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      let actualEditMessageId = message_id;
      if (message_id.includes(':')) {
        actualEditMessageId = message_id.split(':').pop() || message_id;
      }
      
      console.log("Original Message ID:", message_id);
      console.log("Actual Message ID (extracted):", actualEditMessageId);
      
      let edited = false;
      let result: unknown;
      try {
        result = await uazapiInstanceRequest(`/message/edit`, "POST", editInstanceToken, { 
          id: actualEditMessageId, 
          text: new_content 
        });
        console.log(`[edit_message] Edit successful:`, JSON.stringify(result));
        edited = true;
      } catch (err) {
        const errorMsg = (err as Error).message;
        console.error(`[edit_message] Edit failed:`, errorMsg);
      }
      
      if (!edited) {
        return { 
          edited: false, 
          message_id, 
          soft_edit_only: true,
          error: "Não foi possível editar no WhatsApp - editada apenas localmente"
        };
      }
      
      return { edited: true, message_id, success: true };
    }

    default:
      return new Response(
        JSON.stringify({ error: `Unknown messaging action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
  }
}
