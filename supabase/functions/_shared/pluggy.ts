// Helper compartilhado para autenticar com Pluggy
// Troca CLIENT_ID + CLIENT_SECRET por API Key (válida por ~2h)
// Cache simples em memória do edge runtime

const PLUGGY_BASE = "https://api.pluggy.ai";

let cachedKey: { value: string; expiresAt: number } | null = null;

export async function getPluggyApiKey(): Promise<string> {
  const now = Date.now();
  if (cachedKey && cachedKey.expiresAt > now + 60_000) {
    return cachedKey.value;
  }

  const clientId = Deno.env.get("PLUGGY_CLIENT_ID");
  const clientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET não configurados");
  }

  const res = await fetch(`${PLUGGY_BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  const json = await res.json();
  if (!res.ok || !json.apiKey) {
    throw new Error(`Pluggy auth falhou [${res.status}]: ${JSON.stringify(json)}`);
  }

  cachedKey = {
    value: json.apiKey,
    expiresAt: now + 2 * 60 * 60 * 1000, // 2h
  };
  return json.apiKey;
}

export async function pluggyFetch(path: string, init: RequestInit = {}): Promise<any> {
  const apiKey = await getPluggyApiKey();
  const res = await fetch(`${PLUGGY_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`Pluggy ${path} falhou [${res.status}]: ${text}`);
  }
  return json;
}
