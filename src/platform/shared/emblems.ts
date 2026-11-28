/**
 * Emblems (favorite, work…) on files, for both engines. Where they are kept is
 * the engine's choice (`setEmblemStorage`): on Linux each file's GVfs
 * `metadata::emblems` (`engine-native/emblem-storage.ts`), in the demo the
 * browser VFS.
 */
import { VFS_EMBLEM_META, type VfsEmblemId } from "@/core/files/emblems";
import { normalizeVfsPath } from "@/core/files/vfs-paths";

export { VFS_EMBLEM_META as EMBLEM_META, type VfsEmblemId as EmblemId };

export type EmblemMap = Record<string, VfsEmblemId[]>;

export interface EmblemStorage {
  /** Every file's emblems, by path; the caller may change the object. */
  load(): EmblemMap;
  /** Replaces them and tells subscribers; `changed` are the paths that differ. */
  save(map: EmblemMap, changed: readonly string[]): void;
  subscribe(listener: () => void): () => void;
}

/** Keeps them in memory; `onSave` is where they are persisted, if anywhere. */
export function memoryEmblemStorage(
  initial: EmblemMap = {},
  onSave: (map: EmblemMap) => void = () => undefined,
): EmblemStorage {
  let current: EmblemMap = { ...initial };
  const listeners = new Set<() => void>();
  return {
    load: () => ({ ...current }),
    save(map) {
      current = { ...map };
      onSave(current);
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

let storage = memoryEmblemStorage();

export function setEmblemStorage(next: EmblemStorage): void {
  storage = next;
}

const GNOME_EMBLEM_MAP: Record<VfsEmblemId, string> = {
  favorite: "emblem-favorite",
  important: "emblem-important",
  work: "emblem-work",
  personal: "emblem-personal",
};

/** The GVfs names Piloti manages (others on a file are left alone). */
export const MANAGED_GNOME_EMBLEMS: readonly string[] = Object.values(GNOME_EMBLEM_MAP);

export function toGnomeEmblemName(id: VfsEmblemId): string {
  return GNOME_EMBLEM_MAP[id];
}

export function fromGnomeEmblemName(name: string): VfsEmblemId | null {
  const lower = name.trim().toLowerCase();
  const found = (Object.keys(GNOME_EMBLEM_MAP) as VfsEmblemId[]).find(
    (id) => id === lower || GNOME_EMBLEM_MAP[id] === lower,
  );
  return found ?? null;
}

export function normalizeEmblemList(raw: unknown): VfsEmblemId[] {
  if (!Array.isArray(raw)) return [];
  const out: VfsEmblemId[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const mapped = fromGnomeEmblemName(item);
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }
  return out;
}

export function loadEmblemsMap(): EmblemMap {
  return storage.load();
}

export function getEmblems(rawPath: string): VfsEmblemId[] {
  return loadEmblemsMap()[normalizeVfsPath(rawPath)] ?? [];
}

export function hasEmblem(rawPath: string, emblem: VfsEmblemId): boolean {
  return getEmblems(rawPath).includes(emblem);
}

/** The paths of the favorite (starred) files. */
export function listFavoritePaths(): string[] {
  return Object.entries(loadEmblemsMap())
    .filter(([, emblems]) => emblems.includes("favorite"))
    .map(([path]) => path);
}

/** Calls `onChange` with every file's emblems when they may have changed. */
export function subscribeEmblems(onChange: (emblems: EmblemMap) => void): () => void {
  return storage.subscribe(() => onChange(loadEmblemsMap()));
}

type EmblemPersist = (path: string, gnomeNames: string[]) => void | Promise<void>;
let persist: EmblemPersist | null = null;
const localWrites = new Map<string, number>();
const LOCAL_GRACE_MS = 5000;

/** Linux: writes emblem changes into the file's `metadata::emblems` (shared with other file managers). */
export function setEmblemPersist(fn: EmblemPersist | null): void {
  persist = fn;
}

export function setEmblem(rawPath: string, emblem: VfsEmblemId, enabled: boolean): VfsEmblemId[] {
  const path = normalizeVfsPath(rawPath);
  const map = loadEmblemsMap();
  const prev = map[path] ?? [];
  const next = !enabled ? prev.filter((e) => e !== emblem) : prev.includes(emblem) ? prev : [...prev, emblem];
  if (next.length > 0) map[path] = next;
  else delete map[path];
  storage.save(map, [path]);
  if (persist) {
    localWrites.set(path, Date.now());
    void persist(path, next.map(toGnomeEmblemName));
  }
  return next;
}

export function toggleEmblem(rawPath: string, emblem: VfsEmblemId): VfsEmblemId[] {
  return setEmblem(rawPath, emblem, !hasEmblem(rawPath, emblem));
}

/**
 * For a file about to be renamed, moved or deleted on a real disk. GVfs keys
 * emblems by path and a plain move leaves them behind, so they are taken off
 * before and put back by the returned function, at the new path (or the old one
 * if nothing moved; `null` drops them). The browser VFS moves its own.
 */
export async function liftEmblems(rawPath: string): Promise<(to: string | null) => Promise<void>> {
  const write = persist;
  if (!write) return async () => undefined;
  const from = normalizeVfsPath(rawPath);
  const lifted = Object.entries(loadEmblemsMap()).filter(
    ([path]) => path === from || path.startsWith(`${from}/`),
  );
  const put = (path: string, emblems: readonly VfsEmblemId[]) => {
    localWrites.set(path, Date.now());
    return write(path, emblems.map(toGnomeEmblemName));
  };
  for (const [path] of lifted) await put(path, []);
  return async (to) => {
    if (lifted.length === 0) return;
    const target = to === null ? null : normalizeVfsPath(to);
    const map = loadEmblemsMap();
    const changed: string[] = [];
    for (const [path, emblems] of lifted) {
      delete map[path];
      changed.push(path);
      if (target === null) continue;
      const next = `${target}${path.slice(from.length)}`;
      map[next] = emblems;
      changed.push(next);
      await put(next, emblems);
    }
    storage.save(map, changed);
  };
}

/**
 * Adopts the emblems another app set on `path` (read from `metadata::emblems`).
 * Skipped for paths this app changed a moment ago, so a slow read can't undo them.
 */
export function syncEmblemsFromHost(rawPath: string, hostNames: readonly string[]): void {
  const path = normalizeVfsPath(rawPath);
  const wrote = localWrites.get(path);
  if (wrote && Date.now() - wrote < LOCAL_GRACE_MS) return;
  const next = normalizeEmblemList([...hostNames]);
  const map = loadEmblemsMap();
  const prev = map[path] ?? [];
  if (next.length === prev.length && next.every((e) => prev.includes(e))) return;
  if (next.length > 0) map[path] = next;
  else delete map[path];
  storage.save(map, [path]);
}
