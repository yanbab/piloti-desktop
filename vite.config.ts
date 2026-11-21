import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const DATA_FILES_ROOT = path.resolve(__dirname, "data/files");

function getStaticMimeType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml; charset=utf-8";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function buildStaticTreeIndex(rootDir: string): Record<string, { name: string; fileType: 0 | 1 }[]> {
  const index: Record<string, { name: string; fileType: 0 | 1 }[]> = {};
  const walk = (cur: string, vfsPath: string) => {
    if (!fs.existsSync(cur)) return;
    const list: { name: string; fileType: 0 | 1 }[] = [];
    for (const ent of fs.readdirSync(cur, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (ent.name === ".DS_Store") continue;
      if (vfsPath === "/" && ent.name === "home") continue;
      if (vfsPath === "/home" && ent.name === "user") continue;
      const full = path.join(cur, ent.name);
      const childVfs = vfsPath === "/" ? `/${ent.name}` : `${vfsPath}/${ent.name}`;
      if (ent.isDirectory()) {
        list.push({ name: ent.name, fileType: 1 });
        walk(full, childVfs);
      } else {
        list.push({ name: ent.name, fileType: 0 });
      }
    }
    index[vfsPath] = list;
  };
  walk(rootDir, "/");
  return index;
}

function dataFilesStaticPlugin(): Plugin {
  return {
    name: "data-files-static",
    configureServer(server) {
      server.middlewares.use("/__fs_tree.json", (_req, res) => {
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify(buildStaticTreeIndex(DATA_FILES_ROOT)));
      });
      server.middlewares.use("/__fs", (req, res, next) => {
        try {
          const reqPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
          const relPath = reqPath.replace(/^\/+/, "");
          if (!relPath || relPath === "home/user" || relPath.startsWith("home/user/")) {
            next();
            return;
          }
          const resolved = path.resolve(DATA_FILES_ROOT, relPath);
          if (
            resolved !== DATA_FILES_ROOT &&
            !resolved.startsWith(`${DATA_FILES_ROOT}${path.sep}`)
          ) {
            res.statusCode = 403;
            res.end();
            return;
          }
          if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
            next();
            return;
          }
          res.setHeader("content-type", getStaticMimeType(resolved));
          res.end(fs.readFileSync(resolved));
        } catch {
          next();
        }
      });
    },
    generateBundle() {
      if (!fs.existsSync(DATA_FILES_ROOT)) return;
      const walk = (cur: string, relDir: string) => {
        for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
          if (ent.name === ".DS_Store") continue;
          const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
          if (rel === "home/user" || rel.startsWith("home/user/")) continue;
          if (rel === "home" && !fs.readdirSync(path.join(cur, ent.name)).some((n) => n !== "user")) {
            continue;
          }
          const full = path.join(cur, ent.name);
          if (ent.isDirectory()) {
            walk(full, rel);
          } else {
            this.emitFile({
              type: "asset",
              fileName: `__fs/${rel}`,
              source: fs.readFileSync(full),
            });
          }
        }
      };
      walk(DATA_FILES_ROOT, "");
      this.emitFile({
        type: "asset",
        fileName: "__fs_tree.json",
        source: JSON.stringify(buildStaticTreeIndex(DATA_FILES_ROOT)),
      });
    },
  };
}

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
            res.end(
              JSON.stringify({ title: null, themeColor: null, description: null })
            );
            return;
          }
          const upstream = await fetch(target.href, {
            signal: AbortSignal.timeout(4500),
            headers: { "user-agent": "ResidenceDesktop/1.0" },
          });
          const ct = upstream.headers.get("content-type")?.toLowerCase() ?? "";
          if (!upstream.ok || (ct && !ct.includes("html"))) {
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({ title: null, themeColor: null, description: null })
            );
            return;
          }
          const html = (await upstream.text()).slice(0, 65536);
          const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
          const title = titleMatch?.[1]
            ? titleMatch[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
            : null;
          const descMatch =
            html.match(
              /<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*\bcontent\s*=\s*["']([^"']+)["'][^>]*>/i
            ) ??
            html.match(
              /<meta\b[^>]*\bcontent\s*=\s*["']([^"']+)["'][^>]*\bname\s*=\s*["']description["'][^>]*>/i
            ) ??
            html.match(
              /<meta\b[^>]*\bproperty\s*=\s*["']og:description["'][^>]*\bcontent\s*=\s*["']([^"']+)["'][^>]*>/i
            ) ??
            html.match(
              /<meta\b[^>]*\bcontent\s*=\s*["']([^"']+)["'][^>]*\bproperty\s*=\s*["']og:description["'][^>]*>/i
            );
          const description = descMatch?.[1]
            ? descMatch[1].replace(/\s+/g, " ").trim() || null
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
          let iconUrl: string | null = null;
          let startUrl: string | null = null;
          let manifestTitle: string | null = null;
          const mLink =
            html.match(
              /<link\b[^>]*\brel\s*=\s*["']manifest["'][^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/i
            ) ??
            html.match(
              /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\brel\s*=\s*["']manifest["'][^>]*>/i
            );
          if (mLink?.[1]) {
            try {
              const mUrl = new URL(mLink[1].trim(), target.href).href;
              const mRes = await fetch(mUrl, {
                signal: AbortSignal.timeout(2500),
                headers: { "user-agent": "ResidenceDesktop/1.0" },
              });
              if (mRes.ok) {
                const mJson = (await mRes.json()) as {
                  short_name?: string;
                  name?: string;
                  start_url?: string;
                  icons?: Array<{ src?: string; sizes?: string }>;
                };
                manifestTitle =
                  mJson.short_name?.trim() || mJson.name?.trim() || null;
                if (mJson.start_url) {
                  startUrl = new URL(mJson.start_url, mUrl).href;
                }
                if (Array.isArray(mJson.icons)) {
                  let best = -1;
                  for (const ic of mJson.icons) {
                    if (!ic?.src) continue;
                    const resolved = new URL(ic.src, mUrl).href;
                    const dim = (ic.sizes ?? "")
                      .split(/\s+/)
                      .map((s) => Number.parseInt(s.split("x")[0] ?? "0", 10))
                      .reduce((a, b) => (Number.isFinite(b) ? Math.max(a, b) : a), 0);
                    const score = Math.max(dim, resolved.endsWith(".svg") ? 512 : 0);
                    if (score > best) {
                      best = score;
                      iconUrl = resolved;
                    }
                  }
                }
              }
            } catch {
              // ignore manifest fetch errors
            }
          }
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              title: manifestTitle ?? title,
              themeColor,
              description,
              iconUrl,
              startUrl,
            })
          );
        } catch {
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({ title: null, themeColor: null, description: null })
          );
        }
      });

      server.middlewares.use("/__flathub", async (req, res) => {
        try {
          const reqPath = req.url ?? "/";
          const targetUrl = `https://flathub.org/api/v2${reqPath}`;
          const chunks: Buffer[] = [];
          if (req.method === "POST") {
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
          }
          const upstream = await fetch(targetUrl, {
            method: req.method ?? "GET",
            headers:
              req.method === "POST"
                ? { "content-type": "application/json" }
                : undefined,
            body:
              req.method === "POST" ? Buffer.concat(chunks) : undefined,
            signal: AbortSignal.timeout(6000),
          });
          res.statusCode = upstream.status;
          res.setHeader("content-type", "application/json");
          res.end(await upstream.text());
        } catch {
          res.statusCode = 502;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ hits: [] }));
        }
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), webMetaProxyPlugin(), dataFilesStaticPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "xdg-basedir": path.resolve(__dirname, "src/lib/xdg/xdg-basedir.ts"),
      "xdg-desktop-entry": path.resolve(__dirname, "src/lib/xdg/xdg-desktop-entry.ts"),
      "xdg-icon-theme": path.resolve(__dirname, "src/lib/xdg/xdg-icon-theme.ts"),
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
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@codemirror/") || id.includes("@lezer/")) {
            return "vendor-codemirror";
          }
          if (id.includes("@base-ui/react")) {
            return "vendor-baseui";
          }
          if (id.includes("jszip")) {
            return "vendor-jszip";
          }
          if (id.includes("react-obj-view")) {
            return "vendor-objview";
          }
          return undefined;
        },
      },
    },
  },
});

