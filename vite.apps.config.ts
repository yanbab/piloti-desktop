import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Builds ONE Domicile app module: APP=<id> vite build -c vite.apps.config.ts
// -> dist/apps/<id>/<id>.js (own directory = own origin and storage).
const id = process.env.APP ?? "hello";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: {
    outDir: `dist/apps/${id}`,
    emptyOutDir: true,
    rollupOptions: {
      input: `src/apps/${id}/main.tsx`,
      output: { entryFileNames: `${id}.js`, inlineDynamicImports: true },
      preserveEntrySignatures: "exports-only",
    },
  },
});
