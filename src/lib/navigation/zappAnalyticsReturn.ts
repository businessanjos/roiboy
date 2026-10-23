export interface ZappConversationReturn {
  url: string;
  state: Record<string, unknown>;
}

export function getZappConversationReturn(state: unknown): ZappConversationReturn | null {
  if (!state || typeof state !== "object") return null;
  const value = (state as Record<string, unknown>).zappConversationReturn;
  if (!value || typeof value !== "object") return null;
  const candidate = value as ZappConversationReturn;
  if (typeof candidate.url !== "string" || !/^\/roy-zapp(?:\?|$)/.test(candidate.url)) return null;
  if (!candidate.state || typeof candidate.state !== "object") return null;
  return candidate;
}