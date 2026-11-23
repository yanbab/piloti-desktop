import { VFS_HOME } from "../engine/vfs-home";
import type { VfsPersistence } from "@/lib/ports/vfs-persistence";
import { browserPersistence } from "./vfs-persistence-browser";
import type { VfsSync } from "@/lib/ports/vfs-sync";
import { browserVfsSync, WEB_VFS_CHANGED_DOM_EVENT } from "./vfs-sync-browser";
import {
  WEB_VFS_HOME,
  WEB_VFS_TEMPLATES,
  WEB_VFS_TRASH,
  basename,
  dirname,
  normalizeVfsPath,
  resolveVfsPath,
  type WebVfsEntry,
} from "@/lib/core/vfs-paths";
import {
  DEFAULT_ETC_ISSUE,
  DEFAULT_HOME_FILES,
  DEFAULT_MIMEAPPS_INI,
  WELCOME_HTML,
  createInitialVfs,
  topUpDefaults,
} from "./vfs-seed";

export {
  WEB_VFS_HOME,
  WEB_VFS_TEMPLATES,
  WEB_VFS_TRASH,
  normalizeVfsPath,
  resolveVfsPath,
  type WebVfsEntry,
};
export { DEFAULT_ETC_ISSUE, DEFAULT_MIMEAPPS_INI };

export const WEB_VFS_STORAGE_KEY = "piloti.web.vfs.v1";
export const WEB_VFS_CHANGED_EVENT = WEB_VFS_CHANGED_DOM_EVENT;


let vfsCacheRaw: string | null = null;
let vfsCacheEntries: WebVfsEntry[] | null = null;
let vfsCacheByPath: Map<string, WebVfsEntry> | null = null;
let vfsCacheInMemoryOnly = false;
/** Cache freshness: false once another window/iframe wrote the VFS key. */
let vfsCacheFresh = false;
let vfsFlushTimer: ReturnType<typeof setTimeout> | null = null;
let vfsFlushFirstPendingAt = 0;
/** Paths changed since the last flush (null = unknown / everything). */
let vfsPendingPaths: Set<string> | null = new Set();
let vfsFlushPending = false;

// --- Large content (media) is stored in IndexedDB so it never hits the localStorage quota ---
const VFS_BLOB_THRESHOLD = 256 * 1024;
const persistedBlobs = new Map<string, string>();
const hydratingBlobs = new Set<string>();

let persistence: VfsPersistence = browserPersistence();
/** Swaps where the VFS persists (tests, other engines). Drops the in-memory cache. */
export function setVfsPersistence(next: VfsPersistence): void {
  persistence = next;
  persistedBlobs.clear();
  hydratingBlobs.clear();
  clearVfsMemoryCache();
}
const hasKv = () => persistence.kv !== null;
const kv = () => persistence.kv as NonNullable<VfsPersistence["kv"]>;

function isExternalizable(entry: WebVfsEntry): boolean {
  return (
    entry.kind === "file" &&
    typeof entry.content === "string" &&
    entry.content.length > VFS_BLOB_THRESHOLD
  );
}

function syncBlobStore(entries: readonly WebVfsEntry[]): void {
  const live = new Set<string>();
  for (const entry of entries) {
    if (!isExternalizable(entry)) continue;
    live.add(entry.path);
    if (persistedBlobs.get(entry.path) !== entry.content) {
      persistedBlobs.set(entry.path, entry.content as string);
      void persistence.blobs?.put(entry.path, entry.content as string);
    }
  }
  for (const path of [...persistedBlobs.keys()]) {
    if (!live.has(path)) {
      persistedBlobs.delete(path);
      void persistence.blobs?.delete(path);
    }
  }
}

function hydrateExternalContent(entries: readonly WebVfsEntry[]): void {
  for (const entry of entries) {
    if (!entry.externalContent || entry.content !== undefined) continue;
    const path = entry.path;
    if (hydratingBlobs.has(path)) continue;
    hydratingBlobs.add(path);
    void (persistence.blobs?.get(path) ?? Promise.resolve(undefined)).then((value) => {
      hydratingBlobs.delete(path);
      const target = vfsCacheByPath?.get(path);
      if (typeof value === "string" && target && target.content === undefined) {
        target.content = value;
        persistedBlobs.set(path, value);
        emitVfsChanged([path]);
      }
    });
  }
}

/** Serializes entries for localStorage, omitting large contents stored in IndexedDB. */
function serializeVfsEntries(entries: readonly WebVfsEntry[]): string {
  return JSON.stringify(
    entries.map((entry) => {
      if (!isExternalizable(entry)) return entry;
      const { content: _content, ...rest } = entry;
      return { ...rest, externalContent: true };
    }),
  );
}

function setVfsCache(entries: WebVfsEntry[], raw: string | null): WebVfsEntry[] {
  vfsCacheRaw = raw;
  vfsCacheEntries = entries;
  vfsCacheByPath = new Map(entries.map((entry) => [entry.path, entry]));
  return entries;
}

function loadVfs(): WebVfsEntry[] {
  if (!hasKv()) {
    return vfsCacheEntries ?? setVfsCache(createInitialVfs(), null);
  }
  if (vfsCacheInMemoryOnly && vfsCacheEntries) {
    return vfsCacheEntries;
  }
  // Hot path: no other window has written since our last read/write, and our own
  // pending changes live only in memory until the next flush.
  if (vfsCacheEntries && (vfsCacheFresh || vfsFlushPending)) {
    return vfsCacheEntries;
  }
  try {
    const raw = kv().getItem(WEB_VFS_STORAGE_KEY);
    vfsCacheFresh = true;
    if (raw !== null && raw === vfsCacheRaw && vfsCacheEntries) {
      return vfsCacheEntries;
    }
    if (vfsCacheEntries) vfsPerf.reloads += 1;
    if (!raw) {
      const seeded = createInitialVfs();
      const json = JSON.stringify(seeded);
      kv().setItem(WEB_VFS_STORAGE_KEY, json);
      return setVfsCache(seeded, json);
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const entries = parsed as WebVfsEntry[];
      for (const entry of entries) {
        if (entry.externalContent && entry.content === undefined) {
          const previous = vfsCacheByPath?.get(entry.path)?.content;
          if (previous !== undefined) entry.content = previous;
        }
      }
      if (topUpDefaults(entries, persistence.kv)) {
        const json = JSON.stringify(entries);
        kv().setItem(WEB_VFS_STORAGE_KEY, json);
        return setVfsCache(entries, json);
      }
      setVfsCache(entries, raw);
      hydrateExternalContent(entries);
      return entries;
    }
  } catch {
    // ignore corrupted storage and re-seed
  }
  const seeded = createInitialVfs();
  let json: string | null = null;
  try {
    json = JSON.stringify(seeded);
    kv().setItem(WEB_VFS_STORAGE_KEY, json);
  } catch {
    // ignore quota errors
  }
  return setVfsCache(seeded, json);
}

type VfsBroadcastMessage =
  | { type: "vfs-changed"; paths?: readonly string[] }
  | { type: "vfs-renamed"; oldPath: string; newPath: string };

/** Detail of `WEB_VFS_CHANGED_EVENT`; `paths` is absent when the change is unknown/global. */
export interface WebVfsChangeDetail {
  paths?: readonly string[];
}

/**
 * How a subscriber watches the VFS:
 * - `exact`: the path itself (or an ancestor being moved/removed).
 * - `children`: the directory, its direct children, or an ancestor.
 * - `subtree`: anything at or below the path, or an ancestor.
 */
export type VfsWatchMode = "exact" | "children" | "subtree";

export interface VfsWatch {
  path: string;
  mode?: VfsWatchMode;
}

/**
 * True when a change to `changedPaths` can affect `watch`. Unknown changes
 * (`changedPaths` undefined) always match.
 */
export function vfsChangeAffects(
  changedPaths: readonly string[] | undefined,
  watches: VfsWatch | readonly VfsWatch[],
): boolean {
  if (!changedPaths) return true;
  const list = Array.isArray(watches) ? watches : [watches as VfsWatch];
  for (const watch of list) {
    const target = normalizeVfsPath(watch.path);
    const mode = watch.mode ?? "exact";
    for (const raw of changedPaths) {
      const changed = normalizeVfsPath(raw);
      if (changed === target) return true;
      // An ancestor of the watched path changed (moved, removed, renamed).
      if (changed === "/" || target.startsWith(`${changed}/`)) return true;
      if (mode === "children" && dirname(changed) === target) return true;
      if (mode === "subtree" && (target === "/" || changed.startsWith(`${target}/`))) {
        return true;
      }
    }
  }
  return false;
}

// --- Perf counters (shown in Console ▸ Infos) ---
export interface WebVfsPerfStats {
  /** In-memory VFS mutations (each `saveVfs`). */
  writes: number;
  /** Coalesced localStorage serializations. */
  flushes: number;
  lastFlushMs: number;
  totalFlushMs: number;
  /** Size of the last serialized VFS JSON (characters). */
  lastJsonChars: number;
  /** Listener invocations (delivered) vs. skipped by path filters. */
  listenerCalls: number;
  listenerSkips: number;
  /** Full re-parses of localStorage after another window changed it. */
  reloads: number;
  startedAt: number;
}

const vfsPerf: WebVfsPerfStats = {
  writes: 0,
  flushes: 0,
  lastFlushMs: 0,
  totalFlushMs: 0,
  lastJsonChars: 0,
  listenerCalls: 0,
  listenerSkips: 0,
  reloads: 0,
  startedAt: Date.now(),
};

export function getWebVfsPerfStats(): Readonly<WebVfsPerfStats> {
  return { ...vfsPerf };
}

export function resetWebVfsPerfStats(): void {
  Object.assign(vfsPerf, {
    writes: 0,
    flushes: 0,
    lastFlushMs: 0,
    totalFlushMs: 0,
    lastJsonChars: 0,
    listenerCalls: 0,
    listenerSkips: 0,
    reloads: 0,
    startedAt: Date.now(),
  });
}

let sync: VfsSync = browserVfsSync();
let syncTeardown: Array<() => void> = [];

/** Swaps how changes propagate (tests, other engines). */
export function setVfsSync(next: VfsSync): void {
  for (const off of syncTeardown) off();
  syncTeardown = [];
  sync = next;
  installSyncHooks();
}

/** Notifies in-document subscribers immediately (reads already see the new cache). */
function emitVfsChanged(paths: readonly string[] | undefined): void {
  sync.emit({ type: "changed", paths: paths ? [...paths] : undefined });
}

// --- Coalesced persistence: memory first, localStorage on a trailing debounce ---
const VFS_FLUSH_DELAY_MS = 250;
const VFS_FLUSH_MAX_WAIT_MS = 1000;

/** Writes pending in-memory VFS changes to localStorage now and tells other windows. */
export function flushWebVfs(): void {
  if (vfsFlushTimer !== null) {
    clearTimeout(vfsFlushTimer);
    vfsFlushTimer = null;
  }
  if (!vfsFlushPending) return;
  vfsFlushPending = false;
  const entries = vfsCacheEntries;
  const paths = vfsPendingPaths ? [...vfsPendingPaths] : undefined;
  vfsPendingPaths = new Set();
  if (!entries || !hasKv()) return;
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  try {
    syncBlobStore(entries);
    const json = serializeVfsEntries(entries);
    kv().setItem(WEB_VFS_STORAGE_KEY, json);
    vfsCacheRaw = json;
    vfsCacheInMemoryOnly = false;
    vfsPerf.lastJsonChars = json.length;
  } catch {
    // Quota exceeded: keep the updated VFS in memory for this session
    vfsCacheRaw = null;
    vfsCacheInMemoryOnly = true;
  }
  const elapsed = (typeof performance !== "undefined" ? performance.now() : Date.now()) - started;
  vfsPerf.flushes += 1;
  vfsPerf.lastFlushMs = elapsed;
  vfsPerf.totalFlushMs += elapsed;
  // Other windows/iframes re-read localStorage, so only announce once it is written.
  sync.broadcast(paths ? { type: "changed", paths } : { type: "changed" });
}

function scheduleVfsFlush(): void {
  const now = Date.now();
  if (!vfsFlushPending) vfsFlushFirstPendingAt = now;
  vfsFlushPending = true;
  if (typeof setTimeout === "undefined" || typeof window === "undefined") {
    flushWebVfs();
    return;
  }
  if (vfsFlushTimer !== null) clearTimeout(vfsFlushTimer);
  const waited = now - vfsFlushFirstPendingAt;
  const delay = Math.max(0, Math.min(VFS_FLUSH_DELAY_MS, VFS_FLUSH_MAX_WAIT_MS - waited));
  vfsFlushTimer = setTimeout(flushWebVfs, delay);
}

function installSyncHooks(): void {
  syncTeardown.push(sync.onFlushRequested(flushWebVfs));
  syncTeardown.push(
    sync.onExternalWrite((key) => {
      if (key === null || key === WEB_VFS_STORAGE_KEY) vfsCacheFresh = false;
    }),
  );
  syncTeardown.push(
    sync.subscribe((_msg, remote) => {
      if (remote) vfsCacheFresh = false;
    }),
  );
}
installSyncHooks();

/**
 * Commits a new VFS snapshot: memory cache now, subscribers now, localStorage
 * shortly after (coalesced). `changedPaths` lets subscribers skip unrelated
 * changes; omit it only for bulk/unknown changes.
 */
function saveVfs(entries: WebVfsEntry[], changedPaths?: readonly string[]): void {
  vfsPerf.writes += 1;
  setVfsCache(entries, vfsCacheRaw);
  vfsCacheFresh = true;
  if (changedPaths && vfsPendingPaths) {
    for (const p of changedPaths) vfsPendingPaths.add(normalizeVfsPath(p));
  } else {
    vfsPendingPaths = null;
  }
  scheduleVfsFlush();
  emitVfsChanged(changedPaths);
}

function uniqueChildName(
  entries: readonly WebVfsEntry[],
  parentPath: string,
  baseName: string,
  extension = ""
): string {
  const existing = new Set(
    entries
      .filter((e) => e.parentPath === parentPath)
      .map((e) => e.name.toLowerCase())
  );
  const first = `${baseName}${extension}`;
  if (!existing.has(first.toLowerCase())) return first;

  let index = 2;
  while (existing.has(`${baseName} ${index}${extension}`.toLowerCase())) {
    index += 1;
  }
  return `${baseName} ${index}${extension}`;
}

/**
 * Parses a FreeDesktop / GNOME Nautilus `.hidden` file (newline-separated
 * basenames in the same directory that should be treated as hidden).
 */
export function parseDotHiddenFile(content: string | undefined): Set<string> {
  const out = new Set<string>();
  if (!content) return out;
  for (const rawLine of content.split(/\r?\n/)) {
    const name = rawLine.trim();
    if (name && !name.includes("/")) {
      out.add(name);
    }
  }
  return out;
}

export function getVfsDirHiddenNames(dirPath: string): Set<string> {
  const normalized = normalizeVfsPath(dirPath);
  loadVfs();
  const dotHiddenPath = `${normalized === "/" ? "" : normalized}/.hidden`;
  const entry = vfsCacheByPath?.get(dotHiddenPath);
  return entry?.kind === "file" ? parseDotHiddenFile(entry.content) : new Set();
}

export function listVfsDir(
  dirPath: string,
  options?: { includeHidden?: boolean }
): WebVfsEntry[] {
  const normalized = normalizeVfsPath(dirPath);
  const entries = loadVfs();
  const includeHidden = Boolean(options?.includeHidden);
  const hiddenNames = includeHidden ? undefined : getVfsDirHiddenNames(normalized);
  const direct = entries.filter(
    (entry) =>
      entry.parentPath === normalized &&
      (includeHidden ||
        (!entry.name.startsWith(".") && !hiddenNames?.has(entry.name)))
  );
  if (normalized === "/" && !direct.some((e) => e.path === "/home")) {
    direct.unshift({
      id: "/home",
      name: "home",
      kind: "directory",
      path: "/home",
      parentPath: "/",
      updatedAt: 0,
    });
  }
  return direct;
}

export function getVfsEntry(path: string): WebVfsEntry | undefined {
  const normalized = normalizeVfsPath(path);
  loadVfs();
  const found = vfsCacheByPath?.get(normalized);
  if (found) return found;
  if (normalized === "/" || normalized === "/home") {
    return {
      id: normalized,
      name: basename(normalized),
      kind: "directory",
      path: normalized,
      parentPath: "/",
      updatedAt: 0,
    };
  }
  return undefined;
}

export function createVfsFolder(
  parentPath: string,
  baseName = "New Folder"
): WebVfsEntry {
  const parent = normalizeVfsPath(parentPath);
  const entries = loadVfs();
  const name = uniqueChildName(entries, parent, baseName);
  const fullPath = `${parent === "/" ? "" : parent}/${name}`;
  const created: WebVfsEntry = {
    id: fullPath,
    name,
    kind: "directory",
    path: fullPath,
    parentPath: parent,
    updatedAt: Date.now(),
  };
  saveVfs([...entries, created], [fullPath]);
  return created;
}

export function createVfsTextFile(
  parentPath: string,
  baseName = "Untitled",
  content = ""
): WebVfsEntry {
  const parent = normalizeVfsPath(parentPath);
  const entries = loadVfs();
  const hasExt = /\.[a-z0-9]+$/i.test(baseName);
  const stem = hasExt ? baseName.replace(/\.[a-z0-9]+$/i, "") : baseName;
  const ext = hasExt ? baseName.slice(stem.length) : ".txt";
  const name = uniqueChildName(entries, parent, stem, ext);
  const fullPath = `${parent === "/" ? "" : parent}/${name}`;
  const created: WebVfsEntry = {
    id: fullPath,
    name,
    kind: "file",
    path: fullPath,
    parentPath: parent,
    content,
    updatedAt: Date.now(),
  };
  saveVfs([...entries, created], [fullPath]);
  return created;
}

export function resolveVfsTemplatesDir(): string {
  const userDirsEntry = getVfsEntry(`${WEB_VFS_HOME}/.config/user-dirs.dirs`);
  if (userDirsEntry?.kind === "file" && userDirsEntry.content) {
    for (const rawLine of userDirsEntry.content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line.startsWith("XDG_TEMPLATES_DIR=")) continue;
      const val = line
        .slice("XDG_TEMPLATES_DIR=".length)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (!val) break;
      const expanded = val
        .replace(/^\$HOME(?=\/|$)/, WEB_VFS_HOME)
        .replace(/^\$\{HOME\}(?=\/|$)/, WEB_VFS_HOME);
      return normalizeVfsPath(expanded);
    }
  }
  return WEB_VFS_TEMPLATES;
}

export function listVfsTemplates(): WebVfsEntry[] {
  const dir = resolveVfsTemplatesDir();
  return listVfsDir(dir, { includeHidden: false })
    .filter((e) => e.kind === "file")
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function createVfsFileFromTemplate(
  parentPath: string,
  templatePathOrName: string
): WebVfsEntry | null {
  const tmplDir = resolveVfsTemplatesDir();
  const resolvedPath = templatePathOrName.startsWith("/")
    ? normalizeVfsPath(templatePathOrName)
    : `${tmplDir}/${templatePathOrName}`;
  const tmpl = getVfsEntry(resolvedPath);
  if (!tmpl || tmpl.kind !== "file") return null;
  return createVfsTextFile(parentPath, tmpl.name, tmpl.content ?? "");
}

export function ensureVfsDir(rawPath: string): WebVfsEntry {
  const normalized = normalizeVfsPath(rawPath);
  let entries = loadVfs();
  const existing = entries.find((e) => e.path === normalized);
  if (existing) return existing;

  const segments = normalized.split("/").filter(Boolean);
  let curr = "";
  const now = Date.now();
  let last: WebVfsEntry | undefined;
  let changed = false;
  const createdPaths: string[] = [];
  for (const seg of segments) {
    const parent = curr || "/";
    curr = `${curr}/${seg}`;
    const found = entries.find((e) => e.path === curr);
    if (found) {
      last = found;
    } else {
      const created: WebVfsEntry = {
        id: curr,
        name: seg,
        kind: "directory",
        path: curr,
        parentPath: parent,
        updatedAt: now,
      };
      entries = [...entries, created];
      last = created;
      changed = true;
      createdPaths.push(curr);
    }
  }
  if (changed) saveVfs(entries, createdPaths);
  return (
    last ?? {
      id: normalized,
      name: basename(normalized),
      kind: "directory",
      path: normalized,
      parentPath: dirname(normalized),
      updatedAt: now,
    }
  );
}

export function writeVfsTextFile(
  path: string,
  content: string,
  options?: { metadata?: Record<string, unknown> }
): WebVfsEntry {
  const normalized = normalizeVfsPath(path);
  ensureVfsDir(dirname(normalized));
  const entries = loadVfs();
  const existing = entries.find((e) => e.path === normalized);
  const nextMeta =
    options?.metadata || existing?.metadata
      ? { ...(existing?.metadata ?? {}), ...(options?.metadata ?? {}) }
      : undefined;
  if (existing) {
    const now = Date.now();
    const updated = entries.map((e) =>
      e.path === normalized
        ? {
            ...e,
            content,
            ...(nextMeta ? { metadata: nextMeta } : {}),
            updatedAt: now,
          }
        : e
    );
    saveVfs(updated, [normalized]);
    return {
      ...existing,
      content,
      ...(nextMeta ? { metadata: nextMeta } : {}),
      updatedAt: now,
    };
  }
  const created: WebVfsEntry = {
    id: normalized,
    name: basename(normalized),
    kind: "file",
    path: normalized,
    parentPath: dirname(normalized),
    content,
    ...(nextMeta ? { metadata: nextMeta } : {}),
    updatedAt: Date.now(),
  };
  saveVfs([...entries, created], [normalized]);
  return created;
}

export function getVfsAccessCount(rawPath: string): number {
  const entry = getVfsEntry(rawPath);
  return entry?.accessCount ?? 0;
}

export function incrementVfsAccessCount(rawPath: string): number {
  const normalized = normalizeVfsPath(rawPath);
  const entries = loadVfs();
  const existing = entries.find((e) => e.path === normalized);
  if (!existing) return 0;
  const nextCount = (existing.accessCount ?? 0) + 1;
  saveVfs(
    entries.map((e) =>
      e.path === normalized ? { ...e, accessCount: nextCount } : e
    ),
    [normalized],
  );
  return nextCount;
}

export type VfsEmblemId = "favorite" | "important" | "work" | "personal";

export const VFS_EMBLEMS_STORAGE_KEY = "piloti.web.vfs.emblems.v1";
export const WEB_VFS_FAVORITES_STORAGE_KEY = "piloti.web.vfs.favorites.v1";
export const WEB_VFS_FAVORITES_URI = "piloti://favorites";
export const WEB_VFS_RECENTS_URI = "piloti://recents";

export const VFS_EMBLEM_META: Record<
  VfsEmblemId,
  { label: string; colorClass: string; badgeBgClass: string }
> = {
  favorite: {
    label: "Favorite",
    colorClass: "text-rose-500",
    badgeBgClass: "bg-rose-500/90 text-white",
  },
  important: {
    label: "Important",
    colorClass: "text-amber-500",
    badgeBgClass: "bg-amber-500/90 text-white",
  },
  work: {
    label: "Work",
    colorClass: "text-sky-500",
    badgeBgClass: "bg-sky-500/90 text-white",
  },
  personal: {
    label: "Personal",
    colorClass: "text-emerald-500",
    badgeBgClass: "bg-emerald-500/90 text-white",
  },
};

const VALID_EMBLEM_IDS = new Set<VfsEmblemId>([
  "favorite",
  "important",
  "work",
  "personal",
]);

const GNOME_EMBLEM_MAP: Record<VfsEmblemId, string> = {
  favorite: "emblem-favorite",
  important: "emblem-important",
  work: "emblem-work",
  personal: "emblem-personal",
};

const REVERSE_GNOME_EMBLEM_MAP: Record<string, VfsEmblemId> = {
  "emblem-favorite": "favorite",
  "emblem-important": "important",
  "emblem-work": "work",
  "emblem-personal": "personal",
};

export function toGnomeEmblemName(id: VfsEmblemId): string {
  return GNOME_EMBLEM_MAP[id];
}

export function fromGnomeEmblemName(name: string): VfsEmblemId | null {
  const lower = name.trim().toLowerCase();
  if (VALID_EMBLEM_IDS.has(lower as VfsEmblemId)) {
    return lower as VfsEmblemId;
  }
  return REVERSE_GNOME_EMBLEM_MAP[lower] ?? null;
}

function normalizeEmblemList(raw: unknown): VfsEmblemId[] {
  if (!Array.isArray(raw)) return [];
  const out: VfsEmblemId[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const mapped = fromGnomeEmblemName(item);
    if (mapped && !out.includes(mapped)) {
      out.push(mapped);
    }
  }
  return out;
}

export function loadVfsEmblemsMap(): Record<string, VfsEmblemId[]> {
  if (!hasKv()) return {};
  const result: Record<string, VfsEmblemId[]> = {};

  // Primary source: GVfs-compatible `metadata::emblems` on WebVfsEntry records
  try {
    const entries = loadVfs();
    for (const entry of entries) {
      const rawMeta = entry.metadata?.["metadata::emblems"];
      const list = normalizeEmblemList(rawMeta);
      if (list.length > 0) {
        result[normalizeVfsPath(entry.path)] = list;
      }
    }
  } catch {
    // ignore VFS read errors
  }

  try {
    const raw = kv().getItem(VFS_EMBLEMS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed)) {
          const normPath = normalizeVfsPath(k);
          if (!result[normPath]) {
            const list = normalizeEmblemList(v);
            if (list.length > 0) {
              result[normPath] = list;
            }
          }
        }
        return result;
      }
    }
    // Migrate legacy favorites key if emblem map is not yet populated
    const legacyRaw = kv().getItem(WEB_VFS_FAVORITES_STORAGE_KEY);
    if (legacyRaw) {
      const parsedLegacy = JSON.parse(legacyRaw);
      if (Array.isArray(parsedLegacy)) {
        for (const item of parsedLegacy) {
          if (typeof item === "string") {
            const normPath = normalizeVfsPath(item);
            if (!result[normPath]) {
              result[normPath] = ["favorite"];
            }
          }
        }
        return result;
      }
    }
  } catch {
    // ignore storage errors
  }
  return result;
}

function saveVfsEmblemsMap(
  map: Record<string, VfsEmblemId[]>,
  emit = true,
  hintPaths: readonly string[] = [],
): void {
  const emblemChangedPaths: string[] = [...hintPaths];
  if (hasKv()) {
    try {
      const cleaned: Record<string, VfsEmblemId[]> = {};
      const favorites: string[] = [];
      for (const [path, list] of Object.entries(map)) {
        if (list.length > 0) {
          cleaned[path] = list;
          if (list.includes("favorite")) {
            favorites.push(path);
          }
        }
      }
      // Sync GVfs-compatible `metadata::emblems` onto VFS entries
      const entries = loadVfs();
      let entriesChanged = false;
      const nextEntries = entries.map((entry) => {
        const normPath = normalizeVfsPath(entry.path);
        const list = cleaned[normPath];
        const gnomeEmblems = list?.map(toGnomeEmblemName);
        const prevMeta = entry.metadata?.["metadata::emblems"];
        const same =
          JSON.stringify(prevMeta ?? null) ===
          JSON.stringify(gnomeEmblems ?? null);
        if (same) return entry;
        entriesChanged = true;
        emblemChangedPaths.push(entry.path);
        if (!gnomeEmblems || gnomeEmblems.length === 0) {
          if (!entry.metadata) return entry;
          const restMeta = { ...entry.metadata };
          delete restMeta["metadata::emblems"];
          return {
            ...entry,
            metadata: Object.keys(restMeta).length > 0 ? restMeta : undefined,
          };
        }
        return {
          ...entry,
          metadata: {
            ...(entry.metadata ?? {}),
            "metadata::emblems": gnomeEmblems,
          },
        };
      });
      if (entriesChanged) {
        // Memory first; the coalesced flush persists the VFS key.
        setVfsCache(nextEntries, vfsCacheRaw);
        vfsCacheFresh = true;
        if (vfsPendingPaths) emblemChangedPaths.forEach((p) => vfsPendingPaths?.add(p));
        scheduleVfsFlush();
      }
      kv().setItem(VFS_EMBLEMS_STORAGE_KEY, JSON.stringify(cleaned));
      kv().setItem(
        WEB_VFS_FAVORITES_STORAGE_KEY,
        JSON.stringify(favorites)
      );
    } catch {
      // ignore storage errors
    }
  }
  if (emit) {
    emitVfsChanged(emblemChangedPaths.length > 0 ? emblemChangedPaths : undefined);
  }
}

function migrateVfsEmblemsPrefix(
  oldRawPath: string,
  newRawPath: string | null
): void {
  const oldPath = normalizeVfsPath(oldRawPath);
  const newPath = newRawPath ? normalizeVfsPath(newRawPath) : null;
  const current = loadVfsEmblemsMap();
  if (Object.keys(current).length === 0) return;

  const oldPrefix = `${oldPath}/`;
  const next: Record<string, VfsEmblemId[]> = {};
  let changed = false;

  for (const [key, emblems] of Object.entries(current)) {
    if (key === oldPath) {
      changed = true;
      if (newPath) {
        next[newPath] = Array.from(new Set([...(next[newPath] ?? []), ...emblems]));
      }
    } else if (key.startsWith(oldPrefix)) {
      changed = true;
      if (newPath) {
        const suffix = key.slice(oldPrefix.length);
        const childPath = `${newPath}/${suffix}`;
        next[childPath] = Array.from(
          new Set([...(next[childPath] ?? []), ...emblems])
        );
      }
    } else {
      next[key] = emblems;
    }
  }

  if (changed) {
    saveVfsEmblemsMap(next, false);
  }
}

export function getVfsEmblems(rawPath: string): VfsEmblemId[] {
  const norm = normalizeVfsPath(rawPath);
  return loadVfsEmblemsMap()[norm] ?? [];
}

export function hasVfsEmblem(rawPath: string, emblem: VfsEmblemId): boolean {
  return getVfsEmblems(rawPath).includes(emblem);
}

export function setVfsEmblem(
  rawPath: string,
  emblem: VfsEmblemId,
  enabled: boolean
): VfsEmblemId[] {
  const norm = normalizeVfsPath(rawPath);
  const map = loadVfsEmblemsMap();
  const prev = map[norm] ?? [];
  const nextForPath = enabled
    ? prev.includes(emblem)
      ? prev
      : [...prev, emblem]
    : prev.filter((e) => e !== emblem);
  if (nextForPath.length > 0) {
    map[norm] = nextForPath;
  } else {
    delete map[norm];
  }
  saveVfsEmblemsMap(map, true, [norm]);
  return nextForPath;
}

export function toggleVfsEmblem(
  rawPath: string,
  emblem: VfsEmblemId
): VfsEmblemId[] {
  return setVfsEmblem(rawPath, emblem, !hasVfsEmblem(rawPath, emblem));
}

export function renameVfsEntry(
  rawPath: string,
  rawNextName: string
): WebVfsEntry | null {
  const oldPath = normalizeVfsPath(rawPath);
  const nextName = rawNextName.trim().replace(/[/\\]/g, "");
  if (!nextName) return null;

  const entries = loadVfs();
  const target = entries.find((e) => e.path === oldPath);
  if (!target || target.name === nextName) return null;

  const newPath = `${target.parentPath === "/" ? "" : target.parentPath}/${nextName}`;
  if (entries.some((e) => e.path === newPath)) return null;

  const oldPrefix = `${oldPath}/`;
  const updated = entries.map((entry) => {
    if (entry.path === oldPath) {
      return {
        ...entry,
        id: newPath,
        name: nextName,
        path: newPath,
        updatedAt: Date.now(),
      };
    }
    if (entry.path.startsWith(oldPrefix)) {
      const suffix = entry.path.slice(oldPrefix.length);
      const childPath = `${newPath}/${suffix}`;
      return {
        ...entry,
        id: childPath,
        path: childPath,
        parentPath: dirname(childPath),
      };
    }
    return entry;
  });

  migrateVfsEmblemsPrefix(oldPath, newPath);
  saveVfs(updated, [oldPath, newPath]);
  sync.emit({ type: "renamed", oldPath, newPath });
  sync.broadcast({ type: "renamed", oldPath, newPath });
  return updated.find((e) => e.path === newPath) ?? null;
}

/**
 * Permanently removes a file or directory (recursively) from `web-vfs`.
 */
export function removeVfsEntry(rawPath: string): boolean {
  const targetPath = normalizeVfsPath(rawPath);
  const entries = loadVfs();
  const target = entries.find((e) => e.path === targetPath);
  if (!target) return false;
  const targetPrefix = `${targetPath}/`;
  migrateVfsEmblemsPrefix(targetPath, null);
  saveVfs(
    entries.filter(
      (e) => e.path !== targetPath && !e.path.startsWith(targetPrefix),
    ),
    [targetPath],
  );
  return true;
}

export function trashVfsEntry(rawPath: string): void {
  const targetPath = normalizeVfsPath(rawPath);
  const entries = loadVfs();
  const target = entries.find((e) => e.path === targetPath);
  if (!target) return;

  const targetPrefix = `${targetPath}/`;
  if (
    target.parentPath === WEB_VFS_TRASH ||
    targetPath.startsWith(`${WEB_VFS_TRASH}/`)
  ) {
    migrateVfsEmblemsPrefix(targetPath, null);
    saveVfs(
      entries.filter(
        (e) => e.path !== targetPath && !e.path.startsWith(targetPrefix)
      ),
      [targetPath],
    );
    return;
  }

  const hasExt = target.kind === "file" && /\.[a-z0-9]+$/i.test(target.name);
  const stem = hasExt
    ? target.name.replace(/\.[a-z0-9]+$/i, "")
    : target.name;
  const ext = hasExt ? target.name.slice(stem.length) : "";
  const trashName = uniqueChildName(entries, WEB_VFS_TRASH, stem, ext);
  const newPath = `${WEB_VFS_TRASH}/${trashName}`;

  const updated = entries.map((entry) => {
    if (entry.path === targetPath) {
      return {
        ...entry,
        id: newPath,
        name: trashName,
        path: newPath,
        parentPath: WEB_VFS_TRASH,
        trashedFromPath: entry.path,
        updatedAt: Date.now(),
      };
    }
    if (entry.path.startsWith(targetPrefix)) {
      const suffix = entry.path.slice(targetPrefix.length);
      const childPath = `${newPath}/${suffix}`;
      return {
        ...entry,
        id: childPath,
        path: childPath,
        parentPath: dirname(childPath),
      };
    }
    return entry;
  });

  migrateVfsEmblemsPrefix(targetPath, newPath);
  saveVfs(updated, [targetPath, newPath]);
}

export function restoreVfsEntry(rawTrashPath: string): WebVfsEntry | null {
  const trashPath = normalizeVfsPath(rawTrashPath);
  const entries = loadVfs();
  const target = entries.find((e) => e.path === trashPath);
  if (!target) return null;

  const desiredOriginal =
    target.trashedFromPath || `${WEB_VFS_HOME}/Desktop/${target.name}`;
  let destDir = dirname(desiredOriginal);
  if (!entries.some((e) => e.path === destDir && e.kind === "directory")) {
    destDir = `${WEB_VFS_HOME}/Desktop`;
  }

  const hasExt = target.kind === "file" && /\.[a-z0-9]+$/i.test(target.name);
  const stem = hasExt
    ? target.name.replace(/\.[a-z0-9]+$/i, "")
    : target.name;
  const ext = hasExt ? target.name.slice(stem.length) : "";
  const restoredName = uniqueChildName(entries, destDir, stem, ext);
  const newPath = `${destDir === "/" ? "" : destDir}/${restoredName}`;
  const oldPrefix = `${trashPath}/`;

  let restoredEntry: WebVfsEntry | null = null;
  const updated = entries.map((entry) => {
    if (entry.path === trashPath) {
      const next: WebVfsEntry = {
        ...entry,
        id: newPath,
        name: restoredName,
        path: newPath,
        parentPath: destDir,
        trashedFromPath: undefined,
        updatedAt: Date.now(),
      };
      restoredEntry = next;
      return next;
    }
    if (entry.path.startsWith(oldPrefix)) {
      const suffix = entry.path.slice(oldPrefix.length);
      const childPath = `${newPath}/${suffix}`;
      return {
        ...entry,
        id: childPath,
        path: childPath,
        parentPath: dirname(childPath),
      };
    }
    return entry;
  });

  migrateVfsEmblemsPrefix(trashPath, newPath);
  saveVfs(updated, [trashPath, newPath]);
  return restoredEntry;
}

export function emptyVfsTrash(): void {
  const entries = loadVfs();
  const trashPrefix = `${WEB_VFS_TRASH}/`;
  for (const entry of entries) {
    if (entry.parentPath === WEB_VFS_TRASH) {
      migrateVfsEmblemsPrefix(entry.path, null);
    }
  }
  saveVfs(entries.filter((e) => !e.path.startsWith(trashPrefix)), [WEB_VFS_TRASH]);
}

export function moveVfsEntry(
  rawSrcPath: string,
  rawDestDirPath: string
): WebVfsEntry | null {
  const srcPath = normalizeVfsPath(rawSrcPath);
  const destDir = normalizeVfsPath(rawDestDirPath);
  if (srcPath === destDir || destDir.startsWith(`${srcPath}/`)) return null;

  const entries = loadVfs();
  const target = entries.find((e) => e.path === srcPath);
  if (!target || target.parentPath === destDir) return null;

  if (destDir === WEB_VFS_TRASH) {
    trashVfsEntry(srcPath);
    return null;
  }

  const hasExt = target.kind === "file" && /\.[a-z0-9]+$/i.test(target.name);
  const stem = hasExt
    ? target.name.replace(/\.[a-z0-9]+$/i, "")
    : target.name;
  const ext = hasExt ? target.name.slice(stem.length) : "";
  const nextName = uniqueChildName(entries, destDir, stem, ext);
  const newPath = `${destDir === "/" ? "" : destDir}/${nextName}`;
  const oldPrefix = `${srcPath}/`;

  const updated = entries.map((entry) => {
    if (entry.path === srcPath) {
      return {
        ...entry,
        id: newPath,
        name: nextName,
        path: newPath,
        parentPath: destDir,
        updatedAt: Date.now(),
      };
    }
    if (entry.path.startsWith(oldPrefix)) {
      const suffix = entry.path.slice(oldPrefix.length);
      const childPath = `${newPath}/${suffix}`;
      return {
        ...entry,
        id: childPath,
        path: childPath,
        parentPath: dirname(childPath),
      };
    }
    return entry;
  });

  migrateVfsEmblemsPrefix(srcPath, newPath);
  saveVfs(updated, [srcPath, newPath]);
  return updated.find((e) => e.path === newPath) ?? null;
}

/**
 * Subscribes to VFS changes. Pass `watch` to only be woken for changes that can
 * affect those paths (see `vfsChangeAffects`); without it every change notifies.
 * Changes from other windows/iframes carry paths when the sender knew them.
 */
export function subscribeWebVfs(
  listener: (detail: WebVfsChangeDetail) => void,
  watch?: VfsWatch | readonly VfsWatch[],
): () => void {
  const deliver = (paths: readonly string[] | undefined) => {
    if (watch && !vfsChangeAffects(paths, watch)) {
      vfsPerf.listenerSkips += 1;
      return;
    }
    vfsPerf.listenerCalls += 1;
    listener(paths ? { paths } : {});
  };
  const offMessages = sync.subscribe((msg, remote) => {
    if (msg.type === "changed") {
      deliver(msg.paths);
    } else if (remote) {
      deliver([msg.oldPath, msg.newPath]);
    }
  });
  const offStorage = sync.onExternalWrite((key) => {
    if (
      key === WEB_VFS_STORAGE_KEY ||
      key === VFS_EMBLEMS_STORAGE_KEY ||
      key === WEB_VFS_FAVORITES_STORAGE_KEY
    ) {
      // Broadcasts carry paths for VFS writes; `storage` events are a fallback
      // for emblems/favorites and for windows without a broadcast channel.
      if (key === WEB_VFS_STORAGE_KEY && sync.canBroadcast) return;
      deliver(undefined);
    }
  });
  return () => {
    offMessages();
    offStorage();
  };
}

export function subscribeVfsRenamed(
  listener: (detail: { oldPath: string; newPath: string }) => void
): () => void {
  return sync.subscribe((msg) => {
    if (msg.type === "renamed") listener({ oldPath: msg.oldPath, newPath: msg.newPath });
  });
}

function escapeHtmlAttr(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Builds a navigable URL (`blob:` or `data:`) so a VFS file (html, text,
 * image, video/audio, etc.) opens directly inside a standalone web app window.
 */
export function buildVfsEntryWebAppUrl(entry: WebVfsEntry): string {
  const lower = entry.name.toLowerCase();
  const content = entry.content ?? "";

  if (/\.(html|htm)$/.test(lower)) {
    return URL.createObjectURL(
      new Blob([content], { type: "text/html;charset=utf-8" })
    );
  }
  if (/\.svg$/.test(lower)) {
    return URL.createObjectURL(
      new Blob([content], { type: "image/svg+xml;charset=utf-8" })
    );
  }
  if (/\.(png|jpe?g|gif|webp|bmp|ico|avif)$/.test(lower)) {
    const trimmed = content.trim();
    if (/^(data:image\/|blob:|https?:\/\/)/i.test(trimmed)) {
      const html = `<!doctype html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#141414"><img src="${escapeHtmlAttr(trimmed)}" alt="${escapeHtmlAttr(entry.name)}" style="max-width:100%;max-height:100vh;object-fit:contain"/></body></html>`;
      return URL.createObjectURL(
        new Blob([html], { type: "text/html;charset=utf-8" })
      );
    }
  }
  if (/\.(mp4|webm|ogg|mov)$/.test(lower)) {
    const trimmed = content.trim();
    if (/^(data:|blob:|https?:\/\/)/i.test(trimmed)) {
      const html = `<!doctype html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#000"><video controls autoplay src="${escapeHtmlAttr(trimmed)}" style="max-width:100%;max-height:100vh"></video></body></html>`;
      return URL.createObjectURL(
        new Blob([html], { type: "text/html;charset=utf-8" })
      );
    }
  }
  if (/\.(mp3|wav|flac|m4a)$/.test(lower)) {
    const trimmed = content.trim();
    if (/^(data:|blob:|https?:\/\/)/i.test(trimmed)) {
      const html = `<!doctype html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#181818;color:#fff;font-family:system-ui"><audio controls autoplay src="${escapeHtmlAttr(trimmed)}"></audio></body></html>`;
      return URL.createObjectURL(
        new Blob([html], { type: "text/html;charset=utf-8" })
      );
    }
  }
  if (/\.pdf$/.test(lower)) {
    const trimmed = content.trim();
    if (/^(data:application\/pdf|blob:|https?:\/\/)/i.test(trimmed)) {
      return trimmed;
    }
  }
  return URL.createObjectURL(
    new Blob([content], { type: "text/plain;charset=utf-8" })
  );
}

const TEXT_EDITABLE_EXT_RE =
  /\.(txt|md|markdown|json|css|scss|less|js|mjs|cjs|ts|tsx|jsx|xml|csv|tsv|ya?ml|toml|ini|conf|cfg|log|sh|bash|zsh|py|rb|rs|go|java|c|cpp|h|hpp|sql)$/i;

/**
 * Returns true for plain-text / markdown / code files that should open in
 * `TextEditorApp` by default instead of a standalone web view.
 */
export function isTextEditableVfsFile(name: string): boolean {
  const lower = name.toLowerCase();
  if (/\.(html?|svg|png|jpe?g|gif|webp|bmp|ico|avif|mp4|webm|mkv|mov|avi|m4v|mp3|wav|flac|m4a|ogg|aac|pdf|zip|tar|gz|bz2|xz|7z|rar)$/i.test(lower)) {
    return false;
  }
  return TEXT_EDITABLE_EXT_RE.test(lower) || !/\.[a-z0-9]+$/i.test(lower);
}

const TEXT_FILE_EXT_RE =
  /\.(txt|md|markdown|json|html?|css|scss|less|js|mjs|cjs|ts|tsx|jsx|svg|xml|csv|tsv|ya?ml|toml|ini|conf|cfg|log|sh|bash|zsh|py|rb|rs|go|java|c|cpp|h|hpp|sql)$/i;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Virtually copies external OS files dropped from the host into the
 * localStorage VFS at `targetDir`.
 */
export async function importExternalFilesToVfs(
  targetDir: string,
  files: FileList | readonly File[]
): Promise<WebVfsEntry[]> {
  const list = Array.from(files);
  if (list.length === 0) return [];
  const dir = normalizeVfsPath(targetDir);
  const imported: WebVfsEntry[] = [];

  for (const file of list) {
    const name = file.name || "Imported";
    const isText =
      file.type.startsWith("text/") ||
      file.type === "application/json" ||
      file.type === "application/xml" ||
      file.type === "image/svg+xml" ||
      TEXT_FILE_EXT_RE.test(name);
    const content = isText ? await file.text() : await readFileAsDataUrl(file);
    imported.push(createVfsTextFile(dir, name, content));
  }

  return imported;
}

export function loadVfsFavorites(): string[] {
  const map = loadVfsEmblemsMap();
  return Object.entries(map)
    .filter(([, emblems]) => emblems.includes("favorite"))
    .map(([path]) => path);
}

export function isVfsFavorite(path: string): boolean {
  return hasVfsEmblem(path, "favorite");
}

export function toggleVfsFavorite(path: string): string[] {
  toggleVfsEmblem(path, "favorite");
  return loadVfsFavorites();
}

export function listVfsFavoriteEntries(): WebVfsEntry[] {
  const favSet = new Set(loadVfsFavorites());
  return loadVfs().filter((e) => favSet.has(e.path));
}

export function listVfsRecentEntries(limit = 30): WebVfsEntry[] {
  return loadVfs()
    .filter(
      (e) =>
        e.kind === "file" &&
        !e.path.startsWith(`${VFS_HOME}/.local/`) &&
        e.updatedAt > 0,
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function copyVfsEntry(
  rawSourcePath: string,
  rawTargetDir: string,
): WebVfsEntry | null {
  const srcPath = normalizeVfsPath(rawSourcePath);
  const targetDir = normalizeVfsPath(rawTargetDir);
  const src = getVfsEntry(srcPath);
  if (!src) return null;
  if (src.kind === "file") {
    const entries = loadVfs();
    const hasExt = /\.[a-z0-9]+$/i.test(src.name);
    const stem = hasExt ? src.name.replace(/\.[a-z0-9]+$/i, "") : src.name;
    const ext = hasExt ? src.name.slice(stem.length) : "";
    const name = uniqueChildName(entries, targetDir, stem, ext);
    const fullPath = `${targetDir === "/" ? "" : targetDir}/${name}`;
    const created: WebVfsEntry = {
      id: fullPath,
      name,
      kind: "file",
      path: fullPath,
      parentPath: targetDir,
      content: src.content ?? "",
      updatedAt: Date.now(),
    };
    saveVfs([...entries, created], [created.path]);
    return created;
  }
  if (targetDir === srcPath || targetDir.startsWith(`${srcPath}/`)) return null;
  const folder = createVfsFolder(targetDir, src.name);
  const children = listVfsDir(src.path);
  for (const child of children) {
    copyVfsEntry(child.path, folder.path);
  }
  return folder;
}

/** Creates a symbolic link to `rawSourcePath` inside `rawTargetDir` (browser VFS only). */
export function createVfsSymlink(
  rawSourcePath: string,
  rawTargetDir: string,
  linkName?: string,
): WebVfsEntry | null {
  const srcPath = normalizeVfsPath(rawSourcePath);
  const targetDir = normalizeVfsPath(rawTargetDir);
  const src = getVfsEntry(srcPath);
  if (!src) return null;
  const entries = loadVfs();
  const baseName = linkName ?? src.name;
  const hasExt = src.kind === "file" && /\.[a-z0-9]+$/i.test(baseName);
  const stem = hasExt ? baseName.replace(/\.[a-z0-9]+$/i, "") : baseName;
  const ext = hasExt ? baseName.slice(stem.length) : "";
  const name = uniqueChildName(entries, targetDir, stem, ext);
  const fullPath = `${targetDir === "/" ? "" : targetDir}/${name}`;
  const created: WebVfsEntry = {
    id: fullPath,
    name,
    kind: src.kind,
    path: fullPath,
    parentPath: targetDir,
    isSymlink: true,
    symlinkTarget: srcPath,
    content: src.kind === "file" ? (src.content ?? "") : undefined,
    updatedAt: Date.now(),
  };
  saveVfs([...entries, created], [created.path]);
  return created;
}

export function duplicateVfsEntry(rawPath: string): WebVfsEntry | null {
  const srcPath = normalizeVfsPath(rawPath);
  const src = getVfsEntry(srcPath);
  if (!src) return null;
  const parentDir = src.parentPath;
  const entries = loadVfs();

  if (src.kind === "file") {
    const hasExt = /\.[a-z0-9]+$/i.test(src.name);
    const stem = hasExt ? src.name.replace(/\.[a-z0-9]+$/i, "") : src.name;
    const ext = hasExt ? src.name.slice(stem.length) : "";
    const copyName = uniqueChildName(entries, parentDir, `${stem} Copy`, ext);
    const fullPath = `${parentDir === "/" ? "" : parentDir}/${copyName}`;
    const created: WebVfsEntry = {
      id: fullPath,
      name: copyName,
      kind: "file",
      path: fullPath,
      parentPath: parentDir,
      content: src.content ?? "",
      updatedAt: Date.now(),
    };
    saveVfs([...entries, created], [created.path]);
    return created;
  }

  const copyFolderName = uniqueChildName(entries, parentDir, `${src.name} Copy`);
  const folderPath = `${parentDir === "/" ? "" : parentDir}/${copyFolderName}`;
  const folder: WebVfsEntry = {
    id: folderPath,
    name: copyFolderName,
    kind: "directory",
    path: folderPath,
    parentPath: parentDir,
    updatedAt: Date.now(),
  };
  saveVfs([...entries, folder], [folder.path]);
  for (const child of listVfsDir(src.path)) {
    copyVfsEntry(child.path, folder.path);
  }
  return folder;
}

export interface VfsClipboardState {
  mode: "cut" | "copy";
  paths: string[];
}

export const WEB_VFS_CLIPBOARD_CHANGED_EVENT = "piloti:vfs-clipboard-changed";

let sharedVfsClipboard: VfsClipboardState | null = null;

export function getVfsClipboard(): VfsClipboardState | null {
  return sharedVfsClipboard
    ? { mode: sharedVfsClipboard.mode, paths: [...sharedVfsClipboard.paths] }
    : null;
}

export function setVfsClipboard(next: VfsClipboardState | null): void {
  const cleaned =
    next && next.paths.length > 0
      ? {
          mode: next.mode,
          paths: Array.from(
            new Set(next.paths.map((p) => normalizeVfsPath(p))),
          ),
        }
      : null;
  sharedVfsClipboard = cleaned;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(WEB_VFS_CLIPBOARD_CHANGED_EVENT));
  }
}

export function subscribeVfsClipboard(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(WEB_VFS_CLIPBOARD_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener(WEB_VFS_CLIPBOARD_CHANGED_EVENT, listener);
  };
}

const IMAGE_FILE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|ico|svg)$/i;

export function isImageVfsFile(name: string, content?: string): boolean {
  if (IMAGE_FILE_EXT_RE.test(name)) return true;
  return Boolean(content && content.startsWith("data:image/"));
}

export function getVfsContentType(
  entry?: Pick<WebVfsEntry, "content" | "metadata">
): string | undefined {
  if (!entry) return undefined;
  const metaType = entry.metadata?.["standard::content-type"];
  if (typeof metaType === "string" && metaType.trim()) {
    return metaType.split(";")[0]?.trim().toLowerCase();
  }
  if (entry.content?.startsWith("data:")) {
    const header = entry.content.slice(5, entry.content.indexOf(","));
    const mime = header.split(";")[0]?.trim().toLowerCase();
    if (mime) return mime;
  }
  return undefined;
}

export function getVfsImageThumbnailUrl(
  name: string,
  content?: string,
  metadata?: WebVfsEntry["metadata"],
): string | undefined {
  const metaThumb = metadata?.["metadata::thumbnail"];
  if (typeof metaThumb === "string" && metaThumb.startsWith("data:image/")) {
    return metaThumb;
  }
  if (!content) return undefined;
  if (content.startsWith("data:image/")) return content;
  if (name.toLowerCase().endsWith(".svg") && content.includes("<svg")) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(content)}`;
  }
  return undefined;
}

const TEXT_UNZIP_EXT_RE =
  /\.(txt|md|markdown|json|html?|css|scss|js|jsx|ts|tsx|mjs|cjs|sh|bash|zsh|ini|conf|cfg|toml|ya?ml|xml|svg|csv|log|py|rs|go|c|h|cpp|java|rb|php|sql)$/i;

export function isZipVfsFile(name: string, content?: string): boolean {
  return (
    name.toLowerCase().endsWith(".zip") ||
    Boolean(content?.startsWith("data:application/zip;"))
  );
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx < 0) return null;
  const header = dataUrl.slice(5, commaIdx);
  const payload = dataUrl.slice(commaIdx + 1);
  const isBase64 = header.endsWith(";base64");
  const mime =
    (isBase64 ? header.slice(0, -";base64".length) : header) ||
    "application/octet-stream";
  if (isBase64) {
    const bin = atob(payload);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(payload)], { type: mime });
}

export function downloadVfsFile(path: string): boolean {
  if (typeof document === "undefined") return false;
  const entry = getVfsEntry(path);
  if (!entry || entry.kind !== "file") return false;
  const content = entry.content ?? "";
  const blob = content.startsWith("data:")
    ? (dataUrlToBlob(content) ?? new Blob([content], { type: "text/plain;charset=utf-8" }))
    : new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = entry.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export async function compressVfsEntries(
  paths: readonly string[],
): Promise<WebVfsEntry | null> {
  if (paths.length === 0) return null;
  const entries = loadVfs();
  const targets = paths
    .map((p) => entries.find((e) => e.path === normalizeVfsPath(p)))
    .filter((e): e is WebVfsEntry => Boolean(e));
  if (targets.length === 0) return null;

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  const addEntryToZip = (entry: WebVfsEntry, relPath: string) => {
    if (entry.kind === "directory") {
      zip.folder(relPath);
      const children = entries.filter((e) => e.parentPath === entry.path);
      for (const child of children) {
        addEntryToZip(child, `${relPath}/${child.name}`);
      }
      return;
    }
    const content = entry.content ?? "";
    const base64Match = content.match(/^data:[^;]*;base64,(.*)$/s);
    if (base64Match) {
      zip.file(relPath, base64Match[1], { base64: true });
    } else {
      zip.file(relPath, content);
    }
  };

  for (const target of targets) {
    addEntryToZip(target, target.name);
  }

  const parentPath = targets[0].parentPath || WEB_VFS_HOME;
  const baseName = targets.length === 1 ? targets[0].name : "Archive";
  const zipName = uniqueChildName(entries, parentPath, baseName, ".zip");
  const zipPath = `${parentPath === "/" ? "" : parentPath}/${zipName}`;
  const b64 = await zip.generateAsync({ type: "base64" });
  const created: WebVfsEntry = {
    id: zipPath,
    name: zipName,
    kind: "file",
    path: zipPath,
    parentPath,
    content: `data:application/zip;base64,${b64}`,
    updatedAt: Date.now(),
  };
  entries.push(created);
  saveVfs(entries, [zipPath]);
  return created;
}

export async function extractVfsZip(zipPath: string): Promise<WebVfsEntry | null> {
  const entries = loadVfs();
  const zipEntry = entries.find((e) => e.path === normalizeVfsPath(zipPath));
  if (!zipEntry || zipEntry.kind !== "file") return null;

  const JSZip = (await import("jszip")).default;
  const content = zipEntry.content ?? "";
  const base64Match = content.match(/^data:[^;]*;base64,(.*)$/s);
  const zip = await JSZip.loadAsync(
    base64Match ? base64Match[1] : content,
    base64Match ? { base64: true } : undefined,
  );

  const parentPath = zipEntry.parentPath || WEB_VFS_HOME;
  const stem = zipEntry.name.replace(/\.zip$/i, "") || "Archive";
  const folderName = uniqueChildName(entries, parentPath, stem);
  const rootFolderPath = `${parentPath === "/" ? "" : parentPath}/${folderName}`;
  const now = Date.now();

  const ensureDir = (dirPath: string) => {
    const norm = normalizeVfsPath(dirPath);
    if (entries.some((e) => e.path === norm)) return;
    const idx = norm.lastIndexOf("/");
    const pPath = idx <= 0 ? "/" : norm.slice(0, idx);
    if (pPath !== "/" && !entries.some((e) => e.path === pPath)) {
      ensureDir(pPath);
    }
    entries.push({
      id: norm,
      name: basename(norm),
      kind: "directory",
      path: norm,
      parentPath: pPath,
      updatedAt: now,
    });
  };

  const rootFolder: WebVfsEntry = {
    id: rootFolderPath,
    name: folderName,
    kind: "directory",
    path: rootFolderPath,
    parentPath,
    updatedAt: now,
  };
  entries.push(rootFolder);

  for (const [relRaw, fileObj] of Object.entries(zip.files)) {
    const cleanRel = relRaw.replace(/^\/+|\/+$/g, "");
    if (!cleanRel || cleanRel.includes("..")) continue;
    const targetPath = `${rootFolderPath}/${cleanRel}`;
    if (fileObj.dir) {
      ensureDir(targetPath);
      continue;
    }
    const lastSlash = targetPath.lastIndexOf("/");
    const dirPath = targetPath.slice(0, lastSlash);
    ensureDir(dirPath);
    const fileName = basename(targetPath);
    let fileContent: string;
    if (TEXT_UNZIP_EXT_RE.test(fileName)) {
      fileContent = await fileObj.async("string");
    } else {
      const b64 = await fileObj.async("base64");
      const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
      const mime =
        ext === "png"
          ? "image/png"
          : ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : ext === "gif"
              ? "image/gif"
              : ext === "webp"
                ? "image/webp"
                : "application/octet-stream";
      fileContent = `data:${mime};base64,${b64}`;
    }
    entries.push({
      id: targetPath,
      name: fileName,
      kind: "file",
      path: targetPath,
      parentPath: dirPath,
      content: fileContent,
      updatedAt: now,
    });
  }

  saveVfs(entries, [rootFolderPath]);
  return rootFolder;
}

export interface WebVfsBackingStorageEntry {
  key: string;
  bytes: number;
  value: string;
}

/**
 * Returns a snapshot array of all current entries in `web-vfs`.
 */
export function getVfsSnapshotEntries(): WebVfsEntry[] {
  return [...loadVfs()];
}

/**
 * Merges arbitrary metadata keys (e.g. GVFS-compatible `metadata::piloti-cursor`)
 * onto an existing VFS entry without altering its content or updatedAt timestamp.
 */
export function setVfsEntryMetadata(
  path: string,
  patch: Record<string, unknown>
): void {
  const normalized = normalizeVfsPath(path);
  const entries = loadVfs();
  const idx = entries.findIndex((e) => e.path === normalized);
  if (idx < 0) return;
  const current = entries[idx];
  const nextMeta = { ...(current.metadata ?? {}), ...patch };
  const nextEntries = [...entries];
  nextEntries[idx] = { ...current, metadata: nextMeta };
  saveVfs(nextEntries, [normalized]);
}

/**
 * Reads and deletes a legacy `localStorage` key during one-time migration into VFS.
 * Keeps `localStorage` encapsulated inside `web-vfs.ts`.
 */
export function consumeLegacyLocalStorageValue(key: string): string | null {
  if (!hasKv()) return null;
  try {
    const raw = kv().getItem(key);
    if (raw !== null) {
      kv().removeItem(key);
    }
    return raw;
  } catch {
    return null;
  }
}

/**
 * Lists raw `localStorage` backing entries for the DevTools Storage inspector.
 */
export function listWebVfsBackingStorageEntries(): WebVfsBackingStorageEntry[] {
  if (!hasKv()) return [];
  flushWebVfs();
  const entries: WebVfsBackingStorageEntry[] = [];
  for (const key of kv().keys()) {
    if (!key) continue;
    const value = kv().getItem(key) ?? "";
    const bytes = new Blob([value]).size;
    entries.push({ key, bytes, value });
  }
  entries.sort((a, b) => b.bytes - a.bytes || a.key.localeCompare(b.key));
  return entries;
}

/**
 * Resets all browser VFS backing storage keys and invalidates the in-memory VFS cache.
 */
function clearVfsMemoryCache(): void {
  // Drop pending writes so a scheduled flush can't resurrect the old VFS.
  if (vfsFlushTimer !== null) {
    clearTimeout(vfsFlushTimer);
    vfsFlushTimer = null;
  }
  vfsFlushPending = false;
  vfsPendingPaths = new Set();
  vfsCacheFresh = false;
  vfsCacheRaw = null;
  vfsCacheEntries = null;
  vfsCacheByPath = null;
}

export function clearAllWebVfsBackingStorage(): void {
  clearVfsMemoryCache();
  if (!hasKv()) return;
  try {
    for (const key of kv().keys()) {
      if (key.startsWith("piloti.") || key.startsWith("vfs_")) {
        kv().removeItem(key);
      }
    }
  } catch {
    // ignore storage errors
  }
}


