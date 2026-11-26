/**
 * Piloti's config and state files on Linux, over `piloti.vfs`. They are loaded
 * before the desktop starts, because the shell reads them synchronously, and
 * kept current from the disk:
 * - config files (`~/.config/piloti`, `mimeapps.list`) are watched for the whole
 *   session, so editing one applies at once;
 * - state and cache files are the shell's own, rewritten often: they are watched
 *   only while something subscribes.
 * Only this store writes these files.
 */
import { parentPath, type Vfs } from "@/lib/ports/vfs";
import type { StateSource } from "@/lib/ports/state-source";

const MAX_DEPTH = 3;

/** Text the shell reads back: not logs (only written), images or plugin code. */
const isStateFile = (name: string) => /\.(ini|json|list)$/.test(name) || !/.\.[^.]+$/.test(name);

export interface NativeStateStore extends StateSource {
  /** Resolves once the writes asked so far are on disk. */
  settled(): Promise<void>;
  dispose(): void;
}

export async function createNativeStateStore(vfs: Vfs, home: string): Promise<NativeStateStore> {
  const configRoot = `${home}/.config/piloti`;
  const values = new Map<string, string>();
  const listeners = new Map<string, Set<() => void>>();
  const dirListeners = new Map<string, Set<() => void>>();
  /** Writes asked and not yet on disk, per path: until then the disk is older. */
  const pending = new Map<string, number>();
  let tail: Promise<void> = Promise.resolve();
  const sessionWatches = new Map<string, () => void>();
  const subscriberWatches = new Map<string, { count: number; stop: () => void }>();

  const notify = (path: string) => {
    for (const listener of [...(listeners.get(path) ?? [])]) listener();
    for (const listener of [...(dirListeners.get(parentPath(path)) ?? [])]) listener();
  };

  const refresh = async (path: string) => {
    if (pending.get(path)) return;
    const before = values.get(path);
    const text = await vfs.readText(path);
    // The shell wrote while we were reading: that is newer.
    if (pending.get(path) || values.get(path) !== before) return;
    if (text === null) {
      if (!values.delete(path)) return;
    } else {
      // Empty: an editor truncated it and has not written yet.
      if (text === before || !text.trim()) return;
      values.set(path, text);
    }
    notify(path);
  };
  const watchFile = (path: string) =>
    vfs.watch(path, () => {
      void refresh(path).catch((error) => console.warn("[piloti] cannot read", path, error));
    });

  const persist = (path: string, op: () => Promise<void>) => {
    pending.set(path, (pending.get(path) ?? 0) + 1);
    // One after the other, so a removal never overtakes an earlier write.
    tail = tail
      .then(op)
      .catch((error) => console.warn("[piloti] cannot save", path, error))
      .finally(() => pending.set(path, (pending.get(path) ?? 1) - 1));
  };

  const load = async (path: string) => {
    const text = await vfs.readText(path).catch(() => null);
    if (text !== null) values.set(path, text);
  };
  const loadTree = async (dir: string, depth: number): Promise<void> => {
    const entries = await vfs.list(dir).catch(() => null);
    await Promise.all(
      (entries ?? []).map(async (entry) => {
        if (entry.kind === "directory") {
          // `kv` belongs to the key/value storage (`state-preload.ts`).
          if (depth < MAX_DEPTH && entry.name !== "kv") await loadTree(entry.path, depth + 1);
        } else if (isStateFile(entry.name)) await load(entry.path);
      }),
    );
  };

  const keepWatched = (path: string) => {
    if (!sessionWatches.has(path)) sessionWatches.set(path, watchFile(path));
  };
  /** Watches the files of a config folder, those made later included. */
  const watchConfigDir = (dir: string, depth: number) => {
    const key = `${dir}/`;
    if (sessionWatches.has(key)) return;
    sessionWatches.set(
      key,
      vfs.watch(dir, () => {
        void vfs
          .list(dir)
          .then((entries) => {
            for (const entry of entries ?? []) {
              if (entry.kind === "directory") {
                if (depth < MAX_DEPTH) watchConfigDir(entry.path, depth + 1);
              } else if (isStateFile(entry.name)) keepWatched(entry.path);
            }
          })
          .catch((error) => console.warn("[piloti] cannot list", dir, error));
      }),
    );
  };

  const mimeapps = `${home}/.config/mimeapps.list`;
  await Promise.all([
    loadTree(configRoot, 0),
    loadTree(`${home}/.local/state/piloti`, 0),
    loadTree(`${home}/.cache/piloti`, 0),
    load(`${home}/.piloti_history`),
    load(mimeapps),
  ]);
  watchConfigDir(configRoot, 0);
  keepWatched(mimeapps);

  const add = (map: Map<string, Set<() => void>>, key: string, listener: () => void) => {
    const set = map.get(key) ?? new Set();
    map.set(key, set.add(listener));
    return () => {
      set.delete(listener);
      if (set.size === 0 && map.get(key) === set) map.delete(key);
    };
  };

  return {
    files: () =>
      [...values].map(([path, content]) => ({ path, name: path.slice(path.lastIndexOf("/") + 1), content })),
    read: (path) => values.get(path) ?? null,
    write(path, content) {
      values.set(path, content);
      persist(path, async () => {
        await vfs.createDir(parentPath(path));
        await vfs.write(path, content);
      });
      notify(path);
    },
    remove(path) {
      values.delete(path);
      persist(path, () => vfs.remove(path));
      notify(path);
    },
    subscribe(path, listener) {
      const remove = add(listeners, path, listener);
      const watched = subscriberWatches.get(path) ?? { count: 0, stop: () => {} };
      if (watched.count === 0 && !sessionWatches.has(path)) watched.stop = watchFile(path);
      watched.count += 1;
      subscriberWatches.set(path, watched);
      return () => {
        remove();
        watched.count -= 1;
        if (watched.count === 0) {
          watched.stop();
          subscriberWatches.delete(path);
        }
      };
    },
    // Config folders are watched already (`watchConfigDir`).
    subscribeDir: (dir, listener) => add(dirListeners, dir, listener),
    settled: () => tail,
    dispose() {
      for (const stop of sessionWatches.values()) stop();
      for (const { stop } of subscriberWatches.values()) stop();
      sessionWatches.clear();
      subscriberWatches.clear();
    },
  };
}
