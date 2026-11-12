import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "xdg-basedir": path.resolve(__dirname, "./src/lib/xdg-basedir.ts"),
      "xdg-desktop-entry": path.resolve(__dirname, "./src/lib/xdg-desktop-entry.ts"),
      "xdg-icon-theme": path.resolve(__dirname, "./src/lib/xdg-icon-theme.ts"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: "docs/demo",
    emptyOutDir: true,
  },
});

