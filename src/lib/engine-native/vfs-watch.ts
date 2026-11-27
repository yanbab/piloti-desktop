/**
 * `Vfs.watch` over Domicile's `files.watch`. What that does on Linux (see
 * `_docs/NOTES.md`) shapes this:
 * - only folders are watched: a file's watch goes silent once the file is
 *   replaced, as every atomic save does;
 * - a removed folder's watch says so once, then nothing, so it is watched anew;
 * - each watch is an inotify instance (128 per user, for every program), so one
 *   is shared per folder and past `maxWatches` folders are polled instead.
 */
import { baseName, joinPath, parentPath, type VfsStat } from "@/lib/ports/vfs";

/** `changed` is the absolute path, or `null` when anything may have changed. */
export type DirListener = (changed: string | null) => void;

export interface WatchHost {
  stat(path: string): Promise<VfsStat | null>;
  /** Watches one folder; `null` if it cannot. */
  watchDir(dir: string, listener: DirListener): Promise<{ stop: () => void } | null>;
}

export interface WatchHubOptions {
  maxWatches?: number;
  pollMs?: number;
  debounceMs?: number;
}

interface DirRecord {
  listeners: Set<DirListener>;
  ready: Promise<void>;
  close: () => void;
}

/** A folder to hear, and the one entry of it that matters (all of them if unset). */
interface Target {
  dir: string;
  name?: string;
}

/** Domicile writes atomically through `<name>.domicile-<pid>-<n>`. */
const TEMPORARY = /\.domicile-\d+-\d+$/;

export function createWatchHub(host: WatchHost, options: WatchHubOptions = {}) {
  const { maxWatches = 30, pollMs = 6000, debounceMs = 100 } = options;
  const records = new Map<string, DirRecord>();
  let watching = 0;

  const open = (dir: string): DirRecord => {
    const listeners = new Set<DirListener>();
    let stop: (() => void) | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let closed = false;
    let counted = false;

    const emit: DirListener = (changed) => {
      if (closed || (changed !== null && TEMPORARY.test(changed))) return;
      const heard = [...listeners];
      // The folder itself changed: this watch may be dead now.
      if (changed === dir) record.close();
      for (const listener of heard) listener(changed);
    };
    const startPolling = () => {
      poll = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
        for (const listener of [...listeners]) listener(null);
      }, pollMs);
    };
    const record: DirRecord = {
      listeners,
      ready: Promise.resolve(),
      close() {
        if (closed) return;
        closed = true;
        if (records.get(dir) === record) records.delete(dir);
        if (counted) watching -= 1;
        if (poll) clearInterval(poll);
        stop?.();
      },
    };

    if (watching >= maxWatches) startPolling();
    else {
      counted = true;
      watching += 1;
      record.ready = host
        .watchDir(dir, emit)
        .catch(() => null)
        .then((handle) => {
          if (closed) handle?.stop();
          else if (handle) stop = handle.stop;
          else {
            counted = false;
            watching -= 1;
            startPolling();
          }
        });
    }
    records.set(dir, record);
    return record;
  };

  const join = (dir: string, listener: DirListener) => {
    const record = records.get(dir) ?? open(dir);
    record.listeners.add(listener);
    return {
      ready: record.ready,
      leave: () => {
        record.listeners.delete(listener);
        if (record.listeners.size === 0) record.close();
      },
    };
  };

  /** The folders to hear for `path` as it is now. */
  const targetsFor = async (path: string): Promise<Target[]> => {
    const own = await host.stat(path);
    if (own?.kind === "directory") return [{ dir: own.realPath }];
    if (own) {
      const dir = (await host.stat(parentPath(path)))?.realPath ?? parentPath(path);
      const targets: Target[] = [{ dir, name: baseName(path) }];
      // A symlink: also hear the file it points to.
      if (own.realPath !== joinPath(dir, baseName(path))) {
        targets.push({ dir: parentPath(own.realPath), name: baseName(own.realPath) });
      }
      return targets;
    }
    // Missing: hear the nearest existing folder for the next step towards it.
    let child = path;
    while (parentPath(child) !== child) {
      const parent = await host.stat(parentPath(child));
      if (parent) return [{ dir: parent.realPath, name: baseName(child) }];
      child = parentPath(child);
    }
    return [];
  };

  return {
    /** Folders watched (not polled) right now. */
    get size() {
      return watching;
    },
    watch(path: string, onChange: () => void): () => void {
      let leaves: (() => void)[] = [];
      let timer: ReturnType<typeof setTimeout> | null = null;
      let stopped = false;
      let arming: Promise<void> = Promise.resolve();

      const schedule = () => {
        // Not restarted by later events: a file written non-stop still reports.
        if (stopped || timer) return;
        timer = setTimeout(() => {
          timer = null;
          arm();
        }, debounceMs);
      };

      const listen = async (targets: Target[]) => {
        const joined = targets.map(({ dir, name }) =>
          join(dir, (changed) => {
            if (name === undefined || changed === null || changed === dir || baseName(changed) === name) {
              schedule();
            }
          }),
        );
        // Join before leaving, so a folder kept is not closed and opened again.
        for (const leave of leaves) leave();
        leaves = joined.map((j) => j.leave);
        await Promise.all(joined.map((j) => j.ready));
      };

      // Points the watch at what `path` is now, then tells the caller to read.
      const arm = () => {
        arming = arming
          .then(async () => {
            let targets = await targetsFor(path);
            // Again if it changed while the watch was being set up.
            for (let attempt = 0; attempt < 5 && !stopped; attempt += 1) {
              await listen(targets);
              const next = await targetsFor(path);
              if (JSON.stringify(next) === JSON.stringify(targets)) break;
              targets = next;
            }
            if (!stopped) onChange();
          })
          .catch((error) => console.warn("[piloti] watch failed", path, error));
      };

      arm();
      return () => {
        stopped = true;
        if (timer) clearTimeout(timer);
        for (const leave of leaves) leave();
        leaves = [];
      };
    },
  };
}
