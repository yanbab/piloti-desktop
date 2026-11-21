import { WELCOME_HTML } from "./welcome-html";

export interface WebVfsEntry {
  id: string;
  name: string;
  kind: "directory" | "file";
  path: string;
  parentPath: string;
  content?: string;
  trashedFromPath?: string;
  metadata?: {
    "standard::content-type"?: string;
    "metadata::emblems"?: string[];
    "metadata::thumbnail"?: string;
    [key: string]: unknown;
  };
  updatedAt: number;
}

export const WEB_VFS_STORAGE_KEY = "piloti.web.vfs.v1";
export const WEB_VFS_CHANGED_EVENT = "piloti:web-vfs-changed";

export const WEB_VFS_HOME = "/home/user";
export const WEB_VFS_TRASH = "/home/user/.local/share/Trash/files";

export const DEFAULT_ETC_ISSUE = `Piloti Desktop Web VFS (localStorage)
Type 'help' for shell commands, 'piloti help' for desktop controls, or 'cat ~/Documents/Notes.txt'.
`;

export const DEFAULT_MIMEAPPS_INI = `[Default Applications]
inode/directory=nautilus.desktop
text/plain=text-editor.desktop
text/markdown=text-editor.desktop
text/html=browser.desktop
application/json=text-editor.desktop
image/png=image-viewer.desktop
image/jpeg=image-viewer.desktop
image/webp=image-viewer.desktop
image/gif=image-viewer.desktop
image/svg+xml=image-viewer.desktop

[Added Associations]
inode/directory=nautilus.desktop;terminal.desktop;
text/plain=text-editor.desktop;terminal.desktop;
text/markdown=text-editor.desktop;browser.desktop;
text/html=browser.desktop;text-editor.desktop;
text/*=text-editor.desktop;terminal.desktop;
application/json=text-editor.desktop;console.desktop;
image/*=image-viewer.desktop;browser.desktop;
`;

const DEFAULT_DIRS = [
  "/etc",
  "/home/user",
  "/home/user/Desktop",
  "/home/user/Documents",
  "/home/user/Downloads",
  "/home/user/Music",
  "/home/user/Pictures",
  "/home/user/Videos",
  "/home/user/.config",
  "/home/user/.config/piloti",
  "/home/user/.config/piloti/plugins",
  "/home/user/.config/Piloti",
  "/home/user/.config/domicile",
  "/home/user/.local",
  "/home/user/.local/share",
  "/home/user/.local/share/applications",
  "/home/user/.local/share/Trash",
  "/home/user/.local/state",
  "/home/user/.local/state/piloti",
  "/home/user/.cache",
  "/home/user/.cache/piloti",
  WEB_VFS_TRASH,
];

const DEFAULT_LOCAL_DESKTOP_FILES: Record<string, string> = {
  "piloti-files.desktop": `[Desktop Entry]
Type=Application
Name=Files
Comment=Browse local virtual files and folders
Exec=piloti-files %U
Icon=system-file-manager
Categories=System;FileManager;
MimeType=inode/directory;
`,
  "piloti-terminal.desktop": `[Desktop Entry]
Type=Application
Name=Web Terminal
Comment=Web shell with VFS commands
Exec=piloti-terminal
Icon=piloti-terminal
Categories=System;TerminalEmulator;Development;
`,
  "piloti-notepad.desktop": `[Desktop Entry]
Type=Application
Name=Notepad
Comment=Minimal plain-text notepad with instant VFS save
Exec=piloti-notepad %F
Icon=piloti-text-editor
Categories=Utility;TextEditor;
MimeType=text/plain;text/markdown;application/json;
`,
  "piloti-calculator.desktop": `[Desktop Entry]
Type=Application
Name=Calculator
Comment=Basic & Scientific Calculator
Exec=piloti-calculator
Icon=piloti-calculator
Categories=Utility;Calculator;
`,
  "piloti-image-viewer.desktop": `[Desktop Entry]
Type=Application
Name=Image Viewer
Comment=Fast image viewer and crop/rotate editor
Exec=piloti-image-viewer %F
Icon=piloti-image-viewer
Categories=Graphics;Viewer;
MimeType=image/png;image/jpeg;image/webp;image/gif;image/svg+xml;
`,
  "piloti-app-store.desktop": `[Desktop Entry]
Type=Application
Name=App Store
Comment=Browse and install apps and web apps
Exec=piloti-app-store
Icon=org.gnome.Software
Categories=System;PackageManager;
`,
  "piloti-devtools.desktop": `[Desktop Entry]
Type=Application
Name=DevTools
Comment=Shell DevTools, live logs, inspector, and JS console
Exec=piloti-devtools
Icon=org.gnome.DevTools
Categories=Development;Debugger;
`,
  "piloti-settings.desktop": `[Desktop Entry]
Type=Application
Name=Desktop Settings
Comment=Configure appearance, fonts, dock, and wallpaper
Exec=piloti-settings
Icon=piloti-settings
Categories=Settings;DesktopSettings;
`,
};

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
    },
    {
      id: "/etc/issue",
      name: "issue",
      kind: "file",
      path: "/etc/issue",
      parentPath: "/etc",
      content: DEFAULT_ETC_ISSUE,
      updatedAt: now,
    },
    {
      id: "/home/user/.config/mimeapps.list",
      name: "mimeapps.list",
      kind: "file",
      path: "/home/user/.config/mimeapps.list",
      parentPath: "/home/user/.config",
      content: DEFAULT_MIMEAPPS_INI,
      updatedAt: now,
    }
  );

  for (const [fileName, content] of Object.entries(DEFAULT_LOCAL_DESKTOP_FILES)) {
    const fullPath = `/home/user/.local/share/applications/${fileName}`;
    entries.push({
      id: fullPath,
      name: fileName,
      kind: "file",
      path: fullPath,
      parentPath: "/home/user/.local/share/applications",
      content,
      updatedAt: now,
    });
  }

  return entries;
}

let vfsCacheRaw: string | null = null;
let vfsCacheEntries: WebVfsEntry[] | null = null;
let vfsCacheByPath: Map<string, WebVfsEntry> | null = null;

function setVfsCache(entries: WebVfsEntry[], raw: string | null): WebVfsEntry[] {
  vfsCacheRaw = raw;
  vfsCacheEntries = entries;
  vfsCacheByPath = new Map(entries.map((entry) => [entry.path, entry]));
  return entries;
}

function loadVfs(): WebVfsEntry[] {
  if (typeof localStorage === "undefined") {
    return vfsCacheEntries ?? setVfsCache(createInitialVfs(), null);
  }
  try {
    const raw = localStorage.getItem(WEB_VFS_STORAGE_KEY);
    if (raw !== null && raw === vfsCacheRaw && vfsCacheEntries) {
      return vfsCacheEntries;
    }
    if (!raw) {
      const seeded = createInitialVfs();
      const json = JSON.stringify(seeded);
      localStorage.setItem(WEB_VFS_STORAGE_KEY, json);
      return setVfsCache(seeded, json);
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
      let addedDefaults = false;
      const now = Date.now();
      if (!entries.some((e) => e.path === "/etc/issue")) {
        if (!entries.some((e) => e.path === "/etc")) {
          entries.push({
            id: "/etc",
            name: "etc",
            kind: "directory",
            path: "/etc",
            parentPath: "/",
            updatedAt: now,
          });
        }
        entries.push({
          id: "/etc/issue",
          name: "issue",
          kind: "file",
          path: "/etc/issue",
          parentPath: "/etc",
          content: DEFAULT_ETC_ISSUE,
          updatedAt: now,
        });
        addedDefaults = true;
      }
      if (!entries.some((e) => e.path === "/home/user/.config/mimeapps.list")) {
        if (!entries.some((e) => e.path === "/home/user/.config")) {
          entries.push({
            id: "/home/user/.config",
            name: ".config",
            kind: "directory",
            path: "/home/user/.config",
            parentPath: "/home/user",
            updatedAt: now,
          });
        }
        entries.push({
          id: "/home/user/.config/mimeapps.list",
          name: "mimeapps.list",
          kind: "file",
          path: "/home/user/.config/mimeapps.list",
          parentPath: "/home/user/.config",
          content: DEFAULT_MIMEAPPS_INI,
          updatedAt: now,
        });
        addedDefaults = true;
      }
      for (const dirPath of DEFAULT_DIRS) {
        if (!entries.some((e) => e.path === dirPath)) {
          entries.push({
            id: dirPath,
            name: basename(dirPath),
            kind: "directory",
            path: dirPath,
            parentPath: dirname(dirPath),
            updatedAt: now,
          });
          addedDefaults = true;
        }
      }
      for (const [fileName, content] of Object.entries(DEFAULT_LOCAL_DESKTOP_FILES)) {
        const fullPath = `/home/user/.local/share/applications/${fileName}`;
        if (!entries.some((e) => e.path === fullPath)) {
          entries.push({
            id: fullPath,
            name: fileName,
            kind: "file",
            path: fullPath,
            parentPath: "/home/user/.local/share/applications",
            content,
            updatedAt: now,
          });
          addedDefaults = true;
        }
      }
      if (addedDefaults) {
        const json = JSON.stringify(entries);
        localStorage.setItem(WEB_VFS_STORAGE_KEY, json);
        return setVfsCache(entries, json);
      }
      return setVfsCache(entries, raw);
    }
  } catch {
    // ignore corrupted storage and re-seed
  }
  const seeded = createInitialVfs();
  let json: string | null = null;
  try {
    json = JSON.stringify(seeded);
    localStorage.setItem(WEB_VFS_STORAGE_KEY, json);
  } catch {
    // ignore quota errors
  }
  return setVfsCache(seeded, json);
}

type VfsBroadcastMessage =
  | { type: "vfs-changed" }
  | { type: "vfs-renamed"; oldPath: string; newPath: string };

let vfsBroadcastChannel: BroadcastChannel | null | undefined;
function getVfsBroadcastChannel(): BroadcastChannel | null {
  if (vfsBroadcastChannel !== undefined) return vfsBroadcastChannel;
  if (typeof BroadcastChannel === "undefined") {
    vfsBroadcastChannel = null;
    return null;
  }
  try {
    vfsBroadcastChannel = new BroadcastChannel("piloti-vfs");
  } catch {
    vfsBroadcastChannel = null;
  }
  return vfsBroadcastChannel;
}

function postVfsBroadcast(msg: VfsBroadcastMessage): void {
  try {
    getVfsBroadcastChannel()?.postMessage(msg);
  } catch {
    // ignore broadcast errors
  }
}

const inProcessVfsListeners = new Set<() => void>();

function saveVfs(entries: WebVfsEntry[]): void {
  let json: string | null = null;
  if (typeof localStorage !== "undefined") {
    try {
      json = JSON.stringify(entries);
      localStorage.setItem(WEB_VFS_STORAGE_KEY, json);
    } catch {
      // ignore quota errors
    }
  }
  setVfsCache(entries, json);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(WEB_VFS_CHANGED_EVENT));
  } else {
    for (const listener of inProcessVfsListeners) {
      listener();
    }
  }
  postVfsBroadcast({ type: "vfs-changed" });
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
    }
  }
  if (changed) saveVfs(entries);
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
    saveVfs(updated);
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
  if (typeof localStorage === "undefined") return {};
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
    const raw = localStorage.getItem(VFS_EMBLEMS_STORAGE_KEY);
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
    const legacyRaw = localStorage.getItem(WEB_VFS_FAVORITES_STORAGE_KEY);
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
        localStorage.setItem(WEB_VFS_STORAGE_KEY, JSON.stringify(nextEntries));
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
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("piloti:vfs-renamed", {
        detail: { oldPath, newPath },
      })
    );
  }
  postVfsBroadcast({ type: "vfs-renamed", oldPath, newPath });
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
  if (typeof window === "undefined") {
    inProcessVfsListeners.add(listener);
    return () => {
      inProcessVfsListeners.delete(listener);
    };
  }
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
  const channel = getVfsBroadcastChannel();
  const onMessage = (e: MessageEvent<VfsBroadcastMessage>) => {
    if (e.data?.type === "vfs-changed" || e.data?.type === "vfs-renamed") {
      listener();
    }
  };
  channel?.addEventListener("message", onMessage);
  return () => {
    window.removeEventListener(WEB_VFS_CHANGED_EVENT, listener);
    window.removeEventListener("storage", onStorage);
    channel?.removeEventListener("message", onMessage);
  };
}

export function subscribeVfsRenamed(
  listener: (detail: { oldPath: string; newPath: string }) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const onWindowRenamed = (e: Event) => {
    const detail = (
      e as CustomEvent<{ oldPath?: string; newPath?: string }>
    ).detail;
    if (detail?.oldPath && detail?.newPath) {
      listener({ oldPath: detail.oldPath, newPath: detail.newPath });
    }
  };
  const channel = getVfsBroadcastChannel();
  const onMessage = (e: MessageEvent<VfsBroadcastMessage>) => {
    if (e.data?.type === "vfs-renamed" && e.data.oldPath && e.data.newPath) {
      listener({ oldPath: e.data.oldPath, newPath: e.data.newPath });
    }
  };
  window.addEventListener("piloti:vfs-renamed", onWindowRenamed);
  channel?.addEventListener("message", onMessage);
  return () => {
    window.removeEventListener("piloti:vfs-renamed", onWindowRenamed);
    channel?.removeEventListener("message", onMessage);
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
  saveVfs(entries);
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

  saveVfs(entries);
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
 * Reads and deletes a legacy `localStorage` key during one-time migration into VFS.
 * Keeps `localStorage` encapsulated inside `web-vfs.ts`.
 */
export function consumeLegacyLocalStorageValue(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      localStorage.removeItem(key);
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
  if (typeof localStorage === "undefined") return [];
  const entries: WebVfsBackingStorageEntry[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    const value = localStorage.getItem(key) ?? "";
    const bytes = new Blob([value]).size;
    entries.push({ key, bytes, value });
  }
  entries.sort((a, b) => b.bytes - a.bytes || a.key.localeCompare(b.key));
  return entries;
}

/**
 * Resets all browser VFS backing storage keys and invalidates the in-memory VFS cache.
 */
export function clearAllWebVfsBackingStorage(): void {
  vfsCacheRaw = null;
  vfsCacheEntries = null;
  vfsCacheByPath = null;
  if (typeof localStorage === "undefined") return;
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("piloti.") || key.startsWith("vfs_")) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore storage errors
  }
}


