import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Polls /version.json on a schedule. When the version reported by the server
 * differs from the one the app booted with, a new deploy is live and the
 * assets cached by the browser are stale.
 *
 * The hook only exposes state — the UI (NewVersionDialog) decides how to ask
 * the user, offering "Atualizar agora" or "Atualizar depois" (até 5 adiamentos
 * de 30 minutos, depois a atualização passa a ser obrigatória).
 *
 * Dev mode is a no-op — Vite's HMR already handles freshness.
 */

const VERSION_URL = "/version.json";
const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const STORAGE_KEY = "app:initial-version";
const DEFER_STATE_KEY = "app:version-defer-state";
export const MAX_DEFERS = 5;
const DEFER_INTERVAL_MS = 30 * 60 * 1000; // 30 min

interface DeferState {
  version: string;
  count: number;
  nextRemindAt: number;
}

function readDeferState(remoteVersion: string): { count: number; nextRemindAt: number } {
  try {
    const raw = localStorage.getItem(DEFER_STATE_KEY);
    if (!raw) return { count: 0, nextRemindAt: 0 };
    const parsed = JSON.parse(raw) as Partial<DeferState>;
    if (
      typeof parsed.version === "string" &&
      typeof parsed.count === "number" &&
      typeof parsed.nextRemindAt === "number" &&
      parsed.version === remoteVersion
    ) {
      return { count: parsed.count, nextRemindAt: parsed.nextRemindAt };
    }
  } catch {
    /* ignore */
  }
  return { count: 0, nextRemindAt: 0 };
}

function persistDefer(remoteVersion: string): number {
  const current = readDeferState(remoteVersion);
  const next: DeferState = {
    version: remoteVersion,
    count: current.count + 1,
    nextRemindAt: Date.now() + DEFER_INTERVAL_MS,
  };
  try {
    localStorage.setItem(DEFER_STATE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next.count;
}

export async function fetchAppVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data?.version ?? null;
  } catch {
    return null;
  }
}

export function hardReloadApp() {
  // Best-effort cache wipe before reloading so the next paint loads the new
  // hashed assets even on aggressive browser/CDN caches.
  try {
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(DEFER_STATE_KEY);
  } catch {
    /* ignore */
  }
  // Reload with a fresh URL so the browser/CDN cannot reuse stale HTML/chunks.
  const url = new URL(window.location.href);
  url.searchParams.set("app_reload", Date.now().toString());
  window.location.replace(url.toString());
}

/** Version recorded the first time the app booted in this session, if any. */
export function getInitialAppVersion(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export interface UseAppVersionCheckResult {
  hasNewVersion: boolean;
  remoteVersion: string | null;
  canDefer: boolean;
  deferUpdate: () => void;
}

export function useAppVersionCheck(): UseAppVersionCheckResult {
  const initialVersionRef = useRef<string | null>(__APP_VERSION__ || null);
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
  const [deferCount, setDeferCount] = useState(0);
  const reminderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Skip in development — assets are not hashed and version.json may not exist.
    if (import.meta.env.DEV) return;

    let cancelled = false;
    let timer: number | undefined;

    const clearReminder = () => {
      if (reminderTimeoutRef.current) {
        clearTimeout(reminderTimeoutRef.current);
        reminderTimeoutRef.current = null;
      }
    };

    const init = async () => {
      const current = await fetchAppVersion();
      if (cancelled || !current) return;
      try {
        sessionStorage.setItem(STORAGE_KEY, initialVersionRef.current || current);
      } catch {
        /* ignore */
      }
      if (initialVersionRef.current && initialVersionRef.current !== current) {
        const { count, nextRemindAt } = readDeferState(current);
        setRemoteVersion(current);
        setDeferCount(count);
        if (count >= MAX_DEFERS || nextRemindAt <= Date.now()) {
          setHasNewVersion(true);
        }
      }
    };

    const check = async () => {
      const latest = await fetchAppVersion();
      if (cancelled || !latest) return;

      const initial = initialVersionRef.current;
      if (!initial) {
        initialVersionRef.current = latest;
        return;
      }
      if (latest === initial) return;

      const { count, nextRemindAt } = readDeferState(latest);
      const now = Date.now();
      const forced = count >= MAX_DEFERS;

      setRemoteVersion(latest);
      setDeferCount(count);

      if (!forced && nextRemindAt > now) {
        clearReminder();
        reminderTimeoutRef.current = setTimeout(() => {
          void check();
        }, nextRemindAt - now);
        return;
      }

      setHasNewVersion(true);
    };

    const onFocus = () => {
      void check();
    };

    void init();
    timer = window.setInterval(check, POLL_INTERVAL_MS);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      clearReminder();
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const deferUpdate = useCallback(() => {
    if (!remoteVersion) return;
    const count = persistDefer(remoteVersion);
    setDeferCount(count);
    setHasNewVersion(false);
  }, [remoteVersion]);

  return {
    hasNewVersion,
    remoteVersion,
    canDefer: deferCount < MAX_DEFERS,
    deferUpdate,
  };
}
