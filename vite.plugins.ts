import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

// Domicile's document has no <link> for a stylesheet, so extracted CSS is
// injected directly into the module as a <style> tag on load.
export const cssInTheModule = (): Plugin => ({
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


// Domicile's document is white and the first thing on screen. Darken it with
// the module's very first statement, before the stylesheet or any boot work;
// the settings then apply the user's light or dark style. List it after
// `cssInTheModule`, so its line ends up on top.
export const darkFirstPaint = (): Plugin => ({
  name: "dark-first-paint",
  enforce: "post",
  generateBundle(_options, bundle) {
    for (const output of Object.values(bundle)) {
      if (output.type !== "chunk" || !output.isEntry) continue;
      output.code = `document.documentElement.classList.add("dark");Object.assign(document.documentElement.style,{backgroundColor:"#222222",colorScheme:"dark"});\n${output.code}`;
    }
  },
});

/**
 * The entry learns `$HOME` before anything reads it (`core/state/vfs-home.ts`).
 * With the shell in chunks, fail the build if one it imports up front does.
 */
export const homeNotReadEarly = (): Plugin => ({
  name: "home-not-read-early",
  generateBundle(_options, bundle) {
    const entry = Object.values(bundle).find((o) => o.type === "chunk" && o.isEntry);
    if (entry?.type !== "chunk") return;
    const seen = new Set<string>();
    const queue = [entry.fileName];
    while (queue.length > 0) {
      const name = queue.pop() as string;
      const chunk = bundle[name];
      if (seen.has(name) || chunk?.type !== "chunk") continue;
      seen.add(name);
      queue.push(...chunk.imports);
      if (Object.keys(chunk.modules).some((id) => id.endsWith("/core/state/vfs-home.ts"))) {
        this.error(`${name} reads $HOME before the entry knows it`);
      }
    }
  },
});

/**
 * An app module's stylesheet holds only the Tailwind classes of the files it
 * imports, not the whole desktop's. Walks the module's imports from `entry`
 * (code under `src/`, `@/` paths) and gives Tailwind those files as sources.
 */
export const moduleCssSources = (entry: string, srcDir: string): Plugin => {
  const files = moduleSourceFiles(entry, srcDir);
  return {
    name: "module-css-sources",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith("/ui/styles/globals.css")) return null;
      const dir = path.dirname(id);
      const sources = files
        .map((file) => `@source "${path.relative(dir, file).split(path.sep).join("/")}";`)
        .join("\n");
      const next = code.replace('@import "tailwindcss";', `@import "tailwindcss" source(none);\n${sources}`);
      if (next === code) this.error('globals.css: no @import "tailwindcss" to narrow');
      return { code: next, map: null };
    },
  };
};

const IMPORT = /(?:^|[^\w.])(?:import|export)\s*(?:[^'"`;]*?\sfrom\s*)?\(?\s*["']([^"']+)["']/g;

function moduleSourceFiles(entry: string, srcDir: string): string[] {
  const resolve = (spec: string, from: string): string | null => {
    const base = spec.startsWith("@/")
      ? path.join(srcDir, spec.slice(2))
      : spec.startsWith(".")
        ? path.resolve(path.dirname(from), spec)
        : null;
    if (!base) return null;
    for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts", ""]) {
      const file = base + ext;
      if (/\.tsx?$/.test(file) && fs.existsSync(file) && fs.statSync(file).isFile()) return file;
    }
    return null;
  };
  const seen = new Set<string>();
  const queue = [path.resolve(entry)];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const code = fs.readFileSync(file, "utf8");
    for (const match of code.matchAll(IMPORT)) {
      // Types bring no classes.
      if (/^\s*import\s+type\b|^\s*export\s+type\b/.test(code.slice(code.lastIndexOf("\n", match.index) + 1, match.index + match[0].length))) continue;
      const next = resolve(match[1]!, file);
      if (next && !seen.has(next)) queue.push(next);
    }
  }
  return [...seen].sort();
}
