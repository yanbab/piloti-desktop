import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Domicile's document has no <link> for a stylesheet, so extracted CSS is
// injected directly into the module as a <style> tag on load.
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
  plugins: [react(), tailwindcss(), cssInTheModule()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".."),
      "xdg-basedir": path.resolve(__dirname, "../lib/xdg-basedir.ts"),
      "xdg-desktop-entry": path.resolve(__dirname, "../lib/xdg-desktop-entry.ts"),
      "xdg-icon-theme": path.resolve(__dirname, "../lib/xdg-icon-theme.ts"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: "desktop.tsx",
      output: {
        entryFileNames: "shell.js",
      },
      preserveEntrySignatures: "exports-only",
    },
  },
});

