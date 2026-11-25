// What ships in data/files, for the browser demo: it is served as `__fs/`
// (by the dev server, and copied into the web build), with an index because
// HTTP has no folder listing.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
export const DATA_FILES_DIR = path.join(ROOT, "data", "files");

/** `{ dirs, files }`: every folder and file, as absolute paths (`/usr/bin/piloti`). */
export function indexDataFiles(root = DATA_FILES_DIR) {
  const dirs = [];
  const files = [];
  const walk = (dir, vfsDir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      // .gitkeep only makes git keep a folder that ships empty.
      if (entry.name === ".DS_Store" || entry.name === ".gitkeep") continue;
      const vfsPath = `${vfsDir}/${entry.name}`;
      if (entry.isDirectory()) {
        dirs.push(vfsPath);
        walk(path.join(dir, entry.name), vfsPath);
      } else {
        files.push(vfsPath);
      }
    }
  };
  walk(root, "");
  return { dirs, files };
}
