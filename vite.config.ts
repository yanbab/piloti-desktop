import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function webMetaProxyPlugin(): Plugin {
  return {
    name: "web-meta-proxy",
    configureServer(server) {
      server.middlewares.use("/__web_meta", async (req, res) => {
        try {
          const reqUrl = new URL(req.url ?? "", "http://localhost");
          const targetRaw = reqUrl.searchParams.get("url") ?? "";
          const prefersDark = reqUrl.searchParams.get("dark") === "1";
          const target = new URL(targetRaw);
          if (
            (target.protocol !== "https:" && target.protocol !== "http:") ||
            target.hostname === "localhost" ||
            target.hostname === "127.0.0.1"
          ) {
            res.statusCode = 400;
            res.end(JSON.stringify({ title: null, themeColor: null }));
            return;
          }
          const upstream = await fetch(target.href, {
            signal: AbortSignal.timeout(4500),
            headers: { "user-agent": "ResidenceDesktop/1.0" },
          });
          const ct = upstream.headers.get("content-type")?.toLowerCase() ?? "";
          if (!upstream.ok || (ct && !ct.includes("html"))) {
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ title: null, themeColor: null }));
            return;
          }
          const html = (await upstream.text()).slice(0, 65536);
          const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
          const title = titleMatch?.[1]
            ? titleMatch[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
            : null;
          const metas: Array<{ content: string; media: string }> = [];
          const metaRegex =
            /<meta\b([^>]*\bname\s*=\s*["']theme-color["'][^>]*)>/gi;
          let m: RegExpExecArray | null;
          while ((m = metaRegex.exec(html)) !== null) {
            const c = m[1].match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
            if (!c) continue;
            const media =
              m[1].match(/\bmedia\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() ??
              "";
            metas.push({ content: c, media });
          }
          let themeColor: string | null = null;
          for (const entry of metas) {
            if (!entry.media) {
              themeColor = entry.content;
              break;
            }
            if (
              (entry.media.includes("prefers-color-scheme: dark") &&
                prefersDark) ||
              (entry.media.includes("prefers-color-scheme: light") &&
                !prefersDark)
            ) {
              themeColor = entry.content;
              break;
            }
          }
          if (!themeColor && metas.length > 0) themeColor = metas[0].content;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ title, themeColor }));
        } catch {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ title: null, themeColor: null }));
        }
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), webMetaProxyPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "xdg-basedir": path.resolve(__dirname, "./src/lib/xdg-basedir.ts"),
      "xdg-desktop-entry": path.resolve(__dirname, "./src/lib/xdg-desktop-entry.ts"),
      "xdg-icon-theme": path.resolve(__dirname, "./src/lib/xdg-icon-theme.ts"),
    },
  },
  // @domicile-desktop/* track "next" directly; skip Vite pre-bundling so
  // SDK/React updates in node_modules never serve stale `.vite/deps` caches.
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "zod",
      "@cprussin/option-result",
    ],
    exclude: ["@domicile-desktop/sdk", "@domicile-desktop/react"],
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

