import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "xdg-desktop": path.resolve(__dirname, "./src/lib/xdg-desktop.ts"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: "dist-web",
  },
});

