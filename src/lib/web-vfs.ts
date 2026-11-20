import { WELCOME_HTML } from "./welcome-html";

export interface WebVfsEntry {
  id: string;
  name: string;
  kind: "directory" | "file";
  path: string;
  parentPath: string;
  content?: string;
  trashedFromPath?: string;
  updatedAt: number;
}

export const WEB_VFS_STORAGE_KEY = "piloti.web.vfs.v1";
export const WEB_VFS_CHANGED_EVENT = "piloti:web-vfs-changed";

export const WEB_VFS_HOME = "/home/user";
export const WEB_VFS_TRASH = "/home/user/.local/share/Trash/files";

const DEFAULT_DIRS = [
  "/home/user",
  "/home/user/Desktop",
  "/home/user/Documents",
  "/home/user/Downloads",
  "/home/user/Music",
  "/home/user/Pictures",
  "/home/user/Videos",
  "/home/user/.local",
  "/home/user/.local/share",
  "/home/user/.local/share/applications",
  "/home/user/.local/share/Trash",
  WEB_VFS_TRASH,
];

function basename(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "/";
}

function dirname(path: string): string {
  const normalized = normalizeVfsPath(path);
  if (normalized === "/") return "/";
  const idx = normalized.lastIndexOf("/");
  return idx <= 0 ? "/" : normalized.slice(0, idx);
}

/**
 * Normalizes a VFS path into an absolute `/home/user/...` path.
 */
export function normalizeVfsPath(rawPath?: string): string {
  if (!rawPath || rawPath === "~" || rawPath === "~/") return WEB_VFS_HOME;
  let trimmed = rawPath.trim();
  if (trimmed.startsWith("~/")) {
    trimmed = `${WEB_VFS_HOME}/${trimmed.slice(2)}`;
  } else if (!trimmed.startsWith("/")) {
    trimmed = `${WEB_VFS_HOME}/${trimmed}`;
  }
  const normalized = trimmed.replace(/\/+/g, "/").replace(/\/+$/, "");
  return normalized || "/";
}

/**
 * Resolves a relative or `~`-prefixed path against a VFS working directory.
 */
export function resolveVfsPath(cwd: string, rawTarget?: string): string {
  const base = normalizeVfsPath(cwd);
  if (!rawTarget || !rawTarget.trim()) return base;
  const target = rawTarget.trim();
  if (target === "~") return WEB_VFS_HOME;
  const combined = target.startsWith("~/")
    ? `${WEB_VFS_HOME}/${target.slice(2)}`
    : target.startsWith("/")
      ? target
      : `${base === "/" ? "" : base}/${target}`;

  const parts: string[] = [];
  for (const seg of combined.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      parts.pop();
    } else {
      parts.push(seg);
    }
  }
  return `/${parts.join("/")}`;
}

function createInitialVfs(): WebVfsEntry[] {
  const now = Date.now();
  const entries: WebVfsEntry[] = DEFAULT_DIRS.map((dirPath) => ({
    id: dirPath,
    name: basename(dirPath),
    kind: "directory",
    path: dirPath,
    parentPath: dirname(dirPath),
    updatedAt: now,
  }));

  entries.push(
    {
      id: "/home/user/Desktop/Welcome.html",
      name: "Welcome.html",
      kind: "file",
      path: "/home/user/Desktop/Welcome.html",
      parentPath: "/home/user/Desktop",
      content: WELCOME_HTML,
      updatedAt: now,
    },
    {
      id: "/home/user/Desktop/Projects",
      name: "Projects",
      kind: "directory",
      path: "/home/user/Desktop/Projects",
      parentPath: "/home/user/Desktop",
      updatedAt: now,
    },
    {
      id: "/home/user/Documents/Notes.txt",
      name: "Notes.txt",
      kind: "file",
      path: "/home/user/Documents/Notes.txt",
      parentPath: "/home/user/Documents",
      content: "Notes\n-----\n- Test Piloti Files & Desktop VFS\n",
      updatedAt: now,
    },
    {
      id: "/home/user/Downloads/readme.md",
      name: "readme.md",
      kind: "file",
      path: "/home/user/Downloads/readme.md",
      parentPath: "/home/user/Downloads",
      content: "# Downloads\n\nLocal browser VFS folder stored in localStorage.\n",
      updatedAt: now,
    }
  );

  return entries;
}

function loadVfs(): WebVfsEntry[] {
  if (typeof localStorage === "undefined") {
    return createInitialVfs();
  }
  try {
    const raw = localStorage.getItem(WEB_VFS_STORAGE_KEY);
    if (!raw) {
      const seeded = createInitialVfs();
      localStorage.setItem(WEB_VFS_STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const entries = parsed as WebVfsEntry[];
      const welcomeFlagKey = "piloti.web.vfs.welcome.v1";
      if (!localStorage.getItem(welcomeFlagKey)) {
        localStorage.setItem(welcomeFlagKey, "1");
        const hasWelcome = entries.some(
          (e) =>
            e.path === "/home/user/Desktop/Welcome.html" ||
            e.path === `${WEB_VFS_TRASH}/Welcome.html`
        );
        if (!hasWelcome) {
          entries.push({
            id: "/home/user/Desktop/Welcome.html",
            name: "Welcome.html",
            kind: "file",
            path: "/home/user/Desktop/Welcome.html",
            parentPath: "/home/user/Desktop",
            content: WELCOME_HTML,
            updatedAt: Date.now(),
          });
          localStorage.setItem(WEB_VFS_STORAGE_KEY, JSON.stringify(entries));
        }
      }
      return entries;
    }
  } catch {
    // ignore corrupted storage and re-seed
  }
  const seeded = createInitialVfs();
  try {
    localStorage.setItem(WEB_VFS_STORAGE_KEY, JSON.stringify(seeded));
  } catch {
    // ignore quota errors
  }
  return seeded;
}

function saveVfs(entries: WebVfsEntry[]): void {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(WEB_VFS_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // ignore quota errors
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(WEB_VFS_CHANGED_EVENT));
  }
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

export function listVfsDir(
  dirPath: string,
  options?: { includeHidden?: boolean }
): WebVfsEntry[] {
  const normalized = normalizeVfsPath(dirPath);
  const entries = loadVfs();
  const includeHidden = Boolean(options?.includeHidden);
  const direct = entries.filter(
    (entry) =>
      entry.parentPath === normalized &&
      (includeHidden || !entry.name.startsWith("."))
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
  const found = loadVfs().find((entry) => entry.path === normalized);
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
  saveVfs([...entries, created]);
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
  saveVfs([...entries, created]);
  return created;
}

export function writeVfsTextFile(path: string, content: string): WebVfsEntry {
  const normalized = normalizeVfsPath(path);
  const entries = loadVfs();
  const existing = entries.find((e) => e.path === normalized);
  if (existing) {
    const updated = entries.map((e) =>
      e.path === normalized ? { ...e, content, updatedAt: Date.now() } : e
    );
    saveVfs(updated);
    return { ...existing, content, updatedAt: Date.now() };
  }
  const created: WebVfsEntry = {
    id: normalized,
    name: basename(normalized),
    kind: "file",
    path: normalized,
    parentPath: dirname(normalized),
    content,
    updatedAt: Date.now(),
  };
  saveVfs([...entries, created]);
  return created;
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

function normalizeEmblemList(raw: unknown): VfsEmblemId[] {
  if (!Array.isArray(raw)) return [];
  const out: VfsEmblemId[] = [];
  for (const item of raw) {
    if (
      typeof item === "string" &&
      VALID_EMBLEM_IDS.has(item as VfsEmblemId) &&
      !out.includes(item as VfsEmblemId)
    ) {
      out.push(item as VfsEmblemId);
    }
  }
  return out;
}

export function loadVfsEmblemsMap(): Record<string, VfsEmblemId[]> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(VFS_EMBLEMS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const result: Record<string, VfsEmblemId[]> = {};
        for (const [k, v] of Object.entries(parsed)) {
          const list = normalizeEmblemList(v);
          if (list.length > 0) {
            result[normalizeVfsPath(k)] = list;
          }
        }
        return result;
      }
    }
    // Migrate legacy favorites key if emblem map is not yet populated
    const legacyRaw = localStorage.getItem(WEB_VFS_FAVORITES_STORAGE_KEY);
    if (legacyRaw) {
      const parsedLegacy = JSON.parse(legacyRaw);
      if (Array.isArray(parsedLegacy)) {
        const migrated: Record<string, VfsEmblemId[]> = {};
        for (const item of parsedLegacy) {
          if (typeof item === "string") {
            migrated[normalizeVfsPath(item)] = ["favorite"];
          }
        }
        return migrated;
      }
    }
  } catch {
    // ignore storage errors
  }
  return {};
}

function saveVfsEmblemsMap(map: Record<string, VfsEmblemId[]>, emit = true): void {
  if (typeof localStorage !== "undefined") {
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
      localStorage.setItem(VFS_EMBLEMS_STORAGE_KEY, JSON.stringify(cleaned));
      localStorage.setItem(
        WEB_VFS_FAVORITES_STORAGE_KEY,
        JSON.stringify(favorites)
      );
    } catch {
      // ignore storage errors
    }
  }
  if (emit && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(WEB_VFS_CHANGED_EVENT));
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
  saveVfsEmblemsMap(map, true);
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
  saveVfs(updated);
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
      )
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
  saveVfs(updated);
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
  saveVfs(updated);
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
  saveVfs(entries.filter((e) => !e.path.startsWith(trashPrefix)));
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
  saveVfs(updated);
  return updated.find((e) => e.path === newPath) ?? null;
}

export function subscribeWebVfs(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (
      e.key === WEB_VFS_STORAGE_KEY ||
      e.key === VFS_EMBLEMS_STORAGE_KEY ||
      e.key === WEB_VFS_FAVORITES_STORAGE_KEY
    ) {
      listener();
    }
  };
  window.addEventListener(WEB_VFS_CHANGED_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(WEB_VFS_CHANGED_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
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
        !e.path.startsWith("/home/user/.local/") &&
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
    saveVfs([...entries, created]);
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
    saveVfs([...entries, created]);
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
  saveVfs([...entries, folder]);
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

export function getVfsImageThumbnailUrl(
  name: string,
  content?: string,
): string | undefined {
  if (!content) return undefined;
  if (content.startsWith("data:image/")) return content;
  if (name.toLowerCase().endsWith(".svg") && content.includes("<svg")) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(content)}`;
  }
  return undefined;
}

