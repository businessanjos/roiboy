import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { 
  "Access-Control-Allow-Origin": "*", 
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" 
};
const UAZAPI_URL = (Deno.env.get("UAZAPI_URL") || "").trim().replace(/\/$/, '');
const UAZAPI_ADMIN_TOKEN = (Deno.env.get("UAZAPI_ADMIN_TOKEN") || "").trim();

// --- Per-sector server resolution ---
// Each sector can override the global UAZAPI host + admin token via sector_settings.
// When override fields are NULL, falls back to the global secrets above.
// This keeps "Vendas" untouched while allowing "Operações" to use a different server.
type ServerConfig = { host: string; adminToken: string; source: "global" | "sector" };

const GLOBAL_SERVER: ServerConfig = { host: UAZAPI_URL, adminToken: UAZAPI_ADMIN_TOKEN, source: "global" };

async function resolveServerForSector(
  supabase: any,
  accountId: string,
  sectorId: string | null | undefined,
): Promise<ServerConfig> {
  if (!sectorId) return GLOBAL_SERVER;
  try {
    const { data } = await supabase
      .from("sector_settings")
      .select("royzapp_host, royzapp_admin_token_secret_name")
      .eq("account_id", accountId)
      .eq("sector_id", sectorId)
      .maybeSingle();
    const host = (data?.royzapp_host || "").trim().replace(/\/$/, '');
    const secretName = (data?.royzapp_admin_token_secret_name || "").trim();
    if (host && secretName) {
      const secretValue = (Deno.env.get(secretName) || "").trim();
      if (secretValue) {
        console.log(`[uazapi-manager] Sector "${sectorId}" using custom server: ${host} (secret: ${secretName})`);
        return { host, adminToken: secretValue, source: "sector" };
      } else {
        console.warn(`[uazapi-manager] Sector "${sectorId}" has host=${host} but secret "${secretName}" is empty/missing. Falling back to global.`);
      }
    }
  } catch (err) {
    console.warn(`[uazapi-manager] Failed to resolve server for sector ${sectorId}:`, err);
  }
  return GLOBAL_SERVER;
}

async function resolveServerForIntegrationId(
  supabase: any,
  accountId: string,
  integrationId: string | null | undefined,
): Promise<ServerConfig> {
  if (!integrationId) return GLOBAL_SERVER;
  try {
    const { data } = await supabase
      .from("integrations")
      .select("sector_id")
      .eq("id", integrationId)
      .eq("account_id", accountId)
      .maybeSingle();
    return resolveServerForSector(supabase, accountId, data?.sector_id);
  } catch {
    return GLOBAL_SERVER;
  }
}

type UazapiInstanceLike = {
  name?: string;
  instance_name?: string;
  status?: unknown;
  state?: unknown;
  connection_status?: unknown;
  owner?: string;
  phone?: string;
  number?: string;
  token?: string;
  profileName?: string;
  profilePicUrl?: string;
  is_healthy?: boolean;
  data?: Record<string, unknown>;
  checked_instance?: Record<string, unknown>;
  instance?: {
    name?: string;
    status?: unknown;
    state?: unknown;
    connection_status?: unknown;
    owner?: string;
    phone?: string;
    number?: string;
    token?: string;
    is_healthy?: boolean;
  };
};

type StatusSnapshot = {
  state: string;
  connected: boolean;
  owner?: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function getString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeConnectionState(value: unknown): string | undefined {
  const normalized = getString(value)?.toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "open") return "connected";
  if (["close", "closed", "logout", "disconnected"].includes(normalized)) return "disconnected";
  return normalized;
}

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
  return (
    instance.name ||
    instance.instance_name ||
    getString(instance.checked_instance?.name) ||
    getString(instance.data?.name) ||
    getString(instance.data?.instance_name) ||
    instance.instance?.name
  );
}

function getInstanceStatus(instance: UazapiInstanceLike): string | undefined {
  return (
    normalizeConnectionState(instance.connection_status) ||
    normalizeConnectionState(instance.status) ||
    normalizeConnectionState(instance.state) ||
    normalizeConnectionState(instance.checked_instance?.connection_status) ||
    normalizeConnectionState(instance.checked_instance?.state) ||
    normalizeConnectionState(instance.data?.connection_status) ||
    normalizeConnectionState(instance.data?.status) ||
    normalizeConnectionState(instance.data?.state) ||
    normalizeConnectionState(instance.instance?.connection_status) ||
    normalizeConnectionState(instance.instance?.status) ||
    normalizeConnectionState(instance.instance?.state)
  );
}

function getInstanceOwner(instance: UazapiInstanceLike): string | undefined {
  return (
    instance.owner ||
    instance.phone ||
    instance.number ||
    getString(instance.checked_instance?.owner) ||
    getString(instance.checked_instance?.phone) ||
    getString(instance.checked_instance?.number) ||
    getString(instance.data?.owner) ||
    getString(instance.data?.phone) ||
    getString(instance.data?.number) ||
    instance.instance?.owner ||
    instance.instance?.phone ||
    instance.instance?.number
  );
}

function getInstanceToken(instance: UazapiInstanceLike): string | undefined {
  return instance.token || instance.instance?.token || getString(instance.data?.token);
}

function resolveStatusSnapshot(payload: unknown): StatusSnapshot {
  const record = asRecord(payload);
  if (!record) return { state: "unknown", connected: false };

  const nestedStatus = asRecord(record.status);
  const nestedData = asRecord(record.data);
  const nestedInstance = asRecord(record.instance);
  const checkedInstance = asRecord(
    nestedStatus?.checked_instance ?? record.checked_instance ?? nestedData?.checked_instance,
  );

  const state = (
    normalizeConnectionState(record.connection_status) ||
    normalizeConnectionState(record.state) ||
    (typeof record.status === "string" ? normalizeConnectionState(record.status) : undefined) ||
    normalizeConnectionState(nestedStatus?.connection_status) ||
    normalizeConnectionState(nestedStatus?.state) ||
    normalizeConnectionState(checkedInstance?.connection_status) ||
    normalizeConnectionState(checkedInstance?.state) ||
    normalizeConnectionState(nestedInstance?.connection_status) ||
    normalizeConnectionState(nestedInstance?.state) ||
    (typeof nestedInstance?.status === "string" ? normalizeConnectionState(nestedInstance.status) : undefined) ||
    normalizeConnectionState(nestedData?.connection_status) ||
    normalizeConnectionState(nestedData?.state) ||
    (typeof nestedData?.status === "string" ? normalizeConnectionState(nestedData.status) : undefined) ||
    "unknown"
  );

  const healthy = [
    record.is_healthy,
    nestedStatus?.is_healthy,
    checkedInstance?.is_healthy,
    nestedInstance?.is_healthy,
    nestedData?.is_healthy,
  ].some((value) => value === true);

  const owner = [
    record.owner,
    record.phone,
    record.number,
    checkedInstance?.owner,
    checkedInstance?.phone,
    checkedInstance?.number,
    nestedInstance?.owner,
    nestedInstance?.phone,
    nestedInstance?.number,
    nestedData?.owner,
    nestedData?.phone,
    nestedData?.number,
  ]
    .map(getString)
    .find(Boolean);

  if (healthy) {
    return { state: "connected", connected: true, owner };
  }

  return { state, connected: state === "connected", owner };
}

async function resolveStatusFromToken(token: string): Promise<StatusSnapshot> {
  try {
    const instanceInfo = await uazapiInstance("/status", "GET", token);
    console.log(`[uazapi-manager] Instance status fallback response:`, JSON.stringify(instanceInfo).substring(0, 300));

    const snapshot = resolveStatusSnapshot(instanceInfo);
    if (snapshot.state !== "unknown") {
      return snapshot;
    }
  } catch (instErr) {
    console.warn(`[uazapi-manager] Instance-level status check failed:`, instErr);
  }

  try {
    const meInfo = await uazapiInstance("/me", "GET", token);
    if (meInfo && (meInfo.id || meInfo.wid || meInfo.phone || meInfo.number)) {
      const owner = meInfo.phone || meInfo.number || meInfo.id;
      console.log(`[uazapi-manager] /me endpoint confirmed connected:`, owner);
      return { state: "connected", connected: true, owner };
    }
  } catch {
    console.log(`[uazapi-manager] /me endpoint also failed`);
  }

  return { state: "unknown", connected: false };
}

async function resolveLiveStatusesForIntegrations(
  integrations: Array<{ config?: Record<string, unknown>; status?: string | null }>,
): Promise<Map<string, StatusSnapshot>> {
  const snapshots = new Map<string, StatusSnapshot>();
  const unresolved = new Map<string, string>();

  for (const integration of integrations) {
    const config = integration.config || {};
    const instanceName = getString(config.instance_name);
    const token = getString(config.instance_token);
    if (instanceName) {
      unresolved.set(instanceName, token || "");
    }
  }

  try {
    const allRaw = await uazapiAdmin("/instance/fetchInstances", "GET");
    const all = extractInstancesList(allRaw);

    for (const instance of all) {
      const name = getInstanceName(instance);
      if (!name || !unresolved.has(name)) continue;
      snapshots.set(name, resolveStatusSnapshot(instance));
      unresolved.delete(name);
    }
  } catch (adminErr) {
    console.warn(`[uazapi-manager] Admin fetchInstances failed while listing sector instances`);
  }

  await Promise.all(
    Array.from(unresolved.entries()).map(async ([instanceName, token]) => {
      if (!token) return;
      const snapshot = await resolveStatusFromToken(token);
      snapshots.set(instanceName, snapshot);
    }),
  );

  return snapshots;
}

function normalizeQuotedMessageId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.includes(":") ? trimmed.split(":").pop() || trimmed : trimmed;
}

async function uazapiAdmin(endpoint: string, method: string, body?: unknown, server?: ServerConfig) {
  const s = server || GLOBAL_SERVER;
  console.log(`[uazapi-admin] Calling: ${method} ${s.host}${endpoint} (server: ${s.source})`);
  const r = await fetch(`${s.host}${endpoint}`, { 
    method, 
    headers: { 
      "Content-Type": "application/json", 
      "AdminToken": s.adminToken,
      "admintoken": s.adminToken,
    }, 
    body: body ? JSON.stringify(body) : undefined 
  });
  const responseText = await r.text();
  console.log(`[uazapi-admin] Response: ${r.status} - ${responseText.substring(0, 300)}`);
  if (r.status === 404) throw new Error(`Admin endpoint not found: ${endpoint}`);
  if (r.status >= 400) throw new Error(`Admin API error ${r.status}: ${responseText.substring(0, 200)}`);
  let json: any;
  try { json = JSON.parse(responseText); } catch { throw new Error(`Invalid response: ${responseText.substring(0, 100)}`); }
  if (json.error && json.error !== false) throw new Error(typeof json.error === 'string' ? json.error : JSON.stringify(json));
  return json;
}

async function uazapiInstance(endpoint: string, method: string, token: string, body?: unknown, server?: ServerConfig) {
  const s = server || GLOBAL_SERVER;
  console.log(`[uazapi] Calling: ${method} ${s.host}${endpoint} (server: ${s.source})`);
  const r = await fetch(`${s.host}${endpoint}`, { 
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
    const { data: authData, error: authError } = await supabase.auth.getUser(token_jwt);
    if (authError || !authData?.user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userId = authData.user.id;

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

    // ========== ANTI-SPAM PROTECTION ==========
    if (["send_text", "send_media"].includes(action) && phone && message) {
      const cleanPhoneCheck = phone.replace(/\D/g, "");
      const effectiveSectorId = sector_id || null;
      
      // 1. Check identical messages sent to multiple contacts in last 30 min
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: duplicateCheck } = await supabase
        .from("zapp_messages")
        .select("id, phone_e164")
        .eq("account_id", accountId)
        .eq("direction", "outbound")
        .eq("content", message)
        .gte("created_at", thirtyMinAgo)
        .limit(10);
      
      const uniquePhones = new Set((duplicateCheck || []).map((m: any) => m.phone_e164));
      // Don't count the current phone - we're checking OTHER recipients
      uniquePhones.delete(cleanPhoneCheck);
      uniquePhones.delete(`+${cleanPhoneCheck}`);
      uniquePhones.delete(`+55${cleanPhoneCheck}`);
      
      if (uniquePhones.size >= 5) {
        console.warn(`[uazapi-manager] ⚠️ SPAM BLOCKED: Identical message already sent to ${uniquePhones.size} different contacts in last 30min. User: ${userData.name}`);
        return new Response(JSON.stringify({ 
          error: "Mensagem idêntica já enviada para muitos contatos. Personalize o texto para cada destinatário.",
          spam_blocked: true,
          unique_recipients: uniquePhones.size
        }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      // 2. Check hourly volume per user
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: hourlyCount } = await supabase
        .from("zapp_messages")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .eq("direction", "outbound")
        .eq("sender_user_id", userData.id)
        .gte("created_at", oneHourAgo);
      
      const MAX_MESSAGES_PER_HOUR = 80;
      if ((hourlyCount || 0) >= MAX_MESSAGES_PER_HOUR) {
        console.warn(`[uazapi-manager] ⚠️ RATE LIMIT: User ${userData.name} sent ${hourlyCount} messages in last hour. Limit: ${MAX_MESSAGES_PER_HOUR}`);
        return new Response(JSON.stringify({ 
          error: `Limite de ${MAX_MESSAGES_PER_HOUR} mensagens por hora atingido. Aguarde alguns minutos.`,
          rate_limited: true,
          current_count: hourlyCount
        }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    // ========== END ANTI-SPAM ==========

    let result: unknown = { success: true };

    if (action === "status") {
      const storedConnected = intData?.status === "connected";
      let statusSnapshot: StatusSnapshot = {
        state: storedConnected ? "connected" : "unknown",
        connected: storedConnected,
      };

      try {
        const allRaw = await uazapiAdmin("/instance/fetchInstances", "GET");
        const all = extractInstancesList(allRaw);
        const inst = all.find((i) => getInstanceName(i) === instanceName);

        if (inst) {
          statusSnapshot = resolveStatusSnapshot(inst);
        } else if (token) {
          console.warn(`[uazapi-manager] Instance ${instanceName} not found in admin list, trying instance-level status check`);
          statusSnapshot = await resolveStatusFromToken(token);
        }
      } catch (adminErr) {
        console.warn(`[uazapi-manager] Admin fetchInstances failed, trying instance-level status check for: ${instanceName}`);
        if (token) {
          statusSnapshot = await resolveStatusFromToken(token);
        }
      }

      const effectiveConnected = statusSnapshot.state === "unknown" ? storedConnected : statusSnapshot.connected;
      const effectiveState = statusSnapshot.state === "unknown" && storedConnected ? "connected" : statusSnapshot.state;

      result = {
        state: effectiveState,
        connected: effectiveConnected,
        owner: statusSnapshot.owner,
      };

      if (intData?.id && statusSnapshot.state !== "unknown") {
        await supabase
          .from("integrations")
          .update({ status: statusSnapshot.connected ? "connected" : "disconnected" })
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
      const normalizedQuotedMessageId = normalizeQuotedMessageId(payload.quoted_message_id);
      if (normalizedQuotedMessageId) {
        textBody.replyid = normalizedQuotedMessageId;
      }
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
      const normalizedQuotedMessageId = normalizeQuotedMessageId(payload.quoted_message_id);
      if (normalizedQuotedMessageId) { mediaBody.replyid = normalizedQuotedMessageId; }
      if (payload.file_name) mediaBody.fileName = payload.file_name;
      
      result = await uazapiInstance("/send/media", "POST", token!, mediaBody);
    
    } else if (action === "send_to_group") {
      // ✅ CORRIGIDO: Usar /send/text para grupos
      const jid = group_id?.includes("@g.us") ? group_id : `${group_id}@g.us`;
      
      const groupBody: Record<string, unknown> = { number: jid, text: message };
      const normalizedQuotedMessageId = normalizeQuotedMessageId(payload.quoted_message_id);
      if (normalizedQuotedMessageId) { groupBody.replyid = normalizedQuotedMessageId; }
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
      const normalizedQuotedMessageId = normalizeQuotedMessageId(payload.quoted_message_id);
      if (normalizedQuotedMessageId) { mediaBody.replyid = normalizedQuotedMessageId; }
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
      
      // Filter: instances that belong to this account (roy-prefix), SDR instances, explicitly linked,
      // or custom-named instances (e.g. [CANAL], [COMERCIAL]) that don't belong to other accounts
      const accountPrefix = `roy-${accountId.slice(0,8)}`;
      const otherAccountPattern = /^roy-[a-f0-9]{8}/;
      const filtered = all.filter((i) => {
        const name = getInstanceName(i);
        if (!name) return false;
        // Include if: matches this account prefix, is SDR, is already linked, or is a custom-named instance
        // Exclude only instances that clearly belong to OTHER accounts (roy-{otherPrefix})
        if (name.startsWith(accountPrefix) || name.startsWith("sdr-") || linkedNames.has(name)) return true;
        // If it starts with roy- but not our prefix, it belongs to another account
        if (otherAccountPattern.test(name) && !name.startsWith(accountPrefix)) return false;
        // Otherwise include it (custom-named instances like [CANAL], [COMERCIAL], etc.)
        return true;
      });
      
      result = { instances: filtered.map(i => {
        const name = getInstanceName(i);
        const linked = name ? linkedMap.get(name) : null;
        const snapshot = resolveStatusSnapshot(i);
        return {
          ...i,
          name,
          status: snapshot.connected ? "connected" : snapshot.state === "unknown" ? "disconnected" : snapshot.state,
          owner: snapshot.owner || getInstanceOwner(i),
          hasToken: !!getInstanceToken(i),
          linked_sector_id: linked?.sector_id || null,
          linked_integration_id: linked?.id || null,
          linked_status: linked?.status || null,
        };
      }) };
    
    } else if (action === "list_sector_instances") {
      const { data: ints } = await supabase
        .from("integrations")
        .select("id, sector_id, config, status, display_name, pin_hash, created_at")
        .eq("account_id", accountId)
        .eq("type", "whatsapp")
        .not("sector_id", "is", null);

      const integrations = (ints || []) as any[];
      const liveStatuses = await resolveLiveStatusesForIntegrations(
        integrations.map((integration) => ({
          config: asRecord(integration.config),
          status: integration.status,
        })),
      );

      const pendingStatusUpdates = integrations
        .map((integration) => {
          const config = asRecord(integration.config) || {};
          const currentInstanceName = getString(config.instance_name);
          const liveStatus = currentInstanceName ? liveStatuses.get(currentInstanceName) : undefined;
          if (!liveStatus || liveStatus.state === "unknown") return null;

          const nextStatus = liveStatus.connected ? "connected" : "disconnected";
          if (integration.status === nextStatus) return null;

          return supabase.from("integrations").update({ status: nextStatus }).eq("id", integration.id);
        })
        .filter(Boolean);

      if (pendingStatusUpdates.length > 0) {
        await Promise.all(pendingStatusUpdates);
      }

      result = {
        instances: integrations.map((integration: any) => {
          const config = asRecord(integration.config) || {};
          const currentInstanceName = getString(config.instance_name) || "";
          const liveStatus = currentInstanceName ? liveStatuses.get(currentInstanceName) : undefined;
          const effectiveConnected = !liveStatus || liveStatus.state === "unknown"
            ? integration.status === "connected"
            : liveStatus.connected;

          return {
            id: integration.id,
            sector_id: integration.sector_id,
            instance_name: currentInstanceName,
            status: effectiveConnected ? "connected" : "disconnected",
            raw_state: liveStatus?.state || integration.status || "unknown",
            display_name: integration.display_name,
            has_pin: !!integration.pin_hash,
            phone_number: getString(config.phone_number) || liveStatus?.owner || getString(config.owner) || "",
            profile_name: getString(config.profile_name) || getString(config.profileName) || "",
            profile_pic_url: getString(config.profile_pic_url) || getString(config.profilePicUrl) || "",
            created_at: integration.created_at,
            webhook_configured: typeof config.webhook_configured === "boolean" ? config.webhook_configured : undefined,
          };
        }),
      };
    
    } else if (action === "add_instance_to_sector") {
      const allRaw = await uazapiAdmin("/instance/all", "GET");
      const all = extractInstancesList(allRaw);
      const inst = all.find((i) => getInstanceName(i) === payload.instance_name);
      if (!inst) return new Response(JSON.stringify({ error: "Instance not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const statusSnapshot = resolveStatusSnapshot(inst);
      await supabase.from("integrations").insert({ account_id: accountId, type: "whatsapp", sector_id, status: statusSnapshot.connected ? "connected" : "disconnected", config: { provider: "uazapi", instance_name: payload.instance_name, instance_token: getInstanceToken(inst), owner: getInstanceOwner(inst) } });
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
