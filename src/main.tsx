import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global fetch retry + timeout for backend requests that may hang on published apps
const originalFetch = window.fetch.bind(window);
const SUPABASE_FETCH_TIMEOUT_MS = 12000;

const buildTimedFetchArgs = (args: Parameters<typeof fetch>, signal: AbortSignal): Parameters<typeof fetch> => {
  const [input, init] = args;

  if (input instanceof Request) {
    return [new Request(input, { ...(init ?? {}), signal })];
  }

  return [input, { ...(init ?? {}), signal }];
};

window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
  const [input, init] = args;
  const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
  const isSupabase = url.includes("supabase.co");

  if (!isSupabase) return originalFetch(...args);

  const sourceSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);

  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort("Supabase request timeout"), SUPABASE_FETCH_TIMEOUT_MS);
    const abortFromSource = () => controller.abort(sourceSignal?.reason);

    if (sourceSignal?.aborted) {
      controller.abort(sourceSignal.reason);
    } else {
      sourceSignal?.addEventListener("abort", abortFromSource, { once: true });
    }

    try {
      return await originalFetch(...buildTimedFetchArgs(args, controller.signal));
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      const isNetwork = err instanceof TypeError && (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError"));
      const shouldRetry = isAbort || isNetwork;

      if (attempt === 2 || !shouldRetry) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    } finally {
      window.clearTimeout(timeoutId);
      sourceSignal?.removeEventListener("abort", abortFromSource);
    }
  }

  return originalFetch(...args);
};

// Auto-reload on dynamic import failures (stale chunks after redeploy)
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  if (!sessionStorage.getItem("chunk-reload")) {
    sessionStorage.setItem("chunk-reload", "1");
    window.location.reload();
  }
});

const isChunkLoadError = (msg: string) =>
  msg.includes("Failed to fetch dynamically imported module") ||
  msg.includes("Importing a module script failed") ||
  msg.includes("error loading dynamically imported module");

const reloadOnce = () => {
  if (!sessionStorage.getItem("chunk-reload")) {
    sessionStorage.setItem("chunk-reload", "1");
    window.location.reload();
  }
};

window.addEventListener("error", (event) => {
  if (isChunkLoadError(event.message || "")) reloadOnce();
});

window.addEventListener("unhandledrejection", (event) => {
  const msg = event.reason?.message || String(event.reason || "");
  if (isChunkLoadError(msg)) reloadOnce();
});

// Clear reload flag on successful load
window.addEventListener("load", () => {
  setTimeout(() => sessionStorage.removeItem("chunk-reload"), 5000);
});

createRoot(document.getElementById("root")!).render(<App />);
