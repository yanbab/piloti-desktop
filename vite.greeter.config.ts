import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

import { darkFirstPaint } from "./vite.plugins";

const cssInTheModule = (): Plugin => ({
  name: "css-in-the-module",
  enforce: "post",
  generateBundle(_options, bundle) {
    const cssFiles = Object.keys(bundle).filter((name) => name.endsWith(".css"));
    const entry = Object.values(bundle).find(
      (output) => output.type === "chunk" && output.isEntry
    );
    if (entry?.type !== "chunk") return;
    for (const name of cssFiles) {
      const asset = bundle[name];
      if (asset?.type === "asset") {
        entry.code = `document.head.append(Object.assign(document.createElement("style"), { textContent: ${JSON.stringify(
          String(asset.source)
        )} }));\n${entry.code}`;
        delete bundle[name];
      }
    }
  },
});

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), cssInTheModule(), darkFirstPaint()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "xdg-basedir": path.resolve(import.meta.dirname, "src/lib/xdg/xdg-basedir.ts"),
      "xdg-desktop-entry": path.resolve(
        import.meta.dirname,
        "src/lib/xdg/xdg-desktop-entry.ts"
      ),
      "xdg-icon-theme": path.resolve(
        import.meta.dirname,
        "src/lib/xdg/xdg-icon-theme.ts"
      ),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: "src/piloti-greeter.tsx",
      output: {
        entryFileNames: "greeter.js",
        inlineDynamicImports: true,
      },
      preserveEntrySignatures: "exports-only",
    },
  },
});
