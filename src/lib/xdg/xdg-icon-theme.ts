/**
 * FreeDesktop.org XDG Icon Theme Specification (v0.13).
 * https://specifications.freedesktop.org/icon-theme-spec/latest/
 */

import {
  readVfsStateText,
  VFS_STATE_PATHS,
  writeVfsStateText,
} from "../vfs-state";
import {
  XDG_ICON_BASE_DIRS,
  XDG_PIXMAPS_DIRS,
  type XdgFileReader,
} from "./xdg-basedir";

type XdgIconThresholdType = "Fixed" | "Scalable" | "Threshold";

interface XdgIconSubdirDescriptor {
  path: string;
  size: number;
  scale: number;
  context?: string;
  type: XdgIconThresholdType;
  maxSize: number;
  minSize: number;
  threshold: number;
}

interface XdgIconThemeDescriptor {
  id: string;
  name: string;
  inherits: string[];
  directories: XdgIconSubdirDescriptor[];
}

interface XdgIconThemeIndex {
  themeOrder: string[];
  themes: Map<string, XdgIconThemeDescriptor>;
  subdirFiles: Map<string, Map<string, string>>;
  fallbackFiles: Map<string, string>;
}

const DEFAULT_ICON_SUBDIRS: readonly XdgIconSubdirDescriptor[] = [
  ...(["Applications", "Places", "MimeTypes", "Status"] as const).map(
    (context): XdgIconSubdirDescriptor => ({
      path: `animated/${context.toLowerCase()}`,
      size: 64,
      scale: 1,
      context,
      type: "Scalable",
      minSize: 16,
      maxSize: 512,
      threshold: 2,
    })
  ),
  {
    path: "scalable/apps",
    size: 128,
    scale: 1,
    context: "Applications",
    type: "Scalable",
    minSize: 16,
    maxSize: 512,
    threshold: 2,
  },
  ...[128, 96, 64, 48, 32, 24, 16].map((size): XdgIconSubdirDescriptor => ({
    path: `${size}x${size}/apps`,
    size,
    scale: 1,
    context: "Applications",
    type: "Threshold",
    minSize: size,
    maxSize: size,
    threshold: 2,
  })),
  ...(["Places", "Categories", "Devices", "MimeTypes"] as const).map(
    (context): XdgIconSubdirDescriptor => ({
      path: `scalable/${context.toLowerCase()}`,
      size: 128,
      scale: 1,
      context,
      type: "Scalable",
      minSize: 16,
      maxSize: 512,
      threshold: 2,
    })
  ),
  {
    path: "symbolic/apps",
    size: 16,
    scale: 1,
    context: "Applications",
    type: "Scalable",
    minSize: 8,
    maxSize: 512,
    threshold: 2,
  },
  {
    path: "symbolic/actions",
    size: 16,
    scale: 1,
    context: "Actions",
    type: "Scalable",
    minSize: 8,
    maxSize: 512,
    threshold: 2,
  },
];

function parseIniGroups(content: string): Record<string, Record<string, string>> {
  const groups: Record<string, Record<string, string>> = {};
  let current: string | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("[") && line.endsWith("]")) {
      current = line.slice(1, -1).trim();
      groups[current] ??= {};
      continue;
    }

    if (!current) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;

    groups[current][line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
  }
  return groups;
}

function splitThemeList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseIconThemeIndex(
  content: string,
  themeId: string
): XdgIconThemeDescriptor | null {
  const groups = parseIniGroups(content);
  const header = groups["Icon Theme"];
  if (!header) return null;

  const name = header["Name"] ?? themeId;
  const inherits = splitThemeList(header["Inherits"]);
  if (themeId !== "hicolor" && !inherits.includes("hicolor")) {
    inherits.push("hicolor");
  }

  const dirNames = [
    ...splitThemeList(header["Directories"]),
    ...splitThemeList(header["ScaledDirectories"]),
  ];

  const directories: XdgIconSubdirDescriptor[] = [];
  const seenPaths = new Set<string>();

  for (const dirPath of dirNames) {
    if (seenPaths.has(dirPath)) continue;
    const sec = groups[dirPath];
    if (!sec) continue;
    const size = Number.parseInt(sec["Size"] ?? "", 10);
    if (!Number.isFinite(size) || size <= 0) continue;

    const scale = Number.parseInt(sec["Scale"] ?? "1", 10) || 1;
    const rawType = (sec["Type"] ?? "Threshold").trim();
    const type: XdgIconThresholdType =
      rawType === "Fixed" || rawType === "Scalable" || rawType === "Threshold"
        ? rawType
        : "Threshold";

    seenPaths.add(dirPath);
    directories.push({
      path: dirPath,
      size,
      scale,
      context: sec["Context"],
      type,
      maxSize: Number.parseInt(sec["MaxSize"] ?? String(size), 10) || size,
      minSize: Number.parseInt(sec["MinSize"] ?? String(size), 10) || size,
      threshold: Number.parseInt(sec["Threshold"] ?? "2", 10) || 2,
    });
  }

  for (const fallback of DEFAULT_ICON_SUBDIRS) {
    if (!seenPaths.has(fallback.path)) {
      seenPaths.add(fallback.path);
      directories.push(fallback);
    }
  }

  return { id: themeId, name, inherits, directories };
}

function directoryMatchesSize(
  subdir: XdgIconSubdirDescriptor,
  iconSize: number,
  iconScale = 1
): boolean {
  if (subdir.scale !== iconScale) return false;
  if (subdir.type === "Fixed") return subdir.size === iconSize;
  if (subdir.type === "Scalable") {
    return subdir.minSize <= iconSize && iconSize <= subdir.maxSize;
  }
  return (
    subdir.size - subdir.threshold <= iconSize &&
    iconSize <= subdir.size + subdir.threshold
  );
}

function directorySizeDistance(
  subdir: XdgIconSubdirDescriptor,
  iconSize: number,
  iconScale = 1
): number {
  const targetScaled = iconSize * iconScale;
  const dirScaled = subdir.size * subdir.scale;

  if (subdir.type === "Fixed") {
    return Math.abs(dirScaled - targetScaled);
  }
  if (subdir.type === "Scalable") {
    if (targetScaled < subdir.minSize * subdir.scale) {
      return subdir.minSize * subdir.scale - targetScaled;
    }
    if (targetScaled > subdir.maxSize * subdir.scale) {
      return targetScaled - subdir.maxSize * subdir.scale;
    }
    return 0;
  }
  const minBound = (subdir.size - subdir.threshold) * subdir.scale;
  const maxBound = (subdir.size + subdir.threshold) * subdir.scale;
  if (targetScaled < minBound) return minBound - targetScaled;
  if (targetScaled > maxBound) return targetScaled - maxBound;
  return 0;
}

function isRelevantIconSubdir(subdir: XdgIconSubdirDescriptor): boolean {
  const lowerPath = subdir.path.toLowerCase();
  const lowerCtx = (subdir.context ?? "").toLowerCase();
  const isSymbolic = lowerPath.includes("symbolic");
  if (lowerPath.startsWith("animated/")) {
    return (
      !lowerPath.includes("cursors") &&
      !lowerPath.includes("emblems") &&
      !lowerPath.includes("intl") &&
      !lowerPath.includes("panel")
    );
  }
  if (
    lowerPath.includes("cursors") ||
    lowerPath.includes("animations") ||
    lowerPath.includes("emblems") ||
    lowerPath.includes("intl") ||
    (!isSymbolic && lowerPath.includes("actions")) ||
    lowerPath.includes("mimetypes") ||
    lowerPath.includes("status") ||
    lowerPath.includes("panel")
  ) {
    return false;
  }

  if (isSymbolic) {
    return (
      lowerPath.includes("places") ||
      lowerPath.includes("apps") ||
      lowerPath.includes("actions")
    );
  }

  // Skip small bitmap sizes (< 32px) so shell/dock icons only scan crisp assets.
  if (subdir.type !== "Scalable" && subdir.size < 32) {
    return false;
  }

  if (lowerPath.includes("legacy")) {
    return subdir.type === "Scalable" || subdir.size >= 48;
  }

  return (
    lowerPath.includes("apps") ||
    lowerPath.includes("places") ||
    lowerPath.includes("categories") ||
    lowerPath.includes("devices") ||
    lowerCtx.includes("application") ||
    lowerCtx.includes("place") ||
    lowerCtx.includes("category") ||
    lowerCtx.includes("device")
  );
}

function iconExtensionPriority(filename: string, allowAnimated = false): number {
  const lower = filename.toLowerCase();
  if (allowAnimated && lower.endsWith(".lottie")) return 5;
  if (allowAnimated && lower.endsWith(".json")) return 4;
  if (lower.endsWith(".svg")) return 3;
  if (lower.endsWith(".png")) return 2;
  if (lower.endsWith(".xpm")) return 1;
  return 0;
}

function stripIconExtension(filename: string): string {
  return filename.replace(/\.(lottie|json|svg|png|xpm)$/i, "");
}

async function buildXdgIconThemeIndex(
  files: XdgFileReader,
  preferredThemes: string[] = ["Adwaita", "hicolor"]
): Promise<XdgIconThemeIndex> {
  const themes = new Map<string, XdgIconThemeDescriptor>();
  const subdirFiles = new Map<string, Map<string, string>>();
  const fallbackFiles = new Map<string, string>();
  const themeOrder: string[] = [];
  const visitedThemes = new Set<string>();

  const baseDirEntries = new Map<string, Set<string>>();
  await Promise.all(
    XDG_ICON_BASE_DIRS.map(async (baseDir) => {
      const res = await files.readDir(baseDir);
      const list = res.match({ Ok: (entries) => entries, Err: () => [] });
      if (list.length === 0) return;

      const names = new Set<string>();
      for (const entry of list) {
        if (entry.fileType === 1 || entry.fileType === 2) {
          names.add(entry.name);
        } else if (iconExtensionPriority(entry.name) > 0) {
          const baseName = stripIconExtension(entry.name);
          if (!fallbackFiles.has(baseName)) {
            fallbackFiles.set(baseName, `${baseDir}/${entry.name}`);
          }
        }
      }
      baseDirEntries.set(baseDir, names);
    })
  );

  await Promise.all(
    XDG_PIXMAPS_DIRS.map(async (pixDir) => {
      const res = await files.readDir(pixDir);
      const list = res.match({ Ok: (entries) => entries, Err: () => [] });
      for (const entry of list) {
        if (entry.fileType === 1) continue;
        const prio = iconExtensionPriority(entry.name);
        if (prio === 0) continue;
        const baseName = stripIconExtension(entry.name);
        const existing = fallbackFiles.get(baseName);
        if (!existing || prio > iconExtensionPriority(existing)) {
          fallbackFiles.set(baseName, `${pixDir}/${entry.name}`);
        }
      }
    })
  );

  const queue = [...preferredThemes, "Adwaita", "hicolor"];

  while (queue.length > 0) {
    const themeId = queue.shift()!;
    if (!themeId || visitedThemes.has(themeId)) continue;
    visitedThemes.add(themeId);

    const matchingBaseDirs = XDG_ICON_BASE_DIRS.filter((bd) =>
      baseDirEntries.get(bd)?.has(themeId)
    );
    if (
      matchingBaseDirs.length === 0 &&
      themeId !== "hicolor" &&
      themeId !== "Adwaita"
    ) {
      continue;
    }

    const indexTexts = await Promise.all(
      matchingBaseDirs.map(async (baseDir) => {
        const indexRes = await files.readText(`${baseDir}/${themeId}/index.theme`);
        return indexRes.match({ Ok: (t) => t, Err: () => undefined });
      })
    );
    let descriptor: XdgIconThemeDescriptor | null = null;
    for (const text of indexTexts) {
      if (!text) continue;
      descriptor = parseIconThemeIndex(text, themeId);
      if (descriptor) break;
    }

    descriptor ??= {
      id: themeId,
      name: themeId,
      inherits: themeId === "hicolor" ? [] : ["hicolor"],
      directories: [...DEFAULT_ICON_SUBDIRS],
    };

    themes.set(themeId, descriptor);
    themeOrder.push(themeId);

    const pendingParents = descriptor.inherits.filter(
      (parent) => !visitedThemes.has(parent)
    );
    if (pendingParents.length > 0) {
      queue.unshift(...pendingParents);
    }
  }

  // Per XDG Icon Theme Spec, `hicolor` is always the final fallback theme.
  const orderedThemeOrder = [
    ...themeOrder.filter((id) => id !== "hicolor"),
    ...themeOrder.filter((id) => id === "hicolor"),
  ];

  const readTasks: Promise<void>[] = [];
  for (const themeId of orderedThemeOrder) {
    const descriptor = themes.get(themeId);
    if (!descriptor) continue;
    const matchingBaseDirs = XDG_ICON_BASE_DIRS.filter((bd) =>
      baseDirEntries.get(bd)?.has(themeId)
    );
    if (matchingBaseDirs.length === 0) continue;

    for (const subdir of descriptor.directories.filter(isRelevantIconSubdir)) {
      const mapKey = `${themeId}::${subdir.path}`;
      let targetMap = subdirFiles.get(mapKey);
      if (!targetMap) {
        targetMap = new Map<string, string>();
        subdirFiles.set(mapKey, targetMap);
      }

      const allowAnimated = subdir.path.toLowerCase().startsWith("animated/");
      for (const baseDir of matchingBaseDirs) {
        const fullSubdirPath = `${baseDir}/${themeId}/${subdir.path}`;
        readTasks.push(
          files.readDir(fullSubdirPath).then((res) => {
            const entries = res.match({ Ok: (list) => list, Err: () => [] });
            for (const entry of entries) {
              if (entry.fileType === 1) continue;
              const prio = iconExtensionPriority(entry.name, allowAnimated);
              if (prio === 0) continue;
              const baseName = stripIconExtension(entry.name);
              const existing = targetMap.get(baseName);
              if (
                !existing ||
                prio > iconExtensionPriority(existing, allowAnimated)
              ) {
                targetMap.set(baseName, `${fullSubdirPath}/${entry.name}`);
              }
            }
          })
        );
      }
    }
  }

  await Promise.all(readTasks);
  return {
    themeOrder: orderedThemeOrder,
    themes,
    subdirFiles,
    fallbackFiles,
  };
}

function lookupSingleIconInTheme(
  index: XdgIconThemeIndex,
  themeId: string,
  iconName: string,
  size: number,
  scale: number
): string | undefined {
  const theme = index.themes.get(themeId);
  if (!theme) return undefined;

  let bestSymbolicFallback: string | undefined;
  let closestPath: string | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const subdir of theme.directories) {
    const filesInSubdir = index.subdirFiles.get(`${themeId}::${subdir.path}`);
    if (!filesInSubdir || filesInSubdir.size === 0) continue;

    const found = filesInSubdir.get(iconName);
    if (!found) continue;

    const isAnimated = subdir.path.toLowerCase().startsWith("animated/");
    const isSymbolic =
      subdir.path.includes("symbolic") || iconName.endsWith("-symbolic");
    if (directoryMatchesSize(subdir, size, scale)) {
      if (isAnimated) return found;
      if (!isSymbolic) {
        closestPath ??= found;
      } else {
        bestSymbolicFallback ??= found;
      }
    }

    const dist = directorySizeDistance(subdir, size, scale);
    const penalty = subdir.size < size && subdir.type !== "Scalable" ? 500 : 0;
    const totalDist =
      dist + penalty + (isSymbolic ? 1000 : isAnimated ? -100 : 0);
    if (totalDist < closestDistance) {
      closestDistance = totalDist;
      closestPath = found;
    }
  }

  return closestPath ?? bestSymbolicFallback;
}

function expandIconCandidateNames(
  rawCandidates: string | readonly string[] | undefined
): string[] {
  if (!rawCandidates) return [];
  const rawList =
    typeof rawCandidates === "string" ? [rawCandidates] : rawCandidates;
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (name: string) => {
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  };

  for (const raw of rawList) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const baseIcon = stripIconExtension(trimmed);
    push(baseIcon);
    if (baseIcon.toLowerCase() !== baseIcon) {
      push(baseIcon.toLowerCase());
    }
    if (baseIcon.includes(".")) {
      const lastSegment = baseIcon.split(".").pop()!;
      if (lastSegment) {
        push(lastSegment);
        push(`gnome-${lastSegment.toLowerCase()}`);
        push(lastSegment.toLowerCase());
      }
    }
    if (
      baseIcon.toLowerCase() === "org.gnome.nautilus" ||
      baseIcon.toLowerCase() === "nautilus"
    ) {
      push("system-file-manager");
      push("folder");
    }
  }
  return out;
}

function lookupXdgIconPath(
  index: XdgIconThemeIndex,
  rawIconNameOrCandidates: string | readonly string[] | undefined,
  size = 64,
  scale = 1
): string | undefined {
  if (!rawIconNameOrCandidates) return undefined;
  const rawList =
    typeof rawIconNameOrCandidates === "string"
      ? [rawIconNameOrCandidates]
      : rawIconNameOrCandidates;

  for (const raw of rawList) {
    const trimmed = raw.trim();
    if (trimmed.startsWith("/")) return trimmed;
  }

  const candidateNames = expandIconCandidateNames(rawList);
  if (candidateNames.length === 0) return undefined;

  // Per XDG Icon Theme Spec, search every candidate name within each theme
  // before falling back to inherited themes, `hicolor`, or pixmaps.
  for (const themeId of index.themeOrder) {
    for (const name of candidateNames) {
      const hit = lookupSingleIconInTheme(index, themeId, name, size, scale);
      if (hit && !hit.includes("/symbolic/") && !hit.endsWith("-symbolic.svg")) {
        return hit;
      }
    }
  }

  for (const name of candidateNames) {
    const pixmapHit = index.fallbackFiles.get(name);
    if (pixmapHit) return pixmapHit;
  }

  const symbolicCandidates = [
    ...candidateNames,
    ...candidateNames.map((n) => `${n}-symbolic`),
  ];
  for (const themeId of index.themeOrder) {
    for (const name of symbolicCandidates) {
      const hit = lookupSingleIconInTheme(index, themeId, name, size, scale);
      if (hit) return hit;
    }
  }

  return undefined;
}

const iconDataUrlCache = new Map<string, Promise<string | undefined>>();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function loadXdgIconDataUrl(
  files: XdgFileReader,
  iconPath: string
): Promise<string | undefined> {
  const cached = iconDataUrlCache.get(iconPath);
  if (cached) return cached;

  const promise = (async (): Promise<string | undefined> => {
    const lower = iconPath.toLowerCase();
    const mime = lower.endsWith(".json")
      ? "application/json"
      : lower.endsWith(".svg")
        ? "image/svg+xml"
        : lower.endsWith(".png")
          ? "image/png"
          : undefined;
    if (!mime) return undefined;

    if (files.read) {
      const res = await files.read(iconPath);
      const bytes = res.match({ Ok: (b) => b, Err: () => undefined });
      if (bytes && bytes.length > 0) {
        return `data:${mime};base64,${bytesToBase64(bytes)}`;
      }
    }

    if (lower.endsWith(".svg") || lower.endsWith(".json")) {
      const textRes = await files.readText(iconPath);
      const text = textRes.match({ Ok: (t) => t, Err: () => undefined });
      if (text) {
        return `data:${mime};base64,${bytesToBase64(
          new TextEncoder().encode(text)
        )}`;
      }
    }

    return undefined;
  })();

  iconDataUrlCache.set(iconPath, promise);
  return promise;
}

async function resolveXdgIconUrl(
  files: XdgFileReader,
  index: XdgIconThemeIndex,
  iconNameOrCandidates: string | readonly string[] | undefined,
  size = 64,
  scale = 1
): Promise<string | undefined> {
  if (!iconNameOrCandidates) return undefined;
  const path = lookupXdgIconPath(index, iconNameOrCandidates, size, scale);
  if (!path) return undefined;
  return loadXdgIconDataUrl(files, path);
}

const ICON_INDEX_CACHE_KEY = "piloti.xdg-icon-index.v3";

interface SerializedIconThemeIndex {
  key: string;
  themeOrder: string[];
  themes: [string, XdgIconThemeDescriptor][];
  subdirFiles: [string, [string, string][]][];
  fallbackFiles: [string, string][];
}

function serializeXdgIconThemeIndex(
  key: string,
  index: XdgIconThemeIndex
): string {
  const payload: SerializedIconThemeIndex = {
    key,
    themeOrder: index.themeOrder,
    themes: Array.from(index.themes.entries()),
    subdirFiles: Array.from(index.subdirFiles.entries()).map(([k, map]) => [
      k,
      Array.from(map.entries()),
    ]),
    fallbackFiles: Array.from(index.fallbackFiles.entries()),
  };
  return JSON.stringify(payload);
}

function deserializeXdgIconThemeIndex(
  key: string,
  raw: string
): XdgIconThemeIndex | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SerializedIconThemeIndex>;
    if (
      parsed.key !== key ||
      !Array.isArray(parsed.themeOrder) ||
      !Array.isArray(parsed.themes) ||
      !Array.isArray(parsed.subdirFiles) ||
      !Array.isArray(parsed.fallbackFiles)
    ) {
      return null;
    }
    return {
      themeOrder: parsed.themeOrder,
      themes: new Map(parsed.themes),
      subdirFiles: new Map(
        parsed.subdirFiles.map(([k, entries]) => [k, new Map(entries)])
      ),
      fallbackFiles: new Map(parsed.fallbackFiles),
    };
  } catch {
    return null;
  }
}

function loadCachedXdgIconThemeIndex(
  preferredThemes: readonly string[]
): XdgIconThemeIndex | null {
  try {
    const raw = readVfsStateText(
      VFS_STATE_PATHS.iconIndexCache,
      ICON_INDEX_CACHE_KEY,
    );
    if (!raw) return null;
    return deserializeXdgIconThemeIndex(preferredThemes.join("|"), raw);
  } catch {
    return null;
  }
}

function saveCachedXdgIconThemeIndex(
  preferredThemes: readonly string[],
  index: XdgIconThemeIndex
): void {
  try {
    writeVfsStateText(
      VFS_STATE_PATHS.iconIndexCache,
      serializeXdgIconThemeIndex(preferredThemes.join("|"), index),
    );
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Scans `XDG_ICON_BASE_DIRS` for installed icon themes that contain an
 * `index.theme` file (excluding internal fallbacks `default`, `hicolor`, `locolor`).
 */
async function discoverInstalledIconThemes(
  files: XdgFileReader
): Promise<string[]> {
  const discovered = new Set<string>(["Adwaita"]);
  const SKIP = new Set(["default", "hicolor", "locolor"]);

  await Promise.all(
    XDG_ICON_BASE_DIRS.map(async (baseDir) => {
      const res = await files.readDir(baseDir);
      const entries = res.match({ Ok: (list) => list, Err: () => [] });
      await Promise.all(
        entries
          .filter(
            (e) =>
              (e.fileType === 1 || e.fileType === 2) &&
              !e.name.startsWith(".") &&
              !SKIP.has(e.name)
          )
          .map(async (entry) => {
            const idxRes = await files.readText(
              `${baseDir}/${entry.name}/index.theme`
            );
            const hasIndex = idxRes.match({
              Ok: (txt) => txt.trim().length > 0,
              Err: () => false,
            });
            if (hasIndex) discovered.add(entry.name);
          })
      );
    })
  );

  return Array.from(discovered).sort((a, b) => a.localeCompare(b));
}

export {
  buildXdgIconThemeIndex,
  deserializeXdgIconThemeIndex,
  directoryMatchesSize,
  directorySizeDistance,
  discoverInstalledIconThemes,
  loadCachedXdgIconThemeIndex,
  loadXdgIconDataUrl,
  lookupXdgIconPath,
  parseIconThemeIndex,
  resolveXdgIconUrl,
  saveCachedXdgIconThemeIndex,
  serializeXdgIconThemeIndex,
};
export type {
  XdgIconSubdirDescriptor,
  XdgIconThemeDescriptor,
  XdgIconThemeIndex,
  XdgIconThresholdType,
};

