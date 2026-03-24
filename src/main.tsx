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

createRoot(document.getElementById("root")!).render(<App />);
