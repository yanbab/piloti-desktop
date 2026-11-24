import type { FileStore } from "@/lib/ports/file-store";
import { VFS_HOME } from "@/lib/engine/vfs-home";

/** Where Piloti keeps its own state under `$HOME`. */
const STATE_ROOTS = [
  `${VFS_HOME}/.config/piloti`,
  `${VFS_HOME}/.local/state/piloti`,
  `${VFS_HOME}/.cache/piloti`,
] as const;
const STATE_FILES = [`${VFS_HOME}/.piloti_history`] as const;
const MAX_DEPTH = 3;

export interface StateSink {
  ensureDir(path: string): void;
  writeText(path: string, content: string): void;
}

/**
 * The native VFS is a memory cache of the disk, but the shell reads its state
 * (settings, session, caches) synchronously. Load those few files before the
 * desktop starts so the first read already sees what the last session wrote.
 */
export async function preloadNativeState(store: FileStore, sink: StateSink): Promise<number> {
  let loaded = 0;
  const walk = async (dir: string, depth: number): Promise<void> => {
    const entries = await store.list(dir).catch(() => null);
    if (!entries) return;
    sink.ensureDir(dir);
    await Promise.all(
      entries.map(async (entry) => {
        const path = `${dir}/${entry.name}`;
        if (entry.kind === "directory") {
          if (depth < MAX_DEPTH) await walk(path, depth + 1);
          return;
        }
        const text = await store.readText(path).catch(() => null);
        if (text === null) return;
        sink.writeText(path, text);
        loaded += 1;
      }),
    );
  };
  await Promise.all([
    ...STATE_ROOTS.map((root) => walk(root, 0)),
    ...STATE_FILES.map(async (path) => {
      const text = await store.readText(path).catch(() => null);
      if (text === null) return;
      sink.ensureDir(path.slice(0, path.lastIndexOf("/")));
      sink.writeText(path, text);
      loaded += 1;
    }),
  ]);
  return loaded;
}
