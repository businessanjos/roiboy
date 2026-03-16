import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { 
  "Access-Control-Allow-Origin": "*", 
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" 
};
const UAZAPI_URL = (Deno.env.get("UAZAPI_URL") || "").replace(/\/$/, '');
const UAZAPI_ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN") || "";

async function uazapiAdmin(endpoint: string, method: string, body?: unknown) {
  const r = await fetch(`${UAZAPI_URL}${endpoint}`, { 
    method, 
    headers: { "Content-Type": "application/json", "admintoken": UAZAPI_ADMIN_TOKEN }, 
    body: body ? JSON.stringify(body) : undefined 
  });
  const json = await r.json();
  if (!r.ok && json.error) throw new Error(json.error);
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

    const { data: userData } = await supabase.from("users").select("id, name, account_id, role, is_also_admin").eq("auth_user_id", user.id).single();
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
      const { data } = await supabase.from("integrations").select("id, config, status").eq("account_id", accountId).eq("type", "whatsapp").eq("sector_id", sector_id).limit(1);
      intData = data?.[0] || null;
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
      const all = await uazapiAdmin("/instance/all", "GET") as Array<{name?:string;status?:string;owner?:string}>;
      const inst = all.find(i => i.name === instanceName);
      result = { state: inst?.status || "unknown", connected: inst?.status === "connected", owner: inst?.owner };
      if (intData?.id) await supabase.from("integrations").update({ status: inst?.status === "connected" ? "connected" : "disconnected" }).eq("id", intData.id);
    
    } else if (action === "create") {
      const r = await uazapiAdmin("/instance/init", "POST", { name: instanceName });
      const newToken = r.token || r.instance?.token;
      await supabase.from("integrations").upsert({ account_id: accountId, type: "whatsapp", sector_id: sector_id || null, status: "pending", config: { provider: "uazapi", instance_name: instanceName, instance_token: newToken } }, { onConflict: "account_id,type,sector_id" });
      result = { ...r, token: newToken };
    
    } else if (action === "connect" || action === "qrcode") {
      result = await uazapiAdmin(`/instance/connect/${instanceName}`, "GET");
    
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
      const all = await uazapiAdmin("/instance/all", "GET") as Array<{name?:string;status?:string;owner?:string}>;
      result = { instances: all.filter(i => i.name?.startsWith(`roy-${accountId.slice(0,8)}`)) };
    
    } else if (action === "list_sector_instances") {
      const { data: ints } = await supabase.from("integrations").select("id, sector_id, config, status, display_name, pin_hash").eq("account_id", accountId).eq("type", "whatsapp").not("sector_id", "is", null);
      result = { instances: (ints||[]).map((i:any) => ({ id: i.id, sector_id: i.sector_id, instance_name: i.config?.instance_name, status: i.status, has_pin: !!i.pin_hash })) };
    
    } else if (action === "add_instance_to_sector") {
      const all = await uazapiAdmin("/instance/all", "GET") as Array<{name?:string;token?:string;status?:string;owner?:string}>;
      const inst = all.find(i => i.name === payload.instance_name);
      if (!inst) return new Response(JSON.stringify({ error: "Instance not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      await supabase.from("integrations").insert({ account_id: accountId, type: "whatsapp", sector_id, status: inst.status === "connected" ? "connected" : "disconnected", config: { provider: "uazapi", instance_name: payload.instance_name, instance_token: inst.token, owner: inst.owner } });
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
