import fs from "node:fs";
import path from "node:path";

/** The icon themes shipped with the web demo, read straight from data/files. */
export const DATA_FILES_ROOT = path.resolve(import.meta.dir, "../../data/files");

const ok = <T>(v: T) => ({ match: ({ Ok }: { Ok: (x: T) => unknown }) => Ok(v) });
const err = () => ({ match: ({ Err }: { Err: (e: string) => unknown }) => Err("ENOENT") });

function diskPath(vfsPath: string): string | null {
  if (!vfsPath.startsWith("/")) return null;
  return path.join(DATA_FILES_ROOT, vfsPath);
}

export function readDataFile(vfsPath: string): string | undefined {
  const p = diskPath(vfsPath);
  return p && fs.existsSync(p) && fs.statSync(p).isFile() ? fs.readFileSync(p, "utf8") : undefined;
}

/** An `XdgFileReader` over data/files (cast with `as never` at call sites). */
export const diskIconReader = {
  readDir: async (dir: string) => {
    const p = diskPath(dir);
    if (!p || !fs.existsSync(p) || !fs.statSync(p).isDirectory()) return err();
    return ok(
      fs
        .readdirSync(p, { withFileTypes: true })
        .filter((e) => e.name !== ".DS_Store")
        .map((e) => ({ name: e.name, fileType: e.isDirectory() ? 1 : 0 }))
    );
  },
  readText: async (filePath: string) => {
    const text = readDataFile(filePath);
    return text !== undefined ? ok(text) : err();
  },
};

/** Every file under a data/files directory, as VFS paths. */
export function listDataFiles(vfsDir: string): string[] {
  const root = diskPath(vfsDir);
  if (!root || !fs.existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name !== ".DS_Store") out.push(`/${path.relative(DATA_FILES_ROOT, full).split(path.sep).join("/")}`);
    }
  };
  walk(root);
  return out.sort();
}
