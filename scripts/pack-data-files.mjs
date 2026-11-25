// Packs data/files into one JSON file for the browser demo:
// src/lib/engine-web/data-files.json = { dirs: [...], files: { "/path": text } }.
// The vite build runs it, so the pack never lags behind data/files.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
export const DATA_FILES_DIR = path.join(ROOT, "data", "files");
export const DATA_PACK_PATH = path.join(ROOT, "src", "lib", "engine-web", "data-files.json");

export function packDataFiles(root = DATA_FILES_DIR) {
  const dirs = [];
  const files = {};
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const walk = (dir, vfsDir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (entry.name === ".DS_Store") continue;
      const full = path.join(dir, entry.name);
      const vfsPath = `${vfsDir}/${entry.name}`;
      if (entry.isDirectory()) {
        dirs.push(vfsPath);
        walk(full, vfsPath);
        continue;
      }
      try {
        files[vfsPath] = decoder.decode(fs.readFileSync(full));
      } catch {
        throw new Error(`${vfsPath} is not text: the data pack only holds text files`);
      }
    }
  };
  walk(root, "");
  return { dirs, files };
}

/** Writes the pack if data/files changed; returns true when it did. */
export function writeDataPack() {
  const next = `${JSON.stringify(packDataFiles(), null, 1)}\n`;
  const current = fs.existsSync(DATA_PACK_PATH) ? fs.readFileSync(DATA_PACK_PATH, "utf8") : "";
  if (next === current) return false;
  fs.writeFileSync(DATA_PACK_PATH, next, "utf8");
  return true;
}
