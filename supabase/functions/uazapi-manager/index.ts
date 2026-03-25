import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { 
  "Access-Control-Allow-Origin": "*", 
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" 
};
const UAZAPI_URL = (Deno.env.get("UAZAPI_URL") || "").replace(/\/$/, '');
const UAZAPI_ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN") || "";

type UazapiInstanceLike = {
  name?: string;
  instance_name?: string;
  status?: string;
  state?: string;
  owner?: string;
  phone?: string;
  number?: string;
  token?: string;
  profileName?: string;
  profilePicUrl?: string;
  instance?: {
    name?: string;
    status?: string;
    owner?: string;
    token?: string;
  };
};

function extractInstancesList(payload: unknown): UazapiInstanceLike[] {
  if (Array.isArray(payload)) return payload as UazapiInstanceLike[];

  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  const candidateKeys = ["instances", "data", "result", "rows", "all"];

  for (const key of candidateKeys) {
    if (Array.isArray(record[key])) {
      return record[key] as UazapiInstanceLike[];
    }
  }

  const objectValues = Object.values(record);
  const nestedArray = objectValues.find(Array.isArray);
  if (Array.isArray(nestedArray)) {
    return nestedArray as UazapiInstanceLike[];
  }

  const looksLikeSingleInstance =
    typeof record.name === "string" ||
    typeof record.instance_name === "string" ||
    (record.instance && typeof record.instance === "object");

  if (looksLikeSingleInstance) {
    return [record as UazapiInstanceLike];
  }

  const objectEntries = objectValues.filter(
    (value) => value && typeof value === "object" && !Array.isArray(value),
  ) as UazapiInstanceLike[];

  return objectEntries;
}

function getInstanceName(instance: UazapiInstanceLike): string | undefined {
  return instance.name || instance.instance_name || instance.instance?.name;
}

function getInstanceStatus(instance: UazapiInstanceLike): string | undefined {
  return instance.status || instance.state || instance.instance?.status;
}

function getInstanceOwner(instance: UazapiInstanceLike): string | undefined {
  return instance.owner || instance.phone || instance.number || instance.instance?.owner;
}

function getInstanceToken(instance: UazapiInstanceLike): string | undefined {
  return instance.token || instance.instance?.token;
}

async function uazapiAdmin(endpoint: string, method: string, body?: unknown) {
  console.log(`[uazapi-admin] Calling: ${method} ${UAZAPI_URL}${endpoint}`);
  const r = await fetch(`${UAZAPI_URL}${endpoint}`, { 
    method, 
    headers: { 
      "Content-Type": "application/json", 
      "AdminToken": UAZAPI_ADMIN_TOKEN,
      "admintoken": UAZAPI_ADMIN_TOKEN,
    }, 
    body: body ? JSON.stringify(body) : undefined 
  });
  const responseText = await r.text();
  console.log(`[uazapi-admin] Response: ${r.status} - ${responseText.substring(0, 300)}`);
  let json: any;
  try { json = JSON.parse(responseText); } catch { throw new Error(`Invalid response: ${responseText.substring(0, 100)}`); }
  if (json.error && json.error !== false) throw new Error(typeof json.error === 'string' ? json.error : JSON.stringify(json));
  return json;
}

async function uazapiInstance(endpoint: string, method: string, token: string, body?: unknown) {
  console.log(`[uazapi] Calling: ${method} ${UAZAPI_URL}${endpoint}`);
  const r = await fetch(`${UAZAPI_URL}${endpoint}`, { 
    method, 
    headers: { "Content-Type": "application/json", "token": token }, 
    body: body ? JSON.stringify(body) : undefined 
  });
  
  const responseText = await r.text();
  console.log(`[uazapi] Response: ${r.status} - ${responseText.substring(0, 300)}`);
  
  let json: any;
  try {
    json = JSON.parse(responseText);
  } catch {
    throw new Error(`Resposta inválida do WhatsApp: ${responseText.substring(0, 100)}`);
  }
  
  // UAZAPI retorna { error: false } em sucesso, { error: true } em falha
  if (json.error === true || json.error === "true") {
    throw new Error(json.message || json.error_message || "Erro ao enviar mensagem");
  }
  
  // "Method Not Allowed" = endpoint errado
  if (json.message === "Method Not Allowed" || r.status === 405) {
    throw new Error(`Endpoint inválido: ${endpoint}`);
  }
  
  return json;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const token_jwt = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token_jwt);
    if (claimsError || !claimsData?.claims) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userId = claimsData.claims.sub;

    const { data: userData } = await supabase.from("users").select("id, name, account_id, role, is_also_admin").eq("auth_user_id", userId).single();
    if (!userData) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const payload = await req.json();
    const { action, sector_id, phone, message, group_id, integration_id } = payload;
    const accountId = userData.account_id;

    console.log(`[uazapi-manager] Action: ${action}, integration_id: ${integration_id}, sector_id: ${sector_id}`);

    // Buscar integração - PRIORIZAR integration_id
    let intData: { id: string; config: { instance_token?: string; instance_name?: string }; status: string } | null = null;
    
    if (integration_id) {
      const { data } = await supabase.from("integrations").select("id, config, status").eq("id", integration_id).eq("account_id", accountId).single();
      intData = data;
    } else if (sector_id) {
      // CRITICAL: For sectors with multiple instances, prefer the connected one
      // ORDER BY status ASC puts 'connected' before 'disconnected' alphabetically
      const { data } = await supabase.from("integrations").select("id, config, status")
        .eq("account_id", accountId).eq("type", "whatsapp").eq("sector_id", sector_id)
        .order("status", { ascending: true })
        .limit(5);
      
      if (data && data.length > 1) {
        // Multiple instances for this sector - prefer connected
        const connected = data.find((i: any) => i.status === "connected");
        intData = connected || data[0];
        console.warn(`[uazapi-manager] ⚠️ MULTI-INSTANCE sector "${sector_id}": ${data.length} instances found. Using: ${intData?.config?.instance_name} (${intData?.status}). Pass integration_id to be explicit.`);
      } else {
        intData = data?.[0] || null;
      }
    } else {
      const { data } = await supabase.from("integrations").select("id, config, status").eq("account_id", accountId).eq("type", "whatsapp").is("sector_id", null).limit(1);
      intData = data?.[0] || null;
    }

    const token = intData?.config?.instance_token;
    const instanceName = intData?.config?.instance_name || `roy-${accountId.slice(0,8)}`;

    console.log(`[uazapi-manager] Found integration: ${intData?.id || "NONE"}, token: ${token ? "present" : "MISSING"}`);

    // Ações que requerem token
    const tokenRequiredActions = ["send_text", "send_media", "send_to_group", "send_media_to_group", "list_groups", "disconnect", "delete_message"];
    if (tokenRequiredActions.includes(action) && !token) {
      console.error(`[uazapi-manager] Token required but missing for action: ${action}`);
      return new Response(JSON.stringify({ error: "WhatsApp não configurado para este setor." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let result: unknown = { success: true };

    if (action === "status") {
      const allRaw = await uazapiAdmin("/instance/fetchInstances", "GET");
      const all = extractInstancesList(allRaw);
      const inst = all.find((i) => getInstanceName(i) === instanceName);
      const instanceStatus = getInstanceStatus(inst || {});
      const connected = instanceStatus === "connected" || instanceStatus === "open";

      result = {
        state: instanceStatus || "unknown",
        connected,
        owner: inst ? getInstanceOwner(inst) : undefined,
      };

      if (intData?.id) {
        await supabase
          .from("integrations")
          .update({ status: connected ? "connected" : "disconnected" })
          .eq("id", intData.id);
      }
    
    } else if (action === "create") {
      const r = await uazapiAdmin("/instance/init", "POST", { name: instanceName });
      const newToken = r.token || r.instance?.token;
      await supabase.from("integrations").upsert({ account_id: accountId, type: "whatsapp", sector_id: sector_id || null, status: "pending", config: { provider: "uazapi", instance_name: instanceName, instance_token: newToken } }, { onConflict: "account_id,type,sector_id" });
      result = { ...r, token: newToken };
    
    } else if (action === "connect" || action === "qrcode") {
      const instName = payload.instance_name || instanceName;
      result = await uazapiAdmin(`/instance/connect/${instName}`, "GET");
    
    } else if (action === "disconnect") {
      try { await uazapiInstance("/logout", "POST", token!); } catch {}
      if (intData?.id) await supabase.from("integrations").update({ status: "disconnected" }).eq("id", intData.id);
      result = { disconnected: true };
    
    } else if (action === "send_text") {
      // ✅ CORRIGIDO: Usar /send/text em vez de /message/sendText
      const cleanPhone = phone?.replace(/\D/g, "");
      if (!cleanPhone || cleanPhone.length < 10) {
        return new Response(JSON.stringify({ error: "Número de telefone inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      const textBody: Record<string, unknown> = { number: cleanPhone, text: message };
      if (payload.quoted_message_id) textBody.replyid = payload.quoted_message_id;
      if (payload.mentions) textBody.mentions = payload.mentions;
      
      result = await uazapiInstance("/send/text", "POST", token!, textBody);
    
    } else if (action === "send_media") {
      // ✅ NOVO: Suporte a envio de mídia
      const cleanPhone = phone?.replace(/\D/g, "");
      if (!cleanPhone || cleanPhone.length < 10) {
        return new Response(JSON.stringify({ error: "Número de telefone inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      const mediaBody: Record<string, unknown> = { 
        number: cleanPhone, 
        type: payload.media_type || "image",
        file: payload.media_url,
        text: payload.caption || ""
      };
      if (payload.quoted_message_id) mediaBody.replyid = payload.quoted_message_id;
      if (payload.file_name) mediaBody.fileName = payload.file_name;
      
      result = await uazapiInstance("/send/media", "POST", token!, mediaBody);
    
    } else if (action === "send_to_group") {
      // ✅ CORRIGIDO: Usar /send/text para grupos
      const jid = group_id?.includes("@g.us") ? group_id : `${group_id}@g.us`;
      
      const groupBody: Record<string, unknown> = { number: jid, text: message };
      if (payload.quoted_message_id) groupBody.replyid = payload.quoted_message_id;
      if (payload.mentions) groupBody.mentions = payload.mentions;
      
      result = await uazapiInstance("/send/text", "POST", token!, groupBody);
    
    } else if (action === "send_media_to_group") {
      // ✅ NOVO: Mídia em grupos
      const jid = group_id?.includes("@g.us") ? group_id : `${group_id}@g.us`;
      
      const mediaBody: Record<string, unknown> = { 
        number: jid, 
        type: payload.media_type || "image",
        file: payload.media_url,
        text: payload.caption || ""
      };
      if (payload.quoted_message_id) mediaBody.replyid = payload.quoted_message_id;
      if (payload.file_name) mediaBody.fileName = payload.file_name;
      
      result = await uazapiInstance("/send/media", "POST", token!, mediaBody);
    
    } else if (action === "list_groups") {
      const r = await uazapiInstance("/group/fetchAllGroups", "GET", token!);
      result = { groups: (Array.isArray(r) ? r : r.groups || []).map((g:any) => ({ group_jid: g.JID||g.jid||g.id, name: g.Name||g.name||g.Subject })) };
    
    } else if (action === "list_instances") {
      const allRaw = await uazapiAdmin("/instance/all", "GET");
      const all = extractInstancesList(allRaw);
      
      // Get all integrations for this account to know which are linked
      const { data: existingInts } = await supabase.from("integrations").select("config, sector_id, id, status").eq("account_id", accountId).eq("type", "whatsapp");
      const linkedNames = new Set((existingInts || []).map((i: any) => i.config?.instance_name).filter(Boolean));
      const linkedMap = new Map((existingInts || []).map((i: any) => [i.config?.instance_name, i]));
      
      // Filter: instances that belong to this account (roy-prefix), SDR instances, or explicitly linked
      const accountPrefix = `roy-${accountId.slice(0,8)}`;
      const filtered = all.filter((i) => {
        const name = getInstanceName(i);
        return !!name && (name.startsWith(accountPrefix) || name.startsWith("sdr-") || linkedNames.has(name));
      });
      
      result = { instances: filtered.map(i => {
        const name = getInstanceName(i);
        const linked = name ? linkedMap.get(name) : null;
        return {
          ...i,
          name,
          status: getInstanceStatus(i),
          owner: getInstanceOwner(i),
          hasToken: !!getInstanceToken(i),
          linked_sector_id: linked?.sector_id || null,
          linked_integration_id: linked?.id || null,
          linked_status: linked?.status || null,
        };
      }) };
    
    } else if (action === "list_sector_instances") {
      const { data: ints } = await supabase.from("integrations").select("id, sector_id, config, status, display_name, pin_hash").eq("account_id", accountId).eq("type", "whatsapp").not("sector_id", "is", null);
      result = { instances: (ints||[]).map((i:any) => ({ id: i.id, sector_id: i.sector_id, instance_name: i.config?.instance_name, status: i.status, has_pin: !!i.pin_hash })) };
    
    } else if (action === "add_instance_to_sector") {
      const allRaw = await uazapiAdmin("/instance/all", "GET");
      const all = extractInstancesList(allRaw);
      const inst = all.find((i) => getInstanceName(i) === payload.instance_name);
      if (!inst) return new Response(JSON.stringify({ error: "Instance not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      await supabase.from("integrations").insert({ account_id: accountId, type: "whatsapp", sector_id, status: getInstanceStatus(inst) === "connected" ? "connected" : "disconnected", config: { provider: "uazapi", instance_name: payload.instance_name, instance_token: getInstanceToken(inst), owner: getInstanceOwner(inst) } });
      result = { success: true };
    
    } else if (action === "verify_instance_pin") {
      const { data: int } = await supabase.from("integrations").select("pin_hash").eq("id", payload.integration_id).single();
      if (!int?.pin_hash) result = { valid: true };
      else {
        const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload.pin + accountId));
        result = { valid: Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('') === int.pin_hash };
      }
    
    } else if (action === "update_instance_pin") {
      // Validar integration_id
      if (!integration_id) {
        return new Response(
          JSON.stringify({ error: "integration_id é obrigatório" }), 
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Verificar se integração existe e pertence à conta
      const { data: int } = await supabase
        .from("integrations")
        .select("id")
        .eq("id", integration_id)
        .eq("account_id", accountId)
        .single();
        
      if (!int) {
        return new Response(
          JSON.stringify({ error: "Instância não encontrada" }), 
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Gerar hash do novo PIN ou null para remover
      let pinHash: string | null = null;
      if (payload.pin && payload.pin !== "null" && payload.pin !== "") {
        const h = await crypto.subtle.digest(
          'SHA-256', 
          new TextEncoder().encode(payload.pin + accountId)
        );
        pinHash = Array.from(new Uint8Array(h))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
      
      // Atualizar no banco
      const { error: updateError } = await supabase
        .from("integrations")
        .update({ pin_hash: pinHash })
        .eq("id", integration_id)
        .eq("account_id", accountId);
        
      if (updateError) throw updateError;
      
      console.log(`[uazapi-manager] PIN ${pinHash ? 'updated' : 'removed'} for integration ${integration_id}`);
      result = { success: true };
    
    } else if (action === "configure_webhook") {
      // ✅ Configurar webhook automaticamente com todos os eventos necessários
      if (!token) {
        return new Response(JSON.stringify({ error: "WhatsApp não conectado. Conecte primeiro." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const webhookUrl = `${supabaseUrl}/functions/v1/uazapi-webhook`;
      
      const webhookConfig = {
        url: webhookUrl,
        enabled: true,
        events: ["messages", "messages.update", "messages.delete", "connection", "groups", "qrcode"]
      };
      
      console.log(`[uazapi-manager] Configuring webhook for ${instanceName}: ${webhookUrl}`);
      console.log(`[uazapi-manager] Events: ${webhookConfig.events.join(", ")}`);
      
      // Tentar múltiplos endpoints possíveis da UAZAPI GO v2
      let webhookResult: any = null;
      let webhookSuccess = false;
      
      const endpoints = [
        { path: "/webhook/set", method: "POST" },
        { path: "/instance/webhook", method: "PUT" },
        { path: "/webhook", method: "POST" },
      ];
      
      for (const ep of endpoints) {
        try {
          console.log(`[uazapi-manager] Trying ${ep.method} ${ep.path}...`);
          webhookResult = await uazapiInstance(ep.path, ep.method, token!, webhookConfig);
          webhookSuccess = true;
          console.log(`[uazapi-manager] Webhook configured via ${ep.path}`);
          break;
        } catch (err) {
          console.log(`[uazapi-manager] ${ep.path} failed: ${(err as Error).message}`);
        }
      }
      
      if (!webhookSuccess) {
        // Fallback: tentar via admin endpoint
        try {
          webhookResult = await uazapiAdmin(`/instance/webhook/${instanceName}`, "PUT", webhookConfig);
          webhookSuccess = true;
          console.log(`[uazapi-manager] Webhook configured via admin endpoint`);
        } catch (err) {
          console.log(`[uazapi-manager] Admin webhook also failed: ${(err as Error).message}`);
        }
      }
      
      // Atualizar status no banco
      if (intData?.id) {
        const currentConfig = intData.config || {};
        await supabase.from("integrations").update({ 
          config: { ...currentConfig, webhook_configured: webhookSuccess, webhook_url: webhookUrl, webhook_events: webhookConfig.events }
        }).eq("id", intData.id);
      }
      
      if (!webhookSuccess) {
        return new Response(JSON.stringify({ error: "Não foi possível configurar o webhook automaticamente. Configure manualmente no painel UAZAPI.", details: webhookResult }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      result = { success: true, webhook_url: webhookUrl, events: webhookConfig.events };
    
    } else if (action === "delete_message") {
      const messageId = payload.message_id;
      if (!messageId) {
        return new Response(
          JSON.stringify({ error: "message_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      result = await uazapiInstance("/message/delete", "POST", token!, { id: messageId });
      result = { deleted: true, api_response: result };
    
    } else if (action === "unlink_instance") {
      if (!integration_id) {
        return new Response(
          JSON.stringify({ error: "integration_id é obrigatório" }), 
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const { data: int } = await supabase
        .from("integrations")
        .select("id")
        .eq("id", integration_id)
        .eq("account_id", accountId)
        .single();
        
      if (!int) {
        return new Response(
          JSON.stringify({ error: "Instância não encontrada" }), 
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const { error: deleteError } = await supabase
        .from("integrations")
        .delete()
        .eq("id", integration_id)
        .eq("account_id", accountId);
        
      if (deleteError) throw deleteError;
      
      console.log(`[uazapi-manager] Integration ${integration_id} unlinked successfully`);
      result = { success: true };
    }

    return new Response(JSON.stringify({ data: result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[uazapi-manager] Error:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
