import path from "node:path";
// @ts-expect-error -- a plain script
import { buildVersion } from "./scripts/version.mjs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { cssInTheModule, darkFirstPaint, homeNotReadEarly } from "./vite.plugins";

export default defineConfig({
  define: { __PILOTI_VERSION__: JSON.stringify(buildVersion()) },
  base: "./",
  plugins: [react(), tailwindcss(), cssInTheModule(), darkFirstPaint(), homeNotReadEarly()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "xdg-basedir": path.resolve(__dirname, "src/core/xdg/xdg-basedir.ts"),
      "xdg-desktop-entry": path.resolve(__dirname, "src/core/xdg/xdg-desktop-entry.ts"),
      "xdg-icon-theme": path.resolve(__dirname, "src/core/xdg/xdg-icon-theme.ts"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Apps and their libraries load when first opened: dynamic imports stay
    // chunks of their own, which Domicile's builder keeps. One stylesheet, as
    // the entry injects it.
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      input: "src/piloti-desktop.tsx",
      output: {
        entryFileNames: "shell.js",
        chunkFileNames: "shell-chunks/[name]-[hash].js",
      },
      preserveEntrySignatures: "exports-only",
    },
  },
});

