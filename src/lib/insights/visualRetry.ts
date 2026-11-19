import { keepPreviousData } from "@tanstack/react-query";

/** Esperas entre as 3 novas tentativas automáticas de um gráfico do Insights. */
export const VISUAL_RETRY_DELAYS_MS = [10_000, 30_000, 60_000] as const;
/** Depois das 3 tentativas, o gráfico volta a tentar a cada 5 minutos. */
export const VISUAL_ERROR_REFETCH_MS = 5 * 60_000;

export function visualRetryDelay(attemptIndex: number): number {
  return VISUAL_RETRY_DELAYS_MS[Math.min(attemptIndex, VISUAL_RETRY_DELAYS_MS.length - 1)];
}

function isAbort(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === "AbortError";
}

/**
 * Opções compartilhadas por todas as consultas de gráficos do Insights:
 * nunca deixam um erro congelado nas TVs e mantêm o último dado bom na tela.
 */
export const visualQueryResilience = {
  retry: (failureCount: number, error: unknown) => !isAbort(error) && failureCount < VISUAL_RETRY_DELAYS_MS.length,
  retryDelay: visualRetryDelay,
  refetchInterval: (query: { state: { status: string } }) =>
    query.state.status === "error" ? VISUAL_ERROR_REFETCH_MS : false,
  refetchIntervalInBackground: true,
  placeholderData: keepPreviousData,
} as const;

// ---- Recarga de segurança: mais da metade dos gráficos com erro por > 10 min ----

export const VISUAL_ERROR_RELOAD_AFTER_MS = 10 * 60_000;
const RELOAD_GUARD_KEY = "insights:visual-error-reload-at";
const RELOAD_GUARD_MS = 60 * 60_000;

const registry = new Map<string, number | null>(); // id -> erro desde (ms) ou null

export function reportVisualHealth(id: string, failing: boolean, now = Date.now()) {
  const prev = registry.get(id);
  if (failing) registry.set(id, prev ?? now);
  else registry.set(id, null);
}

export function unregisterVisual(id: string) {
  registry.delete(id);
}

/** Regra pura: recarregar quando mais da metade está com erro há mais de 10 min. */
export function shouldReloadForErrors(
  states: Array<number | null>,
  now: number,
  thresholdMs = VISUAL_ERROR_RELOAD_AFTER_MS,
): boolean {
  if (states.length === 0) return false;
  const stale = states.filter((since) => since != null && now - since > thresholdMs).length;
  return stale > states.length / 2;
}

export function checkVisualErrorReload(now = Date.now()): boolean {
  if (!shouldReloadForErrors([...registry.values()], now)) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    if (now - last < RELOAD_GUARD_MS) return false; // só uma vez
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
  } catch { /* sem sessionStorage: recarrega mesmo assim */ }
  window.location.reload();
  return true;
}

let watcherStarted = false;
export function startVisualErrorWatcher() {
  if (watcherStarted || typeof window === "undefined") return;
  watcherStarted = true;
  window.setInterval(() => checkVisualErrorReload(), 60_000);
}
