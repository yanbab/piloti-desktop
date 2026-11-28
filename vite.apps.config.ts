import path from "node:path";
// @ts-expect-error -- a plain script
import { buildVersion } from "./scripts/version.mjs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { cssInTheModule } from "./vite.plugins";

// Builds ONE Domicile app module: APP=<id> vite build -c vite.apps.config.ts
// -> dist/apps/<id>/<id>.js (own directory = own origin and storage).
const id = process.env.APP ?? "hello";

export default defineConfig({
  define: { __PILOTI_VERSION__: JSON.stringify(buildVersion()) },
  base: "./",
  plugins: [react(), tailwindcss(), cssInTheModule()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: {
    outDir: `dist/apps/${id}`,
    emptyOutDir: true,
    rollupOptions: {
      input: `src/ui/apps/${id}/main.tsx`,
      output: { entryFileNames: `${id}.js`, inlineDynamicImports: true },
      preserveEntrySignatures: "exports-only",
    },
  },
});
