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

