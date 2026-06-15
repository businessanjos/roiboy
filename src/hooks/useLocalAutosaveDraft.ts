const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type DraftEnvelope<T> = {
  value: T;
  savedAt: number;
};

const canUseStorage = () => typeof window !== "undefined" && !!window.localStorage;

export function readLocalAutosaveDraft<T>(key: string | null | undefined, ttlMs = DEFAULT_TTL_MS): T | null {
  if (!key || !canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > ttlMs) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed.value ?? null;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

export function writeLocalAutosaveDraft<T>(key: string | null | undefined, value: T) {
  if (!key || !canUseStorage()) return;

  try {
    window.localStorage.setItem(key, JSON.stringify({ value, savedAt: Date.now() }));
  } catch {
    // Storage can be unavailable/full. Autosave is best-effort and must never block typing.
  }
}

export function clearLocalAutosaveDraft(key: string | null | undefined) {
  if (!key || !canUseStorage()) return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function hasDraftContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some(hasDraftContent);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).some(hasDraftContent);
  return false;
}