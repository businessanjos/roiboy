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

// Prevents saving the same UAZAPI instance_token on two integrations in different sectors.
// Returns a Response (409) when a conflict is found, or null when it's safe to proceed.
// The DB has a trigger enforcing this too — this helper just produces a nicer message.
async function checkTokenSectorConflict(
  supabase: any,
  accountId: string,
  instanceToken: string | null | undefined,
  sectorId: string | null | undefined,
  currentIntegrationId?: string | null,
): Promise<Response | null> {
  const token = (instanceToken || "").trim();
  if (!token) return null;
  try {
    let query = supabase
      .from("integrations")
      .select("id, sector_id, display_name, config")
      .eq("account_id", accountId)
      .eq("type", "whatsapp")
      .filter("config->>instance_token", "eq", token);
    if (currentIntegrationId) query = query.neq("id", currentIntegrationId);
    const { data } = await query;
    const conflict = (data || []).find((row: any) => {
      const provider = row?.config?.provider;
      if (provider && provider !== "uazapi") return false;
      const rowSector = row?.sector_id || null;
      const targetSector = sectorId || null;
      return rowSector !== targetSector;
    });
    if (conflict) {
      const name =
        conflict.display_name ||
        conflict.config?.instance_name ||
        conflict.id;
      const sector = conflict.sector_id || "(sem setor)";
      const message =
        `Este instance_token já está vinculado à integração "${name}" (setor ${sector}). ` +
        `Cada número/instância WhatsApp precisa ter um token exclusivo por setor. ` +
        `Reconecte via QR Code para gerar um token novo antes de vincular a este setor.`;
      console.error(`[uazapi-manager] 🚫 token/sector conflict:`, {
        token_suffix: token.slice(-6),
        target_sector: sectorId,
        conflict_id: conflict.id,
        conflict_sector: conflict.sector_id,
      });
      return new Response(
        JSON.stringify({ error: message, code: "token_sector_conflict", conflict_integration_id: conflict.id }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.warn("[uazapi-manager] checkTokenSectorConflict failed (allowing write, DB trigger will still guard):", err);
  }
  return null;
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

function isUazapiProvider(provider: unknown): boolean {
  const normalized = getString(provider)?.toLowerCase();
  return !normalized || normalized === "uazapi";
}

type StatusSnapshot = {
  state: string;
  connected: boolean;
  owner?: string;
  loggedOut?: boolean;
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

function getMediaExtension(value: unknown): string | undefined {
  const raw = getString(value);
  if (!raw) return undefined;
  const clean = raw.split(/[?#]/, 1)[0] || raw;
  const match = clean.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase();
}

function resolveOutboundMediaType(payload: Record<string, unknown>): string {
  const requested = (getString(payload.media_type) || "image").toLowerCase();
  const extension = getMediaExtension(payload.file_name) || getMediaExtension(payload.media_url);
  const mimetype = (getString(payload.media_mimetype) || "").toLowerCase();

  // iPhone/QuickTime .MOV is unreliable as native WhatsApp "video" through Uazapi.
  // Sending it as "document" preserves the file and avoids silent provider rejection.
  if (requested === "video" && (extension === "mov" || extension === "qt" || mimetype === "video/quicktime")) {
    return "document";
  }

  return requested;
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
  const checkedInstance = asRecord(instance.checked_instance);
  const data = asRecord(instance.data);
  return instance.token || instance.instance?.token || getString(checkedInstance?.token) || getString(data?.token);
}

function getInstanceUpdatedAt(instance: UazapiInstanceLike): number {
  const nestedInstance = asRecord(instance.instance);
  const updatedValue =
    getString((instance as Record<string, unknown>)?.updated) ||
    getString((instance as Record<string, unknown>)?.created) ||
    getString(instance.data?.updated) ||
    getString(instance.data?.created) ||
    getString(nestedInstance?.updated) ||
    getString(nestedInstance?.created);

  if (!updatedValue) return 0;
  const ts = Date.parse(updatedValue);
  return Number.isNaN(ts) ? 0 : ts;
}

type InstanceMatchFailure =
  | "no_instances"
  | "missing_instance_name"
  | "instance_name_not_found"
  | "token_mismatch";

let lastInstanceMatchFailure: InstanceMatchFailure | undefined;

function getLastInstanceMatchFailure(): InstanceMatchFailure | undefined {
  return lastInstanceMatchFailure;
}

function selectBestInstanceMatch(
  instances: UazapiInstanceLike[],
  instanceName?: string,
  preferredToken?: string,
): UazapiInstanceLike | undefined {
  lastInstanceMatchFailure = undefined;

  if (instances.length === 0) {
    lastInstanceMatchFailure = "no_instances";
    return undefined;
  }

  // CRÍTICO: nunca cair para "qualquer instância da conta".
  // Sem instance_name não há como garantir que a instância pertence ao setor,
  // então só aceitamos correspondência explícita por token.
  if (!instanceName) {
    const tokenOnly = preferredToken
      ? instances.find((instance) => getInstanceToken(instance) === preferredToken)
      : undefined;
    if (!tokenOnly) {
      lastInstanceMatchFailure = preferredToken ? "token_mismatch" : "missing_instance_name";
      console.warn(
        "[uazapi-manager] ⛔ selectBestInstanceMatch sem instance_name e sem token correspondente — nenhuma instância será usada.",
      );
    }
    return tokenOnly;
  }

  const named = instances.filter((instance) => getInstanceName(instance) === instanceName);

  // Sem match exato de nome => sem status ao vivo. Isso evita que um setor
  // "herde" o status e o número (owner) da instância de outro setor
  // (ex.: CS exibindo o número do Comercial).
  if (named.length === 0) {
    lastInstanceMatchFailure = "instance_name_not_found";
    console.warn(
      `[uazapi-manager] ⛔ Nenhuma instância com nome exato "${instanceName}" no servidor — sem fallback para outras instâncias.`,
    );
    return undefined;
  }

  const tokenMatch = preferredToken
    ? named.find((instance) => getInstanceToken(instance) === preferredToken)
    : undefined;

  if (tokenMatch) return tokenMatch;

  if (preferredToken) {
    console.warn(
      `[uazapi-manager] ⚠️ Instância "${instanceName}" encontrada, mas o token armazenado não corresponde ao do servidor.`,
    );
  }

  return [...named].sort((a, b) => {
    const aStatus = resolveStatusSnapshot(a);
    const bStatus = resolveStatusSnapshot(b);

    if (aStatus.connected !== bStatus.connected) {
      return aStatus.connected ? -1 : 1;
    }

    const aUpdated = getInstanceUpdatedAt(a);
    const bUpdated = getInstanceUpdatedAt(b);
    return bUpdated - aUpdated;
  })[0];
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

function detectLoggedOut(payload: unknown): boolean {
  const rec = asRecord(payload);
  if (!rec) return false;
  const msg = (getString(rec.message) || getString(rec.error) || "").toLowerCase();
  const code = typeof rec.code === "number" ? rec.code : undefined;
  if (code === 401) return true;
  if (/logged out from another device|loggedoutfromanotherdevice|logged out|invalid token|session (?:closed|ended|expired)/i.test(msg)) return true;
  return false;
}

function isServerWideHealthPayload(payload: unknown): boolean {
  const rec = asRecord(payload);
  if (!rec) return false;
  // UAZAPI returns a server-wide health check (build/info/instance_counts) when the
  // token is unknown to that server. We must NOT treat this as an instance being connected.
  const info = getString(rec.info) || "";
  if (/server health check/i.test(info)) return true;
  if (asRecord(rec.build) && asRecord(rec.instance_counts)) return true;
  return false;
}

async function resolveStatusFromToken(token: string, server?: ServerConfig): Promise<StatusSnapshot> {
  try {
    const instanceInfo = await uazapiInstance("/status", "GET", token, undefined, server);
    console.log(`[uazapi-manager] Instance status fallback response:`, JSON.stringify(instanceInfo).substring(0, 300));

    if (detectLoggedOut(instanceInfo)) {
      console.warn(`[uazapi-manager] ⚠️ Instance logged out from another device (detected via /status)`);
      return { state: "logged_out", connected: false, loggedOut: true };
    }

    if (isServerWideHealthPayload(instanceInfo)) {
      // /status is also used by UAZAPI as a server-wide health endpoint. Some
      // servers return the health payload even when a token header is present,
      // so this is NOT enough evidence to mark the instance logged out or to
      // reprovision it. Continue to /me and only fail on explicit auth errors.
      console.warn(`[uazapi-manager] ⚠️ /status returned server-wide health payload — treating as inconclusive and checking /me.`);
    } else {
      const snapshot = resolveStatusSnapshot(instanceInfo);
      if (snapshot.state !== "unknown") {
        return snapshot;
      }
    }
  } catch (instErr) {
    const msg = String((instErr as Error)?.message || "");
    console.warn(`[uazapi-manager] Instance-level status check failed:`, instErr);
    if (/logged out|401|invalid token/i.test(msg)) {
      return { state: "logged_out", connected: false, loggedOut: true };
    }
  }

  try {
    const meInfo = await uazapiInstance("/me", "GET", token, undefined, server);
    if (detectLoggedOut(meInfo)) {
      return { state: "logged_out", connected: false, loggedOut: true };
    }
    if (meInfo && (meInfo.id || meInfo.wid || meInfo.phone || meInfo.number)) {
      const owner = meInfo.phone || meInfo.number || meInfo.id;
      console.log(`[uazapi-manager] /me endpoint confirmed connected:`, owner);
      return { state: "connected", connected: true, owner };
    }
  } catch (e) {
    const msg = String((e as Error)?.message || "");
    console.log(`[uazapi-manager] /me endpoint also failed:`, msg);
    if (/logged out|401|invalid token/i.test(msg)) {
      return { state: "logged_out", connected: false, loggedOut: true };
    }
  }

  return { state: "unknown", connected: false };
}

async function resolveLiveStatusesForIntegrations(
  integrations: Array<{ config?: Record<string, unknown>; status?: string | null; sector_id?: string | null }>,
  supabase?: any,
  accountId?: string,
): Promise<Map<string, StatusSnapshot>> {
  const snapshots = new Map<string, StatusSnapshot>();
  // Group integrations by sector_id so we hit the correct UAZAPI server for each.
  const bySector = new Map<string | null, Array<{ name: string; token: string }>>();

  for (const integration of integrations) {
    const config = integration.config || {};
    const instanceName = getString(config.instance_name);
    const token = getString(config.instance_token);
    if (!instanceName) continue;
    const sid = (integration.sector_id ?? null) as string | null;
    const arr = bySector.get(sid) || [];
    arr.push({ name: instanceName, token: token || "" });
    bySector.set(sid, arr);
  }

  for (const [sid, items] of bySector.entries()) {
    const server = supabase && accountId
      ? await resolveServerForSector(supabase, accountId, sid)
      : GLOBAL_SERVER;

    const remaining = new Map(items.map((i) => [i.name, i.token]));

    try {
      const allRaw = await uazapiAdmin("/instance/all", "GET", undefined, server);
      const all = extractInstancesList(allRaw);

      for (const [instanceName, token] of Array.from(remaining.entries())) {
        const match = selectBestInstanceMatch(all, instanceName, token);
        if (!match) continue;

        snapshots.set(instanceName, resolveStatusSnapshot(match));
        remaining.delete(instanceName);
      }
    } catch (adminErr) {
      console.warn(`[uazapi-manager] Admin fetchInstances failed for sector ${sid} (server: ${server.source})`);
    }

    await Promise.all(
      Array.from(remaining.entries()).map(async ([instanceName, token]) => {
        if (!token) return;
        const snapshot = await resolveStatusFromToken(token, server);
        snapshots.set(instanceName, snapshot);
      }),
    );
  }

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

// ============================================================
// 🚦 PER-TOKEN SEND QUEUE
// Serializes outbound /send/* calls per WhatsApp instance (token).
// When 3+ closers share the same number, this prevents:
//   - Concurrent bursts that look like spam to WhatsApp
//   - UAZAPI 429/500 from request contention on the same instance
//   - Race conditions on message ordering
//
// Each token gets its own FIFO promise chain. We also enforce a
// minimum gap (jitter) between consecutive sends on the same token,
// so the cadence looks human even under load.
// ============================================================
const tokenSendChains = new Map<string, Promise<unknown>>();
const tokenLastSendAt = new Map<string, number>();
const MIN_GAP_MS = 700;   // baseline gap between sends on same token
const JITTER_MS = 800;    // additional random 0..JITTER_MS
const MAX_QUEUE_WAIT_MS = 45_000; // safety: don't queue forever

async function enqueueSend<T>(token: string, label: string, fn: () => Promise<T>): Promise<T> {
  const queueKey = token || "__no_token__";
  const previous = tokenSendChains.get(queueKey) || Promise.resolve();
  const enqueuedAt = Date.now();

  const run = previous
    .catch(() => {}) // isolate: previous failure must not poison this send
    .then(async () => {
      const waited = Date.now() - enqueuedAt;
      if (waited > MAX_QUEUE_WAIT_MS) {
        console.warn(`[send-queue] ⚠️ ${label} waited ${waited}ms in queue (token=${queueKey.slice(0,8)}…) — proceeding anyway`);
      } else if (waited > 1500) {
        console.log(`[send-queue] ${label} waited ${waited}ms in queue (token=${queueKey.slice(0,8)}…)`);
      }

      // Enforce minimum gap since last send on this token
      const last = tokenLastSendAt.get(queueKey) || 0;
      const sinceLast = Date.now() - last;
      const gap = MIN_GAP_MS + Math.floor(Math.random() * JITTER_MS);
      if (sinceLast < gap) {
        await new Promise((r) => setTimeout(r, gap - sinceLast));
      }

      try {
        const result = await fn();
        return result;
      } finally {
        tokenLastSendAt.set(queueKey, Date.now());
      }
    });

  tokenSendChains.set(queueKey, run);

  // Cleanup tail to avoid memory leak on long-lived isolate
  run.finally(() => {
    if (tokenSendChains.get(queueKey) === run) {
      tokenSendChains.delete(queueKey);
    }
  }).catch(() => {});

  return run as Promise<T>;
}

/**
 * Register the uazapi-webhook URL against a specific instance on a specific server.
 * Tries the known endpoints and returns { success, webhookUrl } so callers can persist
 * the state on the integration. Non-fatal — logs but never throws.
 */
async function registerWebhookForInstance(
  token: string,
  instanceName: string,
  server: ServerConfig,
): Promise<{ success: boolean; webhookUrl: string; events: string[] }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const webhookUrl = `${supabaseUrl}/functions/v1/uazapi-webhook`;
  const events = ["messages", "messages.update", "messages.delete", "connection", "groups", "qrcode"];
  const webhookConfig = { url: webhookUrl, enabled: true, events };

  const endpoints: Array<{ path: string; method: string }> = [
    { path: "/webhook/set", method: "POST" },
    { path: "/instance/webhook", method: "PUT" },
    { path: "/webhook", method: "POST" },
  ];

  for (const ep of endpoints) {
    try {
      await uazapiInstance(ep.path, ep.method, token, webhookConfig, server);
      console.log(`[uazapi-manager] Auto-configured webhook for "${instanceName}" via ${ep.path} on ${server.host}`);
      return { success: true, webhookUrl, events };
    } catch (err) {
      console.log(`[uazapi-manager] webhook ${ep.path} failed on ${server.host}: ${(err as Error).message}`);
    }
  }

  try {
    await uazapiAdmin(`/instance/webhook/${instanceName}`, "PUT", webhookConfig, server);
    console.log(`[uazapi-manager] Auto-configured webhook via admin endpoint for "${instanceName}"`);
    return { success: true, webhookUrl, events };
  } catch (err) {
    console.warn(`[uazapi-manager] Auto-configure webhook FAILED for "${instanceName}": ${(err as Error).message}`);
  }

  return { success: false, webhookUrl, events };
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
  
  // UAZAPI retorna { error: false } em sucesso, { error: true|"msg" } em falha
  if (json.error === true || json.error === "true") {
    throw new Error(json.message || json.error_message || "Erro ao enviar mensagem");
  }
  // Algumas rotas devolvem { error: "mensagem descritiva" } com HTTP 4xx/5xx
  if (typeof json.error === "string" && json.error.trim().length > 0) {
    throw new Error(json.error);
  }

  // "Method Not Allowed" = endpoint errado
  if (json.message === "Method Not Allowed" || r.status === 405) {
    throw new Error(`Endpoint inválido: ${endpoint}`);
  }

  // Qualquer outro HTTP não-2xx sem campo error tratado acima
  if (!r.ok) {
    throw new Error(json.message || json.error_message || `Falha no WhatsApp (HTTP ${r.status})`);
  }
  
  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const token_jwt = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token_jwt);
    if (authError || !authData?.user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userId = authData.user.id;

    const { data: userData } = await supabase.from("users").select("id, name, account_id, role, is_also_admin, zapp_signature_enabled").eq("auth_user_id", userId).single();
    if (!userData) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const payload = await req.json();
    const { action, sector_id, phone, message, group_id, integration_id } = payload;
    const accountId = userData.account_id;

    // Signature helper: prepends "*Name | Eternum*\n" to outbound human messages.
    // Skipped when payload.add_signature === false (used by automations/playbook) or when user disabled it.
    const firstName = (userData.name || "").trim().split(/\s+/)[0] || userData.name || "Consultor";
    const signatureEnabled = userData.zapp_signature_enabled !== false && payload.add_signature !== false;
    const applySignature = (txt: string | undefined | null): string => {
      const t = (txt ?? "").toString();
      if (!signatureEnabled) return t;
      const header = `*${userData.name || firstName} | Eternum*`;
      if (!t) return header;
      // Avoid double-signing if the frontend already prepended a custom signature.
      if (/^\*[^*\n]+\|\s*Eternum\*/.test(t) || /^\*[^*\n]{2,80}:\*\s*\n/.test(t)) return t;
      return `${header}\n${t}`;
    };

    console.log(`[uazapi-manager] Action: ${action}, integration_id: ${integration_id}, sector_id: ${sector_id}`);

    // Buscar integração - PRIORIZAR integration_id
    let intData: { id: string; config: { provider?: string; instance_token?: string; instance_name?: string }; status: string; sector_id?: string | null } | null = null;
    
    if (integration_id) {
      const { data } = await supabase.from("integrations").select("id, config, status, sector_id").eq("id", integration_id).eq("account_id", accountId).single();
      intData = data;

      // HARD GUARD: se o caller passou sector_id junto, ele DEVE bater com o
      // sector_id da integração. Isso bloqueia envios cross-sector causados
      // por estado stale no frontend (ex.: CS mandando pelo número Comercial).
      // Ações somente-leitura de setor são liberadas; apenas envios reais
      // (send_*) são bloqueados.
      const sendActions = ["send_text", "send_media", "send_to_group", "send_media_to_group"];
      if (
        sendActions.includes(action) &&
        sector_id &&
        intData &&
        intData.sector_id &&
        intData.sector_id !== sector_id
      ) {
        console.error(
          `[uazapi-manager] ABORT cross-sector send: integration ${integration_id} belongs to sector "${intData.sector_id}" but caller passed sector_id="${sector_id}".`
        );
        return new Response(
          JSON.stringify({
            error: "Setor incorreto para esta instância",
            detail: `A instância selecionada pertence a outro setor. Recarregue a página, selecione o setor correto e tente novamente.`,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (sector_id) {
      // CRITICAL: For sectors with multiple instances, prefer the connected one
      // ORDER BY status ASC puts 'connected' before 'disconnected' alphabetically
      const { data } = await supabase.from("integrations").select("id, config, status, sector_id")
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
      const { data } = await supabase.from("integrations").select("id, config, status, sector_id").eq("account_id", accountId).eq("type", "whatsapp").is("sector_id", null).limit(1);
      intData = data?.[0] || null;
    }

    const token = intData?.config?.instance_token;
    const instanceName = intData?.config?.instance_name || `roy-${accountId.slice(0,8)}`;

    console.log(`[uazapi-manager] Found integration: ${intData?.id || "NONE"}, token: ${token ? "present" : "MISSING"}`);

    // Resolve which UAZAPI server to use for this request.
    // Priority: explicit sector_id > integration's sector > global fallback.
    // This isolates "Operações" (new server) from "Vendas" (legacy global server).
    // Priority: integration_id (which carries the token) > sector_id > global.
    // Resolving by integration_id ensures the server matches the token's owning instance,
    // even when the UI sector differs from the integration's sector (e.g. a "vendas"
    // conversation viewed under the "operacoes" sector).
    let sectorServer: ServerConfig = GLOBAL_SERVER;
    if (integration_id) {
      sectorServer = await resolveServerForIntegrationId(supabase, accountId, integration_id);
    } else if (sector_id) {
      sectorServer = await resolveServerForSector(supabase, accountId, sector_id);
    }

    // Ações que requerem token
    const tokenRequiredActions = ["send_text", "send_media", "send_to_group", "send_media_to_group", "list_groups", "disconnect", "delete_message", "check_number"];
    if (tokenRequiredActions.includes(action) && !token) {
      console.error(`[uazapi-manager] Token required but missing for action: ${action}`);
      return new Response(JSON.stringify({ error: "WhatsApp não configurado para este setor." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== ANTI-SPAM PROTECTION ==========
    if (["send_text", "send_media"].includes(action) && phone && message) {
      const cleanPhoneCheck = phone.replace(/\D/g, "");
      const effectiveSectorId = sector_id || null;
      
      // 1. Check identical messages sent to multiple contacts in last 30 min
      // ⚠️ Filtered by sender_user_id: each closer has their own duplicate counter,
      // so multiple agents on the same instance don't block each other.
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: duplicateCheck } = await supabase
        .from("zapp_messages")
        .select("id, phone_e164")
        .eq("account_id", accountId)
        .eq("sender_user_id", userData.id)
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
        console.warn(`[uazapi-manager] ⚠️ SPAM BLOCKED: User ${userData.name} sent identical message to ${uniquePhones.size} different contacts in last 30min.`);
        return new Response(JSON.stringify({ 
          error: "Você já enviou esta mensagem idêntica para muitos contatos. Personalize o texto para cada destinatário.",
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

    // ========== INSTANCE HEALTH CHECK ==========
    // Bloqueia envios se a instância está sabidamente desconectada — evita falhas silenciosas.
    const sendActions = ["send_text", "send_media", "send_to_group", "send_media_to_group"];
    if (sendActions.includes(action)) {
      if (intData?.status === "disconnected") {
        console.warn(`[uazapi-manager] ⛔ Send bloqueado: instância ${intData?.config?.instance_name} está disconnected`);
        return new Response(JSON.stringify({
          error: "WHATSAPP_DISCONNECTED: a instância de WhatsApp deste setor está desconectada. Reconecte em Configurações → WhatsApp antes de enviar.",
          code: "WHATSAPP_DISCONNECTED",
          instance_name: intData?.config?.instance_name,
        }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ========== AUTO NUMBER VALIDATION (first send to new contact) ==========
    // Só para envios individuais: se não temos histórico com este número, valida no uazapi antes
    // pra evitar "envio fantasma" para número sem WhatsApp.
    if (["send_text", "send_media"].includes(action) && phone) {
      const cleanPhoneAuto = phone.replace(/\D/g, "");
      try {
        const { data: existingConv } = await supabase
          .from("zapp_conversations")
          .select("id")
          .eq("account_id", accountId)
          .or(`phone_e164.eq.+${cleanPhoneAuto},phone_e164.eq.${cleanPhoneAuto}`)
          .limit(1)
          .maybeSingle();

        if (!existingConv) {
          console.log(`[uazapi-manager] 🔎 Primeiro envio para ${cleanPhoneAuto} — validando no uazapi`);
          const checkRes: any = await uazapiInstance("/chat/check", "POST", token!, { numbers: [cleanPhoneAuto] }, sectorServer).catch((e) => {
            console.warn(`[uazapi-manager] check falhou (seguindo mesmo assim):`, (e as Error).message);
            return null;
          });
          if (checkRes) {
            const arr = Array.isArray(checkRes) ? checkRes : (checkRes?.numbers || checkRes?.data || []);
            const entry = Array.isArray(arr) ? arr.find((x: any) => String(x?.query || x?.number || "").replace(/\D/g, "").endsWith(cleanPhoneAuto.slice(-8))) : null;
            const exists = entry?.exists ?? entry?.isInWhatsapp ?? entry?.valid;
            if (exists === false) {
              console.warn(`[uazapi-manager] ⛔ Número ${cleanPhoneAuto} não tem WhatsApp`);
              return new Response(JSON.stringify({
                error: "NUMBER_HAS_NO_WHATSAPP: este número não possui WhatsApp ativo. Confirme o número com o cliente antes de tentar novamente.",
                code: "NUMBER_HAS_NO_WHATSAPP",
                phone: cleanPhoneAuto,
              }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
          }
        }
      } catch (e) {
        console.warn(`[uazapi-manager] auto-validation falhou (não-fatal):`, (e as Error).message);
      }
    }
    // ========== END HEALTH CHECK ==========

    const invalidTokenResponse = async (err: unknown) => {
      const msg = String((err as Error)?.message || "");
      if (!/invalid token|401/i.test(msg)) return null;

      if (intData?.id) {
        await supabase
          .from("integrations")
          .update({ status: "disconnected" })
          .eq("id", intData.id);
      }

      return new Response(JSON.stringify({
        error: "WHATSAPP_DISCONNECTED: token inválido. A instância foi marcada como desconectada; gere um novo QR Code e reconecte o WhatsApp.",
        code: "WHATSAPP_DISCONNECTED",
        instance_name: instanceName,
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    };

    let result: unknown = { success: true };

    if (action === "check_token_conflict") {
      // Lightweight pre-save probe used by the Connections UI to warn the user
      // before they attempt to adopt a token that is already bound to another sector.
      const probeToken = (getString(payload.instance_token) || "").trim();
      if (!probeToken) {
        result = { conflict: false, reason: "empty_token" };
      } else {
        const { data } = await supabase
          .from("integrations")
          .select("id, sector_id, display_name, config, status")
          .eq("account_id", accountId)
          .eq("type", "whatsapp")
          .filter("config->>instance_token", "eq", probeToken);
        const rows = (data || []).filter((row: any) => {
          const provider = row?.config?.provider;
          return !provider || provider === "uazapi";
        });
        const currentId = integration_id || null;
        const targetSector = sector_id || null;
        const crossSector = rows.find((row: any) => {
          if (currentId && row.id === currentId) return false;
          const rowSector = row?.sector_id || null;
          return rowSector !== targetSector;
        });
        const sameSectorOther = rows.find((row: any) => {
          if (currentId && row.id === currentId) return false;
          const rowSector = row?.sector_id || null;
          return rowSector === targetSector;
        });
        if (crossSector) {
          result = {
            conflict: true,
            scope: "cross_sector",
            integration_id: crossSector.id,
            sector_id: crossSector.sector_id,
            display_name: crossSector.display_name || crossSector.config?.instance_name || null,
            message:
              `Este instance_token já está vinculado à integração "${crossSector.display_name || crossSector.config?.instance_name || crossSector.id}" ` +
              `em outro setor. Reconecte via QR Code para gerar um token novo antes de vincular a este setor.`,
          };
        } else if (sameSectorOther) {
          result = {
            conflict: true,
            scope: "same_sector",
            integration_id: sameSectorOther.id,
            display_name: sameSectorOther.display_name || sameSectorOther.config?.instance_name || null,
            message: `Este token já está vinculado a outra integração deste mesmo setor.`,
          };
        } else {
          result = { conflict: false };
        }
      }
    } else if (action === "server_health") {
      // Lightweight reachability probe: pings the sector's UAZAPI host directly.
      // Used by the UI to surface a clear "server offline / 404" banner instead
      // of falsely showing "connected" while sends silently fail.
      const host = sectorServer?.host || GLOBAL_SERVER?.host || null;
      let online = false;
      let httpStatus: number | null = null;
      let errorMessage: string | null = null;
      if (!host) {
        errorMessage = "no_host_configured";
      } else {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 5000);
          const res = await fetch(`${host.replace(/\/$/, "")}/status`, {
            method: "GET",
            signal: ctrl.signal,
          });
          clearTimeout(timer);
          httpStatus = res.status;
          // Consume body to avoid resource leak.
          try { await res.text(); } catch { /* ignore */ }
          // UAZAPI returns 200 with a JSON health payload when the server is up.
          online = res.status >= 200 && res.status < 500 && res.status !== 404;
        } catch (err) {
          errorMessage = (err as Error)?.message || "fetch_failed";
          online = false;
        }
      }
      console.log(`[uazapi-manager] server_health host=${host} status=${httpStatus} online=${online} err=${errorMessage || "-"}`);
      result = {
        online,
        host,
        http_status: httpStatus,
        error: errorMessage,
        sector_id: sector_id || null,
        integration_id: integration_id || null,
      };
    } else if (action === "status") {
      const storedConnected = intData?.status === "connected";
      const tokenMissingForUazapi = !!intData?.id && isUazapiProvider(intData.config?.provider) && !token;
      let statusSnapshot: StatusSnapshot = {
        state: storedConnected ? "connected" : "unknown",
        connected: storedConnected,
      };
      let matchError: string | undefined;

      try {
        const allRaw = await uazapiAdmin("/instance/all", "GET", undefined, sectorServer);
        const all = extractInstancesList(allRaw);
        const inst = selectBestInstanceMatch(all, instanceName, token);
        if (!inst) {
          const failure = getLastInstanceMatchFailure();
          matchError =
            failure === "missing_instance_name"
              ? "Integração sem instance_name definido — não é possível identificar a instância do setor."
              : failure === "instance_name_not_found"
                ? `Instância "${instanceName}" não existe neste servidor UAZAPI.`
                : failure === "token_mismatch"
                  ? "O token armazenado não corresponde a nenhuma instância deste servidor."
                  : "Nenhuma instância disponível neste servidor UAZAPI.";
        }

        if (inst) {

          const liveSnapshot = resolveStatusSnapshot(inst);
          const liveToken = getInstanceToken(inst);

          // If the admin list says the instance is connected but our stored token is stale,
          // sync the live token immediately. Otherwise the UI shows "connected" while sends fail
          // with "invalid token".
          if (liveToken && liveToken !== token && intData?.id && isUazapiProvider(intData.config?.provider)) {
            const conflictResp = await checkTokenSectorConflict(supabase, accountId, liveToken, intData.sector_id, intData.id);
            if (conflictResp) {
              console.warn(`[uazapi-manager] Skipping live-token auto-sync for "${instanceName}" — token already bound to another sector.`);
              statusSnapshot = liveSnapshot;
            } else {
              console.warn(`[uazapi-manager] 🔁 Syncing live token for instance "${instanceName}" from admin list`);
              const mergedConfig = {
                ...(intData.config || {}),
                provider: "uazapi",
                instance_name: instanceName,
                instance_token: liveToken,
              };
              await supabase
                .from("integrations")
                .update({ config: mergedConfig, status: liveSnapshot.connected ? "connected" : "disconnected" })
                .eq("id", intData.id);
              intData = { ...intData, config: mergedConfig, status: liveSnapshot.connected ? "connected" : "disconnected" };
            }
          } else if (liveSnapshot.connected && token && !liveToken && isUazapiProvider(intData?.config?.provider)) {

            // Some admin responses omit the token. In that case, never trust name-only status;
            // verify the stored token so stale credentials don't appear connected.
            const tokenSnapshot = await resolveStatusFromToken(token, sectorServer);
            statusSnapshot = tokenSnapshot.connected
              ? liveSnapshot
              : tokenSnapshot.state !== "unknown"
                ? tokenSnapshot
                : liveSnapshot;
          } else {
            statusSnapshot = liveSnapshot;
          }
        } else if (token) {
          console.warn(`[uazapi-manager] Instance ${instanceName} not found in admin list, trying instance-level status check`);
          statusSnapshot = await resolveStatusFromToken(token, sectorServer);
        } else if (tokenMissingForUazapi) {
          console.warn(`[uazapi-manager] ⛔ Stored integration "${instanceName}" has no UAZAPI token and no live instance match. Forcing disconnected.`);
          statusSnapshot = { state: "disconnected", connected: false };
        }
      } catch (adminErr) {
        console.warn(`[uazapi-manager] Admin fetchInstances failed, trying instance-level status check for: ${instanceName}`);
        if (token) {
          statusSnapshot = await resolveStatusFromToken(token, sectorServer);
        } else if (tokenMissingForUazapi) {
          statusSnapshot = { state: "disconnected", connected: false };
        }
      }

      const effectiveConnected = statusSnapshot.connected;
      const effectiveState = statusSnapshot.state === "unknown" ? "disconnected" : statusSnapshot.state;

      // Passive status checks must never reprovision an instance. Recreating the
      // token from a polling request can make a healthy shared WhatsApp number
      // look disconnected for every user. Manual recovery stays in reset_instance.
      const autoReconnect = statusSnapshot.loggedOut
        ? { attempted: false, error: "manual_reset_required" }
        : undefined;

      result = {
        state: effectiveState,
        connected: effectiveConnected,
        owner: statusSnapshot.owner,
        logged_out: statusSnapshot.loggedOut === true,
        needs_reconnect: statusSnapshot.loggedOut === true,
        auto_reconnect: autoReconnect,
      };

      if (intData?.id && (statusSnapshot.state !== "unknown" || tokenMissingForUazapi) && !statusSnapshot.loggedOut) {
        await supabase
          .from("integrations")
          .update({ status: statusSnapshot.connected ? "connected" : "disconnected" })
          .eq("id", intData.id);
      } else if (intData?.id && statusSnapshot.loggedOut && !autoReconnect?.qr_code) {
        await supabase
          .from("integrations")
          .update({ status: "disconnected" })
          .eq("id", intData.id);
      }
    
    
    } else if (action === "create") {
      const r = await uazapiAdmin("/instance/init", "POST", { name: instanceName }, sectorServer);
      const newToken = r.token || r.instance?.token;
      await supabase.from("integrations").upsert({ account_id: accountId, type: "whatsapp", sector_id: sector_id || null, status: "disconnected", config: { provider: "uazapi", instance_name: instanceName, instance_token: newToken } }, { onConflict: "account_id,type,sector_id" });
      result = { ...r, token: newToken };
    
    } else if (action === "connect" || action === "qrcode") {
      // UAZAPI: POST /instance/connect with instance token in header returns QR code
      const instName = payload.instance_name || instanceName;
      let activeToken = token;

      // Helper: init the instance on the (possibly isolated) sector server and persist new token
      const initOnSectorServer = async () => {
        console.log(`[uazapi-manager] Initializing instance "${instName}" on sector server: ${sectorServer?.host || 'global'}`);
        const initRes = await uazapiAdmin("/instance/init", "POST", { name: instName }, sectorServer);
        const newToken = initRes?.token || initRes?.instance?.token;
        if (!newToken) {
          throw new Error("Failed to initialize instance: no token returned");
        }
        // Persist new token (and ensure provider/instance_name are set)
        if (intData?.id) {
          const mergedConfig = {
            ...(intData.config || {}),
            provider: "uazapi",
            instance_name: instName,
            instance_token: newToken,
          };
          await supabase.from("integrations").update({ config: mergedConfig, status: "disconnected" }).eq("id", intData.id);
        }
        return newToken;
      };

      // If we don't have a token yet, init now
      if (!activeToken) {
        try {
          activeToken = await initOnSectorServer();
        } catch (e) {
          console.error("[uazapi-manager] init failed:", e);
          return new Response(
            JSON.stringify({ error: `Failed to initialize instance on sector server: ${(e as Error).message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Try connect with current token; if auth fails (token belongs to a different server), re-init and retry
      try {
        const ensuredToken = activeToken!;
        const connectResult: any = await uazapiInstance("/instance/connect", "POST", ensuredToken, {}, sectorServer);
        result = connectResult;
        const isAuthError = connectResult?.code === 401 || /invalid token/i.test(connectResult?.message || "");
        if (isAuthError) {
          console.warn("[uazapi-manager] Connect returned auth error, re-initializing instance on sector server");
          activeToken = await initOnSectorServer();
          result = await uazapiInstance("/instance/connect", "POST", activeToken!, {}, sectorServer);
        }
      } catch (e) {
        const msg = (e as Error)?.message || "";
        if (/401|invalid token/i.test(msg)) {
          try {
            console.warn("[uazapi-manager] Connect failed with invalid token, re-initializing instance on sector server");
            activeToken = await initOnSectorServer();
            result = await uazapiInstance("/instance/connect", "POST", activeToken!, {}, sectorServer);
          } catch (retryErr) {
            console.error("[uazapi-manager] connect retry after invalid token failed:", retryErr);
            return new Response(
              JSON.stringify({ error: `Failed to fetch QR code: ${(retryErr as Error).message}` }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
        console.error("[uazapi-manager] connect failed:", e);
        return new Response(
          JSON.stringify({ error: `Failed to fetch QR code: ${(e as Error).message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
        }
      }
    
    } else if (action === "disconnect") {
      try { await uazapiInstance("/logout", "POST", token!, undefined, sectorServer); } catch {}
      if (intData?.id) await supabase.from("integrations").update({ status: "disconnected" }).eq("id", intData.id);
      result = { disconnected: true };

    } else if (action === "reset_instance") {
      // Force reprovision: logout old token, init new instance on the correct sector server,
      // persist the fresh token, then request a QR code. Use when the instance is stuck with
      // an invalid token / 404 and normal reconnect isn't working.
      const instName = payload.instance_name || instanceName;
      console.log(`[uazapi-manager] RESET requested for instance "${instName}" on server: ${sectorServer?.host || 'global'}`);

      // Best-effort logout with the (possibly stale) token — ignore all errors.
      if (token) {
        try { await uazapiInstance("/logout", "POST", token, undefined, sectorServer); } catch (e) {
          console.warn(`[uazapi-manager] reset: logout failed (ignored): ${(e as Error)?.message}`);
        }
      }

      // Force a fresh init on the sector server to get a brand new token.
      let freshToken: string | null = null;
      try {
        const initRes = await uazapiAdmin("/instance/init", "POST", { name: instName }, sectorServer);
        freshToken = initRes?.token || initRes?.instance?.token || null;
        if (!freshToken) throw new Error("no token returned from /instance/init");
      } catch (e) {
        console.error("[uazapi-manager] reset: init failed:", e);
        return new Response(
          JSON.stringify({ error: `Falha ao reprovisionar instância no servidor: ${(e as Error).message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Register webhook on the NEW server so inbound messages reach us.
      const webhookState = await registerWebhookForInstance(freshToken, instName, sectorServer);

      // Persist new token, webhook state, and mark disconnected.
      if (intData?.id) {
        const mergedConfig = {
          ...(intData.config || {}),
          provider: "uazapi",
          instance_name: instName,
          instance_token: freshToken,
          webhook_configured: webhookState.success,
          webhook_url: webhookState.success ? webhookState.webhookUrl : null,
          webhook_events: webhookState.success ? webhookState.events : undefined,
        };
        await supabase
          .from("integrations")
          .update({ config: mergedConfig, status: "disconnected" })
          .eq("id", intData.id);
      }

      // Immediately request a QR code with the new token.
      try {
        const connectResult: any = await uazapiInstance("/instance/connect", "POST", freshToken, {}, sectorServer);
        result = {
          ...connectResult,
          reset: true,
          new_token_issued: true,
          webhook_configured: webhookState.success,
        };
      } catch (e) {
        console.error("[uazapi-manager] reset: /instance/connect failed:", e);
        return new Response(
          JSON.stringify({ error: `Instância reprovisionada, mas falha ao gerar QR: ${(e as Error).message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }


    } else if (action === "adopt_instance") {
      // Adopt an existing UAZAPI instance by pasting its instance_token (created manually
      // on the UAZAPI panel). Validates the token against the sector server, then persists
      // it into integrations.config so we skip creating a duplicate instance.
      const pastedToken = getString(payload.instance_token)?.trim();
      const providedName = getString(payload.instance_name)?.trim() || instanceName;

      if (!pastedToken) {
        return new Response(
          JSON.stringify({ error: "Informe o instance token da UAZAPI." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate token against the resolved sector server.
      const snapshot = await resolveStatusFromToken(pastedToken, sectorServer);
      if (snapshot.loggedOut) {
        return new Response(
          JSON.stringify({ error: "Token inválido ou não reconhecido pelo servidor deste setor. Verifique se copiou o instance token correto (não o admin token)." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Block adopting a token that is already tied to another sector.
      const adoptConflict = await checkTokenSectorConflict(supabase, accountId, pastedToken, sector_id, intData?.id);
      if (adoptConflict) return adoptConflict;

      // Register webhook on the server so inbound messages reach us. Non-fatal.
      const webhookState = await registerWebhookForInstance(pastedToken, providedName, sectorServer);


      // Persist the adopted token on the current integration (or create/update).
      const newStatus = snapshot.connected ? "connected" : "disconnected";
      const baseAdoptedConfig = {
        provider: "uazapi",
        instance_name: providedName,
        instance_token: pastedToken,
        webhook_configured: webhookState.success,
        webhook_url: webhookState.success ? webhookState.webhookUrl : null,
        webhook_events: webhookState.success ? webhookState.events : undefined,
        ...(snapshot.owner ? { owner: snapshot.owner } : {}),
      };
      if (intData?.id) {
        const mergedConfig = { ...(intData.config || {}), ...baseAdoptedConfig };
        await supabase
          .from("integrations")
          .update({ config: mergedConfig, status: newStatus })
          .eq("id", intData.id);
      } else {
        await supabase.from("integrations").insert({
          account_id: accountId,
          type: "whatsapp",
          sector_id: sector_id || null,
          status: newStatus,
          config: baseAdoptedConfig,
        });
      }


      // If not connected yet, request a QR code with the adopted token.
      let qrPayload: any = null;
      if (!snapshot.connected) {
        try {
          qrPayload = await uazapiInstance("/instance/connect", "POST", pastedToken, {}, sectorServer);
        } catch (e) {
          console.warn(`[uazapi-manager] adopt: /instance/connect failed (non-fatal):`, e);
        }
      }

      result = {
        adopted: true,
        connected: snapshot.connected,
        owner: snapshot.owner || null,
        instance_name: providedName,
        ...(qrPayload || {}),
      };

    } else if (action === "send_text") {
      // ✅ CORRIGIDO: Usar /send/text em vez de /message/sendText
      const cleanPhone = phone?.replace(/\D/g, "");
      if (!cleanPhone || cleanPhone.length < 10) {
        return new Response(JSON.stringify({ error: "Número de telefone inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      const textBody: Record<string, unknown> = { number: cleanPhone, text: applySignature(message) };
      const normalizedQuotedMessageId = normalizeQuotedMessageId(payload.quoted_message_id);
      if (normalizedQuotedMessageId) {
        textBody.replyid = normalizedQuotedMessageId;
      }
      if (payload.mentions) textBody.mentions = payload.mentions;
      
      try {
        result = await enqueueSend(token!, `send_text user=${userData.name}`, () =>
          uazapiInstance("/send/text", "POST", token!, textBody, sectorServer)
        );
      } catch (err) {
        const response = await invalidTokenResponse(err);
        if (response) return response;
        throw err;
      }
    
    } else if (action === "send_media") {
      // ✅ NOVO: Suporte a envio de mídia
      const cleanPhone = phone?.replace(/\D/g, "");
      if (!cleanPhone || cleanPhone.length < 10) {
        return new Response(JSON.stringify({ error: "Número de telefone inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const outboundMediaType = resolveOutboundMediaType(payload);
      
      const mediaBody: Record<string, unknown> = { 
        number: cleanPhone, 
        type: outboundMediaType,
        file: payload.media_url,
        text: applySignature(payload.caption || "")
      };
      const normalizedQuotedMessageId = normalizeQuotedMessageId(payload.quoted_message_id);
      if (normalizedQuotedMessageId) { mediaBody.replyid = normalizedQuotedMessageId; }
      if (payload.file_name) mediaBody.fileName = payload.file_name;
      
      try {
        result = await enqueueSend(token!, `send_media user=${userData.name} type=${outboundMediaType}`, () =>
          uazapiInstance("/send/media", "POST", token!, mediaBody, sectorServer)
        );
      } catch (err) {
        const response = await invalidTokenResponse(err);
        if (response) return response;
        throw err;
      }
      // 🚨 Diagnóstico: detectar respostas sem id (falha silenciosa)
      let r: any = result;
      let hasId = !!(r?.id || r?.messageid || r?.data?.id || r?.data?.messageid);
      // 🔁 Retry automático para PTT (áudio) — uazapi às vezes devolve resposta vazia
      // enquanto faz conversão do webm/opus do navegador. Tentamos mais 2x antes de
      // marcar como falha definitiva.
      if (!hasId && outboundMediaType === "ptt") {
        for (let attempt = 1; attempt <= 2 && !hasId; attempt++) {
          const waitMs = 800 * attempt;
          console.warn(`[uazapi-manager] ⏳ PTT sem messageid, retry ${attempt}/2 em ${waitMs}ms...`);
          await new Promise((res) => setTimeout(res, waitMs));
          try {
            result = await enqueueSend(token!, `send_media retry${attempt} user=${userData.name} type=${outboundMediaType}`, () =>
              uazapiInstance("/send/media", "POST", token!, mediaBody, sectorServer)
            );
            r = result;
            hasId = !!(r?.id || r?.messageid || r?.data?.id || r?.data?.messageid);
          } catch (retryErr) {
            console.error(`[uazapi-manager] retry ${attempt} falhou:`, retryErr);
          }
        }
      }
      if (!hasId) {
        console.error(`[uazapi-manager] ⚠️ /send/media sem messageid após retries! type=${outboundMediaType} requested=${payload.media_type} server=${sectorServer.source} response=${JSON.stringify(result).substring(0, 400)}`);
      }
    
    } else if (action === "send_to_group") {
      // ✅ CORRIGIDO: Usar /send/text para grupos
      const jid = group_id?.includes("@g.us") ? group_id : `${group_id}@g.us`;
      
      const groupBody: Record<string, unknown> = { number: jid, text: applySignature(message) };
      const normalizedQuotedMessageId = normalizeQuotedMessageId(payload.quoted_message_id);
      if (normalizedQuotedMessageId) { groupBody.replyid = normalizedQuotedMessageId; }
      if (payload.mentions) groupBody.mentions = payload.mentions;
      
      try {
        result = await enqueueSend(token!, `send_to_group user=${userData.name}`, () =>
          uazapiInstance("/send/text", "POST", token!, groupBody, sectorServer)
        );
      } catch (err) {
        const response = await invalidTokenResponse(err);
        if (response) return response;
        throw err;
      }
    
    } else if (action === "send_media_to_group") {
      // ✅ NOVO: Mídia em grupos
      const jid = group_id?.includes("@g.us") ? group_id : `${group_id}@g.us`;
      const outboundMediaType = resolveOutboundMediaType(payload);
      
      const mediaBody: Record<string, unknown> = { 
        number: jid, 
        type: outboundMediaType,
        file: payload.media_url,
        text: applySignature(payload.caption || "")
      };
      const normalizedQuotedMessageId = normalizeQuotedMessageId(payload.quoted_message_id);
      if (normalizedQuotedMessageId) { mediaBody.replyid = normalizedQuotedMessageId; }
      if (payload.file_name) mediaBody.fileName = payload.file_name;
      
      try {
        result = await enqueueSend(token!, `send_media_to_group user=${userData.name} type=${outboundMediaType}`, () =>
          uazapiInstance("/send/media", "POST", token!, mediaBody, sectorServer)
        );
      } catch (err) {
        const response = await invalidTokenResponse(err);
        if (response) return response;
        throw err;
      }
      // 🔁 Retry PTT em grupos (mesma lógica de send_media): uazapi às vezes
      // devolve resposta sem messageid enquanto converte webm/opus.
      {
        let r: any = result;
        let hasId = !!(r?.id || r?.messageid || r?.data?.id || r?.data?.messageid);
        if (!hasId && outboundMediaType === "ptt") {
          for (let attempt = 1; attempt <= 2 && !hasId; attempt++) {
            const waitMs = 800 * attempt;
            console.warn(`[uazapi-manager] ⏳ PTT (grupo) sem messageid, retry ${attempt}/2 em ${waitMs}ms...`);
            await new Promise((res) => setTimeout(res, waitMs));
            try {
              result = await enqueueSend(token!, `send_media_to_group retry${attempt} user=${userData.name} type=${outboundMediaType}`, () =>
                uazapiInstance("/send/media", "POST", token!, mediaBody, sectorServer)
              );
              r = result;
              hasId = !!(r?.id || r?.messageid || r?.data?.id || r?.data?.messageid);
            } catch (retryErr) {
              console.error(`[uazapi-manager] retry grupo ${attempt} falhou:`, retryErr);
            }
          }
        }
        if (!hasId) {
          console.error(`[uazapi-manager] ⚠️ /send/media (grupo) sem messageid após retries! type=${outboundMediaType} requested=${payload.media_type} server=${sectorServer.source} response=${JSON.stringify(result).substring(0, 400)}`);
        }
      }
    
    } else if (action === "list_groups") {
      const r = await uazapiInstance("/group/fetchAllGroups", "GET", token!, undefined, sectorServer);
      result = { groups: (Array.isArray(r) ? r : r.groups || []).map((g:any) => ({ group_jid: g.JID||g.jid||g.id, name: g.Name||g.name||g.Subject })) };
    
    } else if (action === "list_instances") {
      const allRaw = await uazapiAdmin("/instance/all", "GET", undefined, sectorServer);
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
          sector_id: integration.sector_id,
        })),
        supabase,
        accountId,
      );

      const pendingStatusUpdates = integrations
        .map((integration) => {
          const config = asRecord(integration.config) || {};
          const provider = getString(config.provider) || "uazapi";
          if (provider === "meta_official") return null; // no live probe for meta
          const currentInstanceName = getString(config.instance_name);
          const liveStatus = currentInstanceName ? liveStatuses.get(currentInstanceName) : undefined;
          // For UAZAPI: unknown => disconnected (token invalid). Always sync DB to reality.
          const nextStatus = liveStatus?.connected === true ? "connected" : "disconnected";
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
          const provider = getString(config.provider) || "uazapi";
          // For UAZAPI: trust ONLY live status. If live is unknown (token invalid/expired), treat as disconnected —
          // never fall back to stale DB `status`, since that hides real disconnections.
          // For meta_official: no live check available, use DB status.
          const effectiveConnected = provider === "meta_official"
            ? integration.status === "connected"
            : (liveStatus?.connected === true);

          return {
            id: integration.id,
            sector_id: integration.sector_id,
            instance_name: currentInstanceName,
            status: effectiveConnected ? "connected" : "disconnected",
            raw_state: liveStatus?.state || (provider === "meta_official" ? integration.status : "unknown") || "unknown",
            display_name: integration.display_name,
            has_pin: !!integration.pin_hash,
            provider: getString(config.provider) || "uazapi",
            phone_number: getString(config.phone_number) || liveStatus?.owner || getString(config.owner) || "",
            profile_name: getString(config.profile_name) || getString(config.profileName) || "",
            profile_pic_url: getString(config.profile_pic_url) || getString(config.profilePicUrl) || "",
            created_at: integration.created_at,
            webhook_configured: typeof config.webhook_configured === "boolean" ? config.webhook_configured : undefined,
          };
        }),
      };
    
    } else if (action === "add_instance_to_sector") {
      const allRaw = await uazapiAdmin("/instance/all", "GET", undefined, sectorServer);
      const all = extractInstancesList(allRaw);
      const inst = all.find((i) => getInstanceName(i) === payload.instance_name);
      if (!inst) return new Response(JSON.stringify({ error: "Instance not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const statusSnapshot = resolveStatusSnapshot(inst);
      const addToken = getInstanceToken(inst);
      const addConflict = await checkTokenSectorConflict(supabase, accountId, addToken, sector_id, null);
      if (addConflict) return addConflict;
      await supabase.from("integrations").insert({ account_id: accountId, type: "whatsapp", sector_id, status: statusSnapshot.connected ? "connected" : "disconnected", config: { provider: "uazapi", instance_name: payload.instance_name, instance_token: addToken, owner: getInstanceOwner(inst) } });
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
          webhookResult = await uazapiInstance(ep.path, ep.method, token!, webhookConfig, sectorServer);
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
          webhookResult = await uazapiAdmin(`/instance/webhook/${instanceName}`, "PUT", webhookConfig, sectorServer);
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
    
    } else if (action === "check_number") {
      // Valida se um número (ou lista) possui WhatsApp ativo via uazapi /chat/check
      const rawNumbers = payload.numbers || (payload.phone ? [payload.phone] : []);
      const numbers = (Array.isArray(rawNumbers) ? rawNumbers : [rawNumbers])
        .map((n: any) => String(n).replace(/\D/g, ""))
        .filter((n: string) => n.length >= 10);
      if (numbers.length === 0) {
        return new Response(JSON.stringify({ error: "Informe ao menos um número válido em 'numbers' ou 'phone'." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const checkRaw: any = await uazapiInstance("/chat/check", "POST", token!, { numbers }, sectorServer);
      const arr = Array.isArray(checkRaw) ? checkRaw : (checkRaw?.numbers || checkRaw?.data || []);
      const normalized = (Array.isArray(arr) ? arr : []).map((x: any) => ({
        number: String(x?.query || x?.number || "").replace(/\D/g, ""),
        exists: x?.exists ?? x?.isInWhatsapp ?? x?.valid ?? null,
        jid: x?.jid || x?.lid || null,
      }));
      result = { numbers: normalized, raw: checkRaw };
    
    } else if (action === "delete_message") {
      const messageId = payload.message_id;
      if (!messageId) {
        return new Response(
          JSON.stringify({ error: "message_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      result = await uazapiInstance("/message/delete", "POST", token!, { id: messageId }, sectorServer);
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
    
    } else if (action === "get_sector_server") {
      // Returns the sector's RoyZapp server config (host + secret name).
      // Does NOT return the actual secret value.
      if (!sector_id) {
        return new Response(JSON.stringify({ error: "sector_id é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data } = await supabase
        .from("sector_settings")
        .select("royzapp_host, royzapp_admin_token_secret_name")
        .eq("account_id", accountId)
        .eq("sector_id", sector_id)
        .maybeSingle();
      const host = (data?.royzapp_host || "").trim();
      const secretName = (data?.royzapp_admin_token_secret_name || "").trim();
      const secretConfigured = secretName ? !!Deno.env.get(secretName) : false;
      result = {
        host: host || null,
        admin_token_secret_name: secretName || null,
        secret_configured: secretConfigured,
        using_global_fallback: !host || !secretName || !secretConfigured,
        global_host: UAZAPI_URL || null,
      };
    
    } else if (action === "update_sector_server") {
      // Admin-only: configure/clear the sector's custom server.
      // Pass host=null and admin_token_secret_name=null to revert to global fallback.
      if (!sector_id) {
        return new Response(JSON.stringify({ error: "sector_id é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const isAdmin = userData.role === "admin" || userData.is_also_admin === true;
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Apenas administradores podem alterar o servidor de um setor." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const newHost = payload.host ? String(payload.host).trim().replace(/\/$/, '') : null;
      const newSecretName = payload.admin_token_secret_name ? String(payload.admin_token_secret_name).trim() : null;

      // Validate host shape if provided
      if (newHost && !/^https?:\/\//i.test(newHost)) {
        return new Response(JSON.stringify({ error: "Host inválido. Use uma URL completa, ex: https://cs-roy-eternum.uazapi.com" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Validate secret exists when provided
      if (newSecretName && !Deno.env.get(newSecretName)) {
        return new Response(JSON.stringify({ error: `O secret "${newSecretName}" não está configurado no backend. Cadastre-o antes de salvar.` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Upsert into sector_settings
      const { data: existing } = await supabase
        .from("sector_settings")
        .select("id")
        .eq("account_id", accountId)
        .eq("sector_id", sector_id)
        .maybeSingle();

      if (existing) {
        const { error: updErr } = await supabase
          .from("sector_settings")
          .update({ royzapp_host: newHost, royzapp_admin_token_secret_name: newSecretName })
          .eq("id", existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("sector_settings")
          .insert({ account_id: accountId, sector_id, royzapp_host: newHost, royzapp_admin_token_secret_name: newSecretName });
        if (insErr) throw insErr;
      }
      console.log(`[uazapi-manager] Sector "${sector_id}" server updated: host=${newHost || "(global)"}, secret=${newSecretName || "(global)"}`);
      result = { success: true, host: newHost, admin_token_secret_name: newSecretName };
    }

    return new Response(JSON.stringify({ data: result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[uazapi-manager] Error:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
