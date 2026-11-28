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
 * The entry learns `$HOME` before anything reads it (`engine/vfs-home.ts`).
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
      if (Object.keys(chunk.modules).some((id) => id.endsWith("/platform/shared/vfs-home.ts"))) {
        this.error(`${name} reads $HOME before the entry knows it`);
      }
    }
  },
});
