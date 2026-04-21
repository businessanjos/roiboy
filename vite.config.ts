import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Consolidate chunks aggressively to minimize the number of files in
    // dist/assets. Fewer files => fewer parallel PUTs to S3 during preview
    // upload => fewer "ServiceUnavailable / reduce concurrent request rate"
    // errors from the previews bucket.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          // React core (cached aggressively across builds)
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/") ||
            id.includes("/react-router") ||
            id.includes("/react-router-dom/")
          ) {
            return "vendor-react";
          }

          // All Radix primitives in a single bundle
          if (id.includes("@radix-ui/")) return "vendor-radix";

          // Supabase client + auth helpers
          if (id.includes("@supabase/")) return "vendor-supabase";

          // Charts (recharts pulls in d3 — heavy, but used in many pages)
          if (id.includes("recharts") || id.includes("/d3-")) {
            return "vendor-charts";
          }

          // Form/validation stack
          if (
            id.includes("react-hook-form") ||
            id.includes("@hookform/") ||
            id.includes("/zod/")
          ) {
            return "vendor-forms";
          }

          // Drag & drop
          if (id.includes("@dnd-kit/")) return "vendor-dnd";

          // Date utilities
          if (id.includes("date-fns")) return "vendor-dates";

          // Icons
          if (id.includes("lucide-react")) return "vendor-icons";

          // TanStack ecosystem (query, table, etc.)
          if (id.includes("@tanstack/")) return "vendor-tanstack";

          // Everything else from node_modules → one shared vendor bundle
          return "vendor";
        },
      },
    },
    // Allow larger chunks without warnings since we're intentionally
    // consolidating to reduce file count.
    chunkSizeWarningLimit: 2000,
    minify: "esbuild",
    target: "es2020",
    sourcemap: mode === "development",
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'date-fns',
      'lucide-react',
    ],
  },
}));
