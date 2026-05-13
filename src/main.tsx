import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const reloadOnce = () => {
  if (sessionStorage.getItem("chunk-reload")) return;

  sessionStorage.setItem("chunk-reload", "1");

  try {
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
    }
  } catch {
    // Best-effort cache clear only.
  }

  const url = new URL(window.location.href);
  url.searchParams.set("app_reload", Date.now().toString());
  window.location.replace(url.toString());
};

// Auto-reload on dynamic import failures (stale chunks after redeploy)
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadOnce();
});

const isChunkLoadError = (msg: string) =>
  msg.includes("Failed to fetch dynamically imported module") ||
  msg.includes("Importing a module script failed") ||
  msg.includes("error loading dynamically imported module");

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
