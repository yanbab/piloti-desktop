import path from "node:path";
// @ts-expect-error -- a plain script
import { buildVersion } from "./scripts/version.mjs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { cssInTheModule, homeNotReadEarly } from "./vite.plugins";

// Builds ONE Domicile app module: APP=<id> vite build -c vite.apps.config.ts
// -> dist/apps/<id>/<id>.js (own directory = own origin and storage).
const id = process.env.APP ?? "calculator";
// These learn `$HOME` before loading the app (`src/ui/apps/files/main.tsx`):
// the app is a chunk of its own, next to the entry (the .deb copies the
// module's directory flat).
const CHUNKED = new Set(["files"]);
const chunked = CHUNKED.has(id);

export default defineConfig({
  define: { __PILOTI_VERSION__: JSON.stringify(buildVersion()) },
  base: "./",
  plugins: [react(), tailwindcss(), cssInTheModule(), ...(chunked ? [homeNotReadEarly()] : [])],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: {
    outDir: `dist/apps/${id}`,
    emptyOutDir: true,
    ...(chunked ? { cssCodeSplit: false, modulePreload: false } : null),
    rollupOptions: {
      input: `src/ui/apps/${id}/main.tsx`,
      output: chunked
        ? { entryFileNames: `${id}.js`, chunkFileNames: `${id}-[name]-[hash].js` }
        : { entryFileNames: `${id}.js`, inlineDynamicImports: true },
      preserveEntrySignatures: "exports-only",
    },
  },
});
