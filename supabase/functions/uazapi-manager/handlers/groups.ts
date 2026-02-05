import { corsHeaders } from "../lib/cors.ts";
import type { UazapiRequest, UserData, ExistingWhatsapp, SupabaseClient } from "../lib/types.ts";

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

export async function handleGroupAction(ctx: HandlerContext): Promise<unknown | Response> {
  const { 
    supabase, accountId, payload, savedInstanceToken, uazapiInstanceRequest
  } = ctx;
  const { action, group_id, group_name, participants, groups } = payload;

  switch (action) {
    case "list_groups": {
      if (!savedInstanceToken) {
        throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
      }

      console.log("Listing groups...");
      
      // deno-lint-ignore no-explicit-any
      let groupsList: any[] = [];
      
      const getEndpoints = [
        `/group/fetchAllGroups`,
        `/group/participatesGroups`,
        `/groups`,
        `/group/list`,
      ];

      for (const url of getEndpoints) {
        try {
          console.log(`Trying: GET ${url}`);
          const groupsResult = await uazapiInstanceRequest(url, "GET", savedInstanceToken);
          console.log("Groups result:", JSON.stringify(groupsResult).substring(0, 1000));
          
          if (Array.isArray(groupsResult)) {
            groupsList = groupsResult;
          } else if ((groupsResult as { groups?: unknown[] })?.groups) {
            groupsList = (groupsResult as { groups: unknown[] }).groups;
          } else if ((groupsResult as { data?: unknown[] })?.data) {
            groupsList = (groupsResult as { data: unknown[] }).data;
          } else if ((groupsResult as { chats?: unknown[] })?.chats) {
            const chats = (groupsResult as { chats: Array<{ id?: string; jid?: string }> }).chats;
            groupsList = chats.filter(c => (c.id || c.jid || "").includes("@g.us"));
          }
          
          if (groupsList.length > 0) {
            console.log(`Found ${groupsList.length} groups via GET ${url}`);
            break;
          }
        } catch (err) {
          console.log(`GET ${url} failed:`, (err as Error).message);
        }
      }

      // Normalize group data
      // deno-lint-ignore no-explicit-any
      const normalizedGroups = groupsList.map((g: any) => ({
        group_jid: g.JID || g.jid || g.id || "",
        name: g.Name || g.name || g.Subject || g.subject || "",
        participant_count: g.Participants?.length || g.participants?.length || g.Size || g.size || 0,
      })).filter(g => g.group_jid && g.group_jid.includes("@g.us"));

      return { groups: normalizedGroups };
    }

    case "sync_groups": {
      if (!savedInstanceToken) {
        throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
      }

      console.log("Syncing groups to database...");
      
      // deno-lint-ignore no-explicit-any
      let groupsList: any[] = [];
      
      const getEndpoints = [
        `/group/fetchAllGroups`,
        `/group/participatesGroups`,
        `/groups`,
      ];

      for (const url of getEndpoints) {
        try {
          console.log(`Trying: GET ${url}`);
          const groupsResult = await uazapiInstanceRequest(url, "GET", savedInstanceToken);
          
          if (Array.isArray(groupsResult)) {
            groupsList = groupsResult;
          } else if ((groupsResult as { groups?: unknown[] })?.groups) {
            groupsList = (groupsResult as { groups: unknown[] }).groups;
          } else if ((groupsResult as { data?: unknown[] })?.data) {
            groupsList = (groupsResult as { data: unknown[] }).data;
          }
          
          if (groupsList.length > 0) {
            console.log(`Found ${groupsList.length} groups via GET ${url}`);
            break;
          }
        } catch (err) {
          console.log(`GET ${url} failed:`, (err as Error).message);
        }
      }

      console.log(`Total groups found from WhatsApp API: ${groupsList.length}`);

      let synced = 0;
      let errors = 0;
      
      for (const g of groupsList) {
        // deno-lint-ignore no-explicit-any
        const group = g as any;
        
        const groupJid = group.JID || group.jid || group.id || "";
        const groupName = group.Name || group.name || group.Subject || group.subject || "";
        const participantCount = group.Participants?.length || group.participants?.length || group.Size || group.size || 0;
        
        if (groupJid && groupJid.includes("@g.us")) {
          try {
            await supabase
              .from("whatsapp_groups")
              .upsert({
                account_id: accountId,
                group_jid: groupJid,
                name: groupName,
                participant_count: participantCount,
              }, { onConflict: "account_id,group_jid" });
            synced++;
          } catch (err) {
            console.log(`Error saving group ${groupJid}:`, (err as Error).message);
            errors++;
          }
        }
      }

      console.log(`Sync complete: ${synced} synced, ${errors} errors`);
      
      return { 
        success: true, 
        synced, 
        errors,
        total: groupsList.length,
        message: `${synced} grupo(s) sincronizado(s)${errors > 0 ? `, ${errors} erro(s)` : ""}` 
      };
    }

    case "save_selected_groups": {
      const groupsToSave = groups || [];
      
      if (groupsToSave.length === 0) {
        throw new Error("Nenhum grupo selecionado para salvar");
      }

      console.log(`Saving ${groupsToSave.length} selected groups...`);
      
      let saved = 0;
      let errors = 0;
      
      for (const group of groupsToSave) {
        try {
          await supabase
            .from("whatsapp_groups")
            .upsert({
              account_id: accountId,
              group_jid: group.group_jid,
              name: group.name,
              participant_count: group.participant_count,
            }, { onConflict: "account_id,group_jid" });
          saved++;
        } catch (err) {
          console.log(`Error saving group ${group.group_jid}:`, (err as Error).message);
          errors++;
        }
      }

      console.log(`Save complete: ${saved} saved, ${errors} errors`);
      
      return { 
        success: true, 
        saved, 
        errors,
        message: `${saved} grupo(s) salvo(s)${errors > 0 ? `, ${errors} erro(s)` : ""}` 
      };
    }

    case "create_group": {
      if (!savedInstanceToken) {
        throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
      }
      
      if (!group_name) {
        throw new Error("Nome do grupo é obrigatório");
      }
      
      if (!participants || participants.length === 0) {
        throw new Error("Pelo menos um participante é obrigatório");
      }

      console.log(`Creating group: ${group_name} with ${participants.length} participants`);
      
      const cleanParticipants = participants.map(p => p.replace(/\D/g, ""));
      
      let createGroupResult: unknown = null;
      const createEndpoints = [
        { url: `/group/create`, method: "POST" },
        { url: `/groups/create`, method: "POST" },
      ];

      for (const endpoint of createEndpoints) {
        try {
          console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
          createGroupResult = await uazapiInstanceRequest(
            endpoint.url, 
            endpoint.method, 
            savedInstanceToken,
            { 
              subject: group_name, 
              participants: cleanParticipants,
              name: group_name,
            }
          );
          console.log("Create group result:", JSON.stringify(createGroupResult));
          break;
        } catch (err) {
          console.log(`${endpoint.url} failed:`, (err as Error).message);
        }
      }

      const groupData = createGroupResult as {
        group?: { JID?: string; Name?: string; Participants?: unknown[] };
        jid?: string;
        id?: string;
        JID?: string;
        Name?: string;
      } | null;
      
      const groupJid = groupData?.group?.JID || groupData?.JID || groupData?.jid || groupData?.id;
      const groupNameResult = groupData?.group?.Name || group_name;
      const participantCount = groupData?.group?.Participants?.length || cleanParticipants.length + 1;
      
      if (groupJid) {
        console.log(`Saving group to database: ${groupNameResult} (${groupJid})`);
        
        await supabase
          .from("whatsapp_groups")
          .upsert({
            account_id: accountId,
            group_jid: groupJid,
            name: groupNameResult,
            participant_count: participantCount,
          }, { onConflict: "account_id,group_jid" });
      }

      return createGroupResult || { success: false, message: "Não foi possível criar o grupo" };
    }

    case "group_participants": {
      if (!savedInstanceToken) {
        throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
      }
      
      if (!group_id || group_id.trim() === "") {
        throw new Error("ID do grupo é obrigatório");
      }

      const groupIdClean = group_id.trim();
      const isValidGroupFormat = /^\d+@g\.us$/.test(groupIdClean) || 
                                 /^\d+-\d+@g\.us$/.test(groupIdClean) || 
                                 /^\d{10,20}$/.test(groupIdClean);
      
      if (!isValidGroupFormat) {
        console.error(`[group_participants] Invalid group_id format: ${group_id}`);
        return new Response(
          JSON.stringify({ error: "Formato de ID de grupo inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const groupJidForParticipants = groupIdClean.includes("@g.us") ? groupIdClean : `${groupIdClean}@g.us`;
      console.log(`Fetching participants for group: ${groupJidForParticipants}`);
      
      let participantsResult: unknown = null;
      let participantsFound = false;
      let participantsList: unknown[] = [];
      
      const groupInfoEndpoints = [
        { url: `/group/fetchGroup`, method: "POST", body: { jid: groupJidForParticipants } },
        { url: `/group/fetchGroup`, method: "POST", body: { groupJid: groupJidForParticipants } },
        { url: `/group/info`, method: "POST", body: { jid: groupJidForParticipants } },
        { url: `/group/metadata`, method: "POST", body: { jid: groupJidForParticipants } },
      ];

      for (const endpoint of groupInfoEndpoints) {
        if (participantsFound) break;
        try {
          console.log(`Trying group info: ${endpoint.method} ${endpoint.url}`);
          const groupInfo = await uazapiInstanceRequest(endpoint.url, endpoint.method, savedInstanceToken, endpoint.body);
          console.log("Group info result:", JSON.stringify(groupInfo));
          
          const data = groupInfo as { 
            participants?: unknown[]; 
            Participants?: unknown[]; 
            members?: unknown[];
            group?: { participants?: unknown[]; Participants?: unknown[]; members?: unknown[] };
          };
          
          participantsList = data?.participants || 
                        data?.Participants || 
                        data?.members ||
                        data?.group?.participants || 
                        data?.group?.Participants || 
                        data?.group?.members || [];
          
          if (participantsList.length > 0) {
            participantsFound = true;
            participantsResult = { participants: participantsList };
          }
        } catch (err) {
          console.log(`${endpoint.url} failed:`, (err as Error).message);
        }
      }
      
      if (!participantsFound) {
        const postEndpoints = [
          { url: `/group/participants`, method: "POST", body: { jid: groupJidForParticipants } },
          { url: `/group/fetchParticipants`, method: "POST", body: { jid: groupJidForParticipants } },
          { url: `/group/members`, method: "POST", body: { jid: groupJidForParticipants } },
        ];

        for (const endpoint of postEndpoints) {
          if (participantsFound) break;
          try {
            console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
            participantsResult = await uazapiInstanceRequest(endpoint.url, endpoint.method, savedInstanceToken, endpoint.body);
            console.log("Participants result:", JSON.stringify(participantsResult));
            
            const data = participantsResult as { participants?: unknown[]; Participants?: unknown[]; data?: unknown[]; members?: unknown[] };
            participantsList = Array.isArray(participantsResult) ? participantsResult : 
                          (data?.participants || data?.Participants || data?.data || data?.members || []);
            
            if (participantsList.length > 0) {
              participantsFound = true;
              participantsResult = { participants: participantsList };
            }
          } catch (err) {
            console.log(`${endpoint.url} failed:`, (err as Error).message);
          }
        }
      }

      // Cache participants in database
      if (participantsFound && participantsList.length > 0) {
        try {
          console.log(`[CACHE] Saving ${participantsList.length} participants for group ${groupJidForParticipants}`);
          
          await supabase
            .from("whatsapp_group_participants")
            .delete()
            .eq("account_id", accountId)
            .eq("group_jid", groupJidForParticipants);
          
          const participantRows = participantsList.map((p: unknown) => {
            const part = p as { id?: string; jid?: string; phone?: string; name?: string; admin?: string; isAdmin?: boolean };
            let phone = part.phone || "";
            if (!phone && part.id) {
              phone = part.id.replace(/@.*$/, "").replace(/\D/g, "");
            }
            if (!phone && part.jid) {
              phone = part.jid.replace(/@.*$/, "").replace(/\D/g, "");
            }
            return {
              account_id: accountId,
              group_jid: groupJidForParticipants,
              phone,
              name: part.name || null,
              is_admin: part.admin === "admin" || part.admin === "superadmin" || part.isAdmin === true,
              synced_at: new Date().toISOString(),
            };
          }).filter(row => row.phone);
          
          if (participantRows.length > 0) {
            const { error: insertError } = await supabase
              .from("whatsapp_group_participants")
              .insert(participantRows);
            
            if (insertError) {
              console.error("[CACHE] Failed to insert participants:", insertError.message);
            } else {
              console.log(`[CACHE] Successfully cached ${participantRows.length} participants`);
            }
          }
        } catch (cacheErr) {
          console.error("[CACHE] Error caching participants:", (cacheErr as Error).message);
        }
      }

      return participantsResult || { participants: [], error: "Não foi possível obter participantes" };
    }

    case "add_participant": {
      if (!savedInstanceToken) {
        throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
      }
      
      if (!group_id) {
        throw new Error("ID do grupo é obrigatório");
      }
      
      if (!participants || participants.length === 0) {
        throw new Error("Pelo menos um participante é obrigatório");
      }

      const groupJid = group_id.includes("@g.us") ? group_id : `${group_id}@g.us`;
      const cleanParticipants = participants.map(p => `${p.replace(/\D/g, "")}@s.whatsapp.net`);
      
      console.log(`Adding ${cleanParticipants.length} participants to ${groupJid}`);

      const addEndpoints = [
        { url: `/group/updateParticipant`, method: "POST", body: { groupJid, action: "add", participants: cleanParticipants } },
        { url: `/group/addParticipants`, method: "POST", body: { groupJid, participants: cleanParticipants } },
      ];

      let addResult: unknown = null;
      
      for (const endpoint of addEndpoints) {
        try {
          console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
          addResult = await uazapiInstanceRequest(endpoint.url, endpoint.method, savedInstanceToken, endpoint.body);
          console.log("Add result:", JSON.stringify(addResult));
          break;
        } catch (err) {
          console.log(`${endpoint.url} failed:`, (err as Error).message);
        }
      }

      return addResult || { success: false, message: "Não foi possível adicionar participantes" };
    }

    case "remove_participant": {
      if (!savedInstanceToken) {
        throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
      }
      
      if (!group_id) {
        throw new Error("ID do grupo é obrigatório");
      }
      
      if (!participants || participants.length === 0) {
        throw new Error("Pelo menos um participante é obrigatório");
      }

      const groupJid = group_id.includes("@g.us") ? group_id : `${group_id}@g.us`;
      const cleanParticipants = participants.map(p => `${p.replace(/\D/g, "")}@s.whatsapp.net`);
      
      console.log(`Removing ${cleanParticipants.length} participants from ${groupJid}`);

      const removeEndpoints = [
        { url: `/group/updateParticipant`, method: "POST", body: { groupJid, action: "remove", participants: cleanParticipants } },
        { url: `/group/removeParticipants`, method: "POST", body: { groupJid, participants: cleanParticipants } },
      ];

      let removeResult: unknown = null;
      
      for (const endpoint of removeEndpoints) {
        try {
          console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
          removeResult = await uazapiInstanceRequest(endpoint.url, endpoint.method, savedInstanceToken, endpoint.body);
          console.log("Remove result:", JSON.stringify(removeResult));
          break;
        } catch (err) {
          console.log(`${endpoint.url} failed:`, (err as Error).message);
        }
      }

      return removeResult || { success: false, message: "Não foi possível remover participantes" };
    }

    case "update_group_name": {
      if (!savedInstanceToken) {
        throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
      }
      
      if (!group_id) {
        throw new Error("ID do grupo é obrigatório");
      }
      
      if (!group_name) {
        throw new Error("Nome do grupo é obrigatório");
      }

      const groupJid = group_id.includes("@g.us") ? group_id : `${group_id}@g.us`;
      console.log(`Updating group name: ${groupJid} -> ${group_name}`);
      
      let updateResult: unknown = null;
      let updateSuccess = false;
      
      const updateEndpoints = [
        { url: `/group/updateSubject`, method: "POST", body: { groupJid: groupJid, subject: group_name } },
        { url: `/group/updateName`, method: "POST", body: { groupJid: groupJid, name: group_name } },
      ];

      for (const endpoint of updateEndpoints) {
        if (updateSuccess) break;
        try {
          console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
          updateResult = await uazapiInstanceRequest(endpoint.url, endpoint.method, savedInstanceToken, endpoint.body);
          console.log("Update name result:", JSON.stringify(updateResult));
          
          const updateData = updateResult as { error?: boolean | string; success?: boolean };
          if (updateData.success || updateData.error === false) {
            updateSuccess = true;
          }
        } catch (err) {
          console.log(`${endpoint.url} failed:`, (err as Error).message);
        }
      }

      if (updateSuccess) {
        try {
          await supabase.from("whatsapp_groups")
            .update({ name: group_name, updated_at: new Date().toISOString() })
            .eq("group_jid", groupJid);
        } catch (dbErr) {
          console.log("Failed to update group name in DB:", dbErr);
        }
      }

      return updateSuccess 
        ? { success: true, message: "Nome do grupo atualizado com sucesso", data: updateResult }
        : { success: false, message: "Não foi possível atualizar o nome do grupo", lastResult: updateResult };
    }

    case "update_group_description": {
      const { group_id, group_description } = payload;
      
      if (!savedInstanceToken) {
        throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
      }
      
      if (!group_id) {
        throw new Error("ID do grupo é obrigatório");
      }

      const groupJid = group_id.includes("@g.us") ? group_id : `${group_id}@g.us`;
      console.log(`Updating group description: ${groupJid}`);
      
      let updateResult: unknown = null;
      let updateSuccess = false;
      
      const updateEndpoints = [
        { url: `/group/updateDescription`, method: "POST", body: { groupJid: groupJid, description: group_description || "" } },
      ];

      for (const endpoint of updateEndpoints) {
        if (updateSuccess) break;
        try {
          console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
          updateResult = await uazapiInstanceRequest(endpoint.url, endpoint.method, savedInstanceToken, endpoint.body);
          console.log("Update description result:", JSON.stringify(updateResult));
          
          const updateData = updateResult as { error?: boolean | string; success?: boolean };
          if (updateData.success || updateData.error === false) {
            updateSuccess = true;
          }
        } catch (err) {
          console.log(`${endpoint.url} failed:`, (err as Error).message);
        }
      }

      if (updateSuccess) {
        try {
          await supabase.from("whatsapp_groups")
            .update({ description: group_description, updated_at: new Date().toISOString() })
            .eq("group_jid", groupJid);
        } catch (dbErr) {
          console.log("Failed to update group description in DB:", dbErr);
        }
      }

      return updateSuccess 
        ? { success: true, message: "Descrição do grupo atualizada com sucesso", data: updateResult }
        : { success: false, message: "Não foi possível atualizar a descrição do grupo", lastResult: updateResult };
    }

    case "update_group_image": {
      const { group_id, group_image } = payload;
      
      if (!savedInstanceToken) {
        throw new Error("WhatsApp não conectado. Configure a integração primeiro.");
      }
      
      if (!group_id) {
        throw new Error("ID do grupo é obrigatório");
      }
      
      if (!group_image) {
        throw new Error("URL da imagem é obrigatória");
      }

      const groupJid = group_id.includes("@g.us") ? group_id : `${group_id}@g.us`;
      console.log(`Updating group image: ${groupJid}`);
      
      let updateResult: unknown = null;
      let updateSuccess = false;
      
      const updateEndpoints = [
        { url: `/group/updateImage`, method: "POST", body: { groupJid: groupJid, image: group_image } },
      ];

      for (const endpoint of updateEndpoints) {
        if (updateSuccess) break;
        try {
          console.log(`Trying: ${endpoint.method} ${endpoint.url}`);
          updateResult = await uazapiInstanceRequest(endpoint.url, endpoint.method, savedInstanceToken, endpoint.body);
          console.log("Update image result:", JSON.stringify(updateResult));
          
          const updateData = updateResult as { error?: boolean | string; success?: boolean };
          if (updateData.success || updateData.error === false) {
            updateSuccess = true;
          }
        } catch (err) {
          console.log(`${endpoint.url} failed:`, (err as Error).message);
        }
      }

      return updateSuccess 
        ? { success: true, message: "Imagem do grupo atualizada com sucesso", data: updateResult }
        : { success: false, message: "Não foi possível atualizar a imagem do grupo", lastResult: updateResult };
    }

    default:
      return new Response(
        JSON.stringify({ error: `Unknown group action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
  }
}
