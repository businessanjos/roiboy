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

export async function handleSyncAction(ctx: HandlerContext): Promise<unknown | Response> {
  const { 
    supabase, accountId, payload, savedInstanceToken, sector_id, integration_id,
    uazapiInstanceRequest
  } = ctx;
  const { action } = payload;

  switch (action) {
    case "import-conversations": {
      if (!savedInstanceToken) {
        throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
      }
      
      console.log("Importing conversations from WhatsApp...");
      
      // deno-lint-ignore no-explicit-any
      let chats: any[] = [];
      
      const chatEndpoints = [
        `/chat/fetchChats`,
        `/chat/findChats`,
        `/chats`,
        `/chat/list`,
      ];

      for (const url of chatEndpoints) {
        try {
          console.log(`Trying: GET ${url}`);
          const chatsResult = await uazapiInstanceRequest(url, "GET", savedInstanceToken);
          console.log("Chats result:", JSON.stringify(chatsResult).substring(0, 1000));
          
          if (Array.isArray(chatsResult)) {
            chats = chatsResult;
          } else if ((chatsResult as { chats?: unknown[] })?.chats) {
            chats = (chatsResult as { chats: unknown[] }).chats as typeof chats;
          } else if ((chatsResult as { data?: unknown[] })?.data) {
            chats = (chatsResult as { data: unknown[] }).data as typeof chats;
          }
          
          if (chats.length > 0) {
            console.log(`Found ${chats.length} chats via GET ${url}`);
            break;
          }
        } catch (err) {
          console.log(`GET ${url} failed:`, (err as Error).message);
        }
      }
      
      console.log(`Total chats found from WhatsApp API: ${chats.length}`);

      // Filter out groups, status broadcasts, etc. to keep only direct chats
      const directChats = chats.filter(c => {
        const chatId = c.id || c.jid || c.chatId || "";
        return chatId.includes("@s.whatsapp.net") && !chatId.includes("status@");
      });
      
      console.log(`Direct chats (1:1): ${directChats.length}`);
      
      // Get default department for this account
      const { data: defaultDept } = await supabase
        .from("departments")
        .select("id")
        .eq("account_id", accountId)
        .eq("is_default", true)
        .maybeSingle();
      
      const importDepartmentId = defaultDept?.id;
      
      let imported = 0;
      let skipped = 0;
      
      for (const chat of directChats) {
        const chatId = chat.id || chat.jid || chat.chatId || "";
        const chatPhone = chatId.replace("@s.whatsapp.net", "").replace(/\D/g, "");
        const contactName = chat.name || chat.pushName || chat.verifiedName || chatPhone;
        const isGroup = chatId.includes("@g.us");
        const groupJid = isGroup ? chatId : null;
        
        // Check if conversation already exists
        let existingConvoId: string | null = null;
        
        if (isGroup) {
          let groupQuery = supabase
            .from("zapp_conversations")
            .select("id")
            .eq("account_id", accountId)
            .eq("group_jid", groupJid)
            .eq("is_group", true);
          
          if (sector_id) {
            groupQuery = groupQuery.eq("sector_id", sector_id);
          }
          
          const { data } = await groupQuery.maybeSingle();
          existingConvoId = data?.id || null;
        } else {
          let directQuery = supabase
            .from("zapp_conversations")
            .select("id")
            .eq("account_id", accountId)
            .eq("phone_e164", chatPhone)
            .eq("is_group", false);
          
          if (sector_id) {
            directQuery = directQuery.eq("sector_id", sector_id);
          }
          
          const { data } = await directQuery.maybeSingle();
          existingConvoId = data?.id || null;
        }
        
        if (existingConvoId) {
          // Conversation exists - check if it needs to be assigned to this department
          if (importDepartmentId) {
            const { data: existingAssignment } = await supabase
              .from("zapp_conversation_assignments")
              .select("id, department_id")
              .eq("zapp_conversation_id", existingConvoId)
              .maybeSingle();
            
            if (!existingAssignment) {
              await supabase
                .from("zapp_conversation_assignments")
                .insert({
                  account_id: accountId,
                  zapp_conversation_id: existingConvoId,
                  department_id: importDepartmentId,
                  status: "waiting",
                });
            }
          }
          skipped++;
          continue;
        }
        
        // Find client if exists (only for direct messages)
        let clientId = null;
        if (!isGroup && chatPhone) {
          const { data: existingClient } = await supabase
            .from("clients")
            .select("id")
            .eq("account_id", accountId)
            .eq("phone_e164", chatPhone)
            .maybeSingle();
          clientId = existingClient?.id || null;
        }
        
        // Create conversation with sector_id for multi-tenant isolation
        const { data: newConvo, error: convoError } = await supabase
          .from("zapp_conversations")
          .insert({
            account_id: accountId,
            client_id: clientId,
            phone_e164: isGroup ? "" : chatPhone,
            contact_name: contactName,
            channel: "whatsapp",
            external_thread_id: chat.id || null,
            is_group: isGroup,
            group_jid: groupJid,
            sector_id: sector_id || null,
            last_message_at: chat.wa_lastMsgTimestamp 
              ? new Date(chat.wa_lastMsgTimestamp * 1000).toISOString() 
              : new Date().toISOString(),
            unread_count: 0,
          })
          .select("id")
          .single();
        
        if (convoError) {
          console.error(`Error creating conversation for ${contactName}:`, convoError);
          continue;
        }
        
        // Create assignment for queue with department
        if (newConvo && importDepartmentId) {
          await supabase
            .from("zapp_conversation_assignments")
            .insert({
              account_id: accountId,
              zapp_conversation_id: newConvo.id,
              department_id: importDepartmentId,
              status: "waiting",
            });
          imported++;
        }
      }
      
      return { imported, skipped, total: chats.length, sector_id, department_id: importDepartmentId };
    }

    case "sync-chat-history": {
      console.log("=== SYNC CHAT HISTORY ===");
      
      const daysToSync = payload.days || 7;
      const targetIntegrationId = integration_id;
      
      if (!targetIntegrationId) {
        return new Response(
          JSON.stringify({ error: "integration_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const { data: syncIntegration, error: syncIntError } = await supabase
        .from("integrations")
        .select("id, config, sector_id, account_id, status")
        .eq("id", targetIntegrationId)
        .eq("account_id", accountId)
        .single();
      
      if (syncIntError || !syncIntegration) {
        return new Response(
          JSON.stringify({ error: "Integração não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const syncInstanceToken = (syncIntegration.config as IntegrationConfig)?.instance_token;
      
      if (!syncInstanceToken) {
        return new Response(
          JSON.stringify({ error: "Token de instância não encontrado - reconecte o WhatsApp" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`[sync-chat-history] Integration: ${targetIntegrationId}, Days: ${daysToSync}`);
      
      const { data: activeConversations, error: convError } = await supabase
        .from("zapp_conversations")
        .select("id, phone_e164, group_jid, is_group, contact_name")
        .eq("integration_id", targetIntegrationId)
        .eq("account_id", accountId);
      
      if (convError) {
        console.error("[sync-chat-history] Error fetching conversations:", convError.message);
        return new Response(
          JSON.stringify({ error: "Erro ao buscar conversas" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`[sync-chat-history] Found ${activeConversations?.length || 0} conversations to sync`);
      
      let syncedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToSync);
      const cutoffTimestamp = cutoffDate.getTime();
      
      for (const conversation of (activeConversations || [])) {
        try {
          const chatId = conversation.is_group 
            ? conversation.group_jid 
            : `${conversation.phone_e164.replace('+', '')}@s.whatsapp.net`;
          
          if (!chatId) {
            console.log(`[sync-chat-history] Skipping conversation ${conversation.id} - no chatId`);
            continue;
          }
          
          console.log(`[sync-chat-history] Fetching messages for ${chatId}`);
          
          // deno-lint-ignore no-explicit-any
          let messagesData: any = null;
          
          try {
            messagesData = await uazapiInstanceRequest(
              `/chat/fetchMessages/${encodeURIComponent(chatId)}`,
              "POST",
              syncInstanceToken,
              { limit: 100 }
            );
          } catch (e) {
            console.log(`[sync-chat-history] fetchMessages failed: ${(e as Error).message}`);
          }
          
          if (!messagesData || !Array.isArray(messagesData)) {
            try {
              messagesData = await uazapiInstanceRequest(
                `/chat/messages/${encodeURIComponent(chatId)}`,
                "GET",
                syncInstanceToken
              );
            } catch (e) {
              console.log(`[sync-chat-history] chat/messages failed: ${(e as Error).message}`);
            }
          }
          
          if (!messagesData || !Array.isArray(messagesData)) {
            try {
              messagesData = await uazapiInstanceRequest(
                `/messages/list`,
                "POST",
                syncInstanceToken,
                { chatId, limit: 100 }
              );
            } catch (e) {
              console.log(`[sync-chat-history] messages/list failed: ${(e as Error).message}`);
            }
          }
          
          // deno-lint-ignore no-explicit-any
          let messages: any[] = [];
          if (Array.isArray(messagesData)) {
            messages = messagesData;
          } else if (messagesData?.messages && Array.isArray(messagesData.messages)) {
            messages = messagesData.messages;
          } else if (messagesData?.data && Array.isArray(messagesData.data)) {
            messages = messagesData.data;
          }
          
          console.log(`[sync-chat-history] Got ${messages.length} messages for ${chatId}`);
          
          for (const msg of messages) {
            try {
              const messageId = msg.key?.id || msg.id || msg.messageId;
              const messageTimestamp = msg.messageTimestamp || msg.timestamp || msg.created_at;
              const fromMe = msg.key?.fromMe ?? msg.fromMe ?? false;
              
              let msgTime: number;
              if (typeof messageTimestamp === 'string') {
                msgTime = new Date(messageTimestamp).getTime();
              } else if (messageTimestamp > 1000000000000) {
                msgTime = messageTimestamp;
              } else {
                msgTime = messageTimestamp * 1000;
              }
              
              if (msgTime < cutoffTimestamp) {
                skippedCount++;
                continue;
              }
              
              const messageContent = msg.message?.conversation || 
                                    msg.message?.extendedTextMessage?.text ||
                                    msg.text ||
                                    msg.body ||
                                    "";
              
              if (!messageContent) {
                skippedCount++;
                continue;
              }
              
              const { data: existingMsg } = await supabase
                .from("zapp_messages")
                .select("id")
                .eq("external_id", messageId)
                .eq("zapp_conversation_id", conversation.id)
                .maybeSingle();
              
              if (existingMsg) {
                skippedCount++;
                continue;
              }
              
              const { error: insertError } = await supabase
                .from("zapp_messages")
                .insert({
                  zapp_conversation_id: conversation.id,
                  external_id: messageId,
                  direction: fromMe ? "outgoing" : "incoming",
                  content: messageContent,
                  content_type: "text",
                  status: "delivered",
                  sent_at: new Date(msgTime).toISOString(),
                  created_at: new Date().toISOString(),
                });
              
              if (insertError) {
                console.log(`[sync-chat-history] Failed to insert message: ${insertError.message}`);
                errorCount++;
              } else {
                syncedCount++;
              }
            } catch (msgErr) {
              console.log(`[sync-chat-history] Error processing message: ${(msgErr as Error).message}`);
              errorCount++;
            }
          }
        } catch (convErr) {
          const errMsg = (convErr as Error).message;
          console.log(`[sync-chat-history] Error syncing conversation ${conversation.id}: ${errMsg}`);
          errors.push(`${conversation.contact_name}: ${errMsg}`);
          errorCount++;
        }
      }
      
      console.log(`[sync-chat-history] Complete: ${syncedCount} synced, ${skippedCount} skipped, ${errorCount} errors`);
      
      return {
        success: true,
        synced: syncedCount,
        skipped: skippedCount,
        errors: errorCount,
        error_details: errors.length > 0 ? errors.slice(0, 5) : undefined,
        message: `Sincronização concluída: ${syncedCount} mensagens importadas, ${skippedCount} ignoradas, ${errorCount} erros`,
      };
    }

    default:
      return new Response(
        JSON.stringify({ error: `Unknown sync action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
  }
}
