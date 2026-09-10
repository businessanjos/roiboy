// @ts-nocheck
// Helpers compartilhados da integração 3C Plus.
// A partir de 2026 a 3C exige o header `X-Agent-Id` em toda requisição feita
// com token de agente. Guardamos o id do agente por token e injetamos o header
// automaticamente em `fetch3c`.

const AGENT_ID_BY_TOKEN = new Map<string, string>();

export const AGENT_ID_REQUIRED_MESSAGE =
  "A 3C Plus exige o ID do agente. Abra Configurações > Integrações > 3C Plus > Meu Ramal e salve o ramal novamente para atualizar seu cadastro.";

export function registerAgentId(token: unknown, agentId: unknown) {
  if (typeof token !== "string" || !token.trim()) return;
  if (agentId === null || agentId === undefined) return;
  const id = String(agentId).trim();
  if (!id) return;
  AGENT_ID_BY_TOKEN.set(token.trim(), id);
}

export function agentIdForToken(token: unknown): string | null {
  if (typeof token !== "string") return null;
  return AGENT_ID_BY_TOKEN.get(token.trim()) ?? null;
}

function tokenFromRequest(url: string, init?: RequestInit): string | null {
  const fromQuery = /[?&]api_token=([^&]+)/.exec(url);
  if (fromQuery) return decodeURIComponent(fromQuery[1]);

  const headers = (init?.headers ?? {}) as Record<string, string>;
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "authorization" && typeof value === "string") {
      return value.replace(/^Bearer\s+/i, "").trim();
    }
  }
  return null;
}

/** fetch com o header `X-Agent-Id` quando conhecemos o agente daquele token. */
export async function fetch3c(url: string, init?: RequestInit): Promise<Response> {
  const token = tokenFromRequest(url, init);
  const agentId = agentIdForToken(token);
  if (!agentId) return fetch(url, init);

  return fetch(url, {
    ...init,
    headers: { ...((init?.headers ?? {}) as Record<string, string>), "X-Agent-Id": agentId },
  });
}

/** Detecta erros da 3C que reclamam do header X-Agent-Id. */
export function mentionsAgentIdHeader(...parts: Array<unknown>): boolean {
  return parts.some((part) => typeof part === "string" && /x-?agent-?id/i.test(part));
}

export function getBaseDomain(domain: string | null | undefined): string {
  if (!domain) return "https://eternumentoringclub1.3c.plus";
  let base = String(domain).trim();
  base = base.replace(/\/login\/?$/, "").replace(/\/agent\/?.*$/, "").replace(/\/supervisor\/?.*$/, "");
  base = base.replace(/\/$/, "");
  if (!base.startsWith("http")) base = "https://" + base;
  return base;
}

/** Busca o id do agente na 3C usando o token (aceita header opcional já conhecido). */
export async function fetchAgentIdFromApi(
  baseDomain: string,
  apiToken: string,
  knownAgentId?: string | null,
): Promise<{ id: string | null; name: string | null; email: string | null; status: number; body: string }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${apiToken}`,
  };
  if (knownAgentId) headers["X-Agent-Id"] = String(knownAgentId);

  const res = await fetch(`${baseDomain}/api/v1/me`, { headers });
  const body = await res.text();
  if (!res.ok) return { id: null, name: null, email: null, status: res.status, body };

  let parsed: any = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }
  const me = parsed?.data ?? parsed;
  return {
    id: me?.id != null ? String(me.id) : null,
    name: me?.name ?? me?.full_name ?? null,
    email: me?.email ?? null,
    status: res.status,
    body,
  };
}

/**
 * Resolve o id do agente do usuário: metadata > threecplus_agents > API /me.
 * Registra o id no cache de tokens para que `fetch3c` envie o header.
 */
export async function resolveUserAgentId(
  supabaseAdmin: any,
  opts: {
    userId: string;
    accountId: string;
    apiToken: string;
    baseDomain: string;
    metadata?: Record<string, unknown> | null;
  },
): Promise<string | null> {
  const { userId, accountId, apiToken, baseDomain, metadata } = opts;

  const fromMetadata = metadata?.agent_id;
  if (fromMetadata) {
    const id = String(fromMetadata).trim();
    if (id) {
      registerAgentId(apiToken, id);
      return id;
    }
  }

  const { data: agentRow } = await supabaseAdmin
    .from("threecplus_agents")
    .select("external_agent_id")
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (agentRow?.external_agent_id) {
    const id = String(agentRow.external_agent_id);
    registerAgentId(apiToken, id);
    return id;
  }

  const profile = await fetchAgentIdFromApi(baseDomain, apiToken);
  if (profile.id) {
    registerAgentId(apiToken, profile.id);
    await supabaseAdmin.from("threecplus_agents").upsert(
      {
        account_id: accountId,
        external_agent_id: profile.id,
        external_name: profile.name,
        external_email: profile.email,
        api_token: apiToken,
        token_status: "ok",
        user_id: userId,
        is_tracked: true,
      },
      { onConflict: "account_id,external_agent_id" },
    );
    return profile.id;
  }

  return null;
}

/** Resolve o id do agente dono de um token de conta (sem usuário associado). */
export async function resolveAgentIdByToken(
  supabaseAdmin: any,
  accountId: string,
  apiToken: string,
  baseDomain: string,
): Promise<string | null> {
  const cached = agentIdForToken(apiToken);
  if (cached) return cached;

  const { data } = await supabaseAdmin
    .from("threecplus_agents")
    .select("external_agent_id")
    .eq("account_id", accountId)
    .eq("api_token", apiToken)
    .maybeSingle();

  if (data?.external_agent_id) {
    registerAgentId(apiToken, data.external_agent_id);
    return String(data.external_agent_id);
  }

  const profile = await fetchAgentIdFromApi(baseDomain, apiToken);
  if (profile.id) {
    registerAgentId(apiToken, profile.id);
    return profile.id;
  }
  return null;
}
