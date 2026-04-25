import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * Emits `version.json` into the build output so the running app can poll it
 * and detect new deploys (see src/hooks/useAppVersionCheck.ts). Without this,
 * users sit on cached HTML pointing to evicted asset hashes and have to
 * Ctrl+Shift+R every release.
 */
function versionJsonPlugin(): Plugin {
  let version = "";
  return {
    name: "roy-version-json",
    apply: "build",
    buildStart() {
      version = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify(
          { version, builtAt: new Date().toISOString() },
          null,
          2,
        ),
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    versionJsonPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: [
      {
        find: "@supabase/supabase-js",
        replacement: path.resolve(__dirname, "./node_modules/@supabase/supabase-js/dist/module/index.js"),
      },
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
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
