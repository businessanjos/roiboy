import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global fetch retry for Supabase network errors
const originalFetch = window.fetch.bind(window);
window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
  const url = typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : "";
  const isSupabase = url.includes("supabase.co");
  
  if (!isSupabase) return originalFetch(...args);
  
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await originalFetch(...args);
    } catch (err) {
      if (attempt === 2) throw err;
      const isNetwork = err instanceof TypeError && (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError"));
      if (!isNetwork) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return originalFetch(...args); // fallback
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
