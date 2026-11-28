import path from "node:path";
// @ts-expect-error -- a plain script
import { buildVersion } from "./scripts/version.mjs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { cssInTheModule, homeNotReadEarly, moduleCssSources } from "./vite.plugins";

// Builds ONE Domicile app module: APP=<id> vite build -c vite.apps.config.ts
// -> dist/apps/<id>/<id>.js (own directory = own origin and storage).
const id = process.env.APP ?? "calculator";
// What a module may not need up front (a language, the Lottie player, the app
// itself for Folders) is a chunk of its own, next to the entry: the .deb copies
// the module's directory flat. Folders learns `$HOME` before loading the app
// (`src/ui/apps/files/main.tsx`), which the build checks.
const HOME_FIRST = new Set(["files"]);

export default defineConfig({
  define: { __PILOTI_VERSION__: JSON.stringify(buildVersion()) },
  base: "./",
  plugins: [
    moduleCssSources(`src/ui/apps/${id}/main.tsx`, path.resolve(__dirname, "src")),
    react(),
    tailwindcss(),
    cssInTheModule(),
    ...(HOME_FIRST.has(id) ? [homeNotReadEarly()] : []),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: {
    outDir: `dist/apps/${id}`,
    emptyOutDir: true,
    // One stylesheet, which the entry injects.
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      input: `src/ui/apps/${id}/main.tsx`,
      output: { entryFileNames: `${id}.js`, chunkFileNames: `${id}-[name]-[hash].js` },
      preserveEntrySignatures: "exports-only",
    },
  },
});
