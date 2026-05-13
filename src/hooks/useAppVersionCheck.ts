import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Polls /version.json on a schedule. When the version reported by the server
 * differs from the one bundled into the running app, we know a new deploy is
 * live and the assets the browser cached are stale.
 *
 * On change we surface a non-dismissable toast giving the user the option to
 * reload immediately. Auto-reload kicks in after 30s if they don't act.
 *
 * Dev mode is a no-op — Vite's HMR already handles freshness.
 */

const VERSION_URL = "/version.json";
const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const AUTO_RELOAD_DELAY_MS = 30 * 1000;
const TOAST_ID = "app-version-update";
const STORAGE_KEY = "app:initial-version";

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

export function useAppVersionCheck() {
  const initialVersionRef = useRef<string | null>(null);
  const promptedRef = useRef(false);

  useEffect(() => {
    // Skip in development — assets are not hashed and version.json may not exist.
    if (import.meta.env.DEV) return;

    let cancelled = false;
    let timer: number | undefined;

    const init = async () => {
      const current = await fetchAppVersion();
      if (cancelled) return;
      if (!current) return; // no version.json shipped yet — nothing to compare against
      initialVersionRef.current = current;
      try {
        sessionStorage.setItem(STORAGE_KEY, current);
      } catch {
        /* ignore */
      }
    };

    const check = async () => {
      if (promptedRef.current) return;
      const latest = await fetchAppVersion();
      if (cancelled || !latest) return;
      const initial = initialVersionRef.current;
      if (!initial) {
        initialVersionRef.current = latest;
        return;
      }
      if (latest !== initial) {
        promptedRef.current = true;
        toast("Nova versão disponível", {
          id: TOAST_ID,
          description: "Recarregue para aplicar as últimas atualizações.",
          duration: AUTO_RELOAD_DELAY_MS,
          action: {
            label: "Recarregar agora",
            onClick: () => hardReloadApp(),
          },
        });
        // Auto-reload as a safety net so users never stay on a stale build.
        window.setTimeout(() => hardReloadApp(), AUTO_RELOAD_DELAY_MS);
      }
    };

    const onFocus = () => {
      // When the user returns to the tab, check immediately.
      check();
    };

    init();
    timer = window.setInterval(check, POLL_INTERVAL_MS);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
}
