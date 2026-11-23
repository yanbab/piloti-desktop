import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { cssInTheModule } from "./vite.plugins";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), cssInTheModule()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "xdg-basedir": path.resolve(__dirname, "src/lib/xdg/xdg-basedir.ts"),
      "xdg-desktop-entry": path.resolve(__dirname, "src/lib/xdg/xdg-desktop-entry.ts"),
      "xdg-icon-theme": path.resolve(__dirname, "src/lib/xdg/xdg-icon-theme.ts"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: "src/piloti-desktop.tsx",
      output: {
        entryFileNames: "shell.js",
        inlineDynamicImports: true,
      },
      preserveEntrySignatures: "exports-only",
    },
  },
});

