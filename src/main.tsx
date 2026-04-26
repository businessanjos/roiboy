import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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
