import { WELCOME_HTML } from "./welcome-html";

export interface WebVfsEntry {
  id: string;
  name: string;
  kind: "directory" | "file";
  path: string;
  parentPath: string;
  content?: string;
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
  if (!rawTarget || rawTarget.trim() === "~") return WEB_VFS_HOME;
  const target = rawTarget.trim();
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
  return entries.filter(
    (entry) =>
      entry.parentPath === normalized &&
      (includeHidden || !entry.name.startsWith("."))
  );
}

export function getVfsEntry(path: string): WebVfsEntry | undefined {
  const normalized = normalizeVfsPath(path);
  return loadVfs().find((entry) => entry.path === normalized);
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

  saveVfs(updated);
  return updated.find((e) => e.path === newPath) ?? null;
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

  saveVfs(updated);
}

export function emptyVfsTrash(): void {
  const entries = loadVfs();
  const trashPrefix = `${WEB_VFS_TRASH}/`;
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

  saveVfs(updated);
  return updated.find((e) => e.path === newPath) ?? null;
}

export function subscribeWebVfs(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === WEB_VFS_STORAGE_KEY) listener();
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

