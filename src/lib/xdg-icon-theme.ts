/**
 * FreeDesktop.org XDG Icon Theme Specification (v0.13).
 * https://specifications.freedesktop.org/icon-theme-spec/latest/
 */

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
  if (
    lowerPath.includes("cursors") ||
    lowerPath.includes("animations") ||
    lowerPath.includes("emblems") ||
    lowerPath.includes("intl")
  ) {
    return false;
  }
  return (
    lowerPath.includes("apps") ||
    lowerPath.includes("places") ||
    lowerPath.includes("categories") ||
    lowerPath.includes("devices") ||
    lowerPath.includes("mimetypes") ||
    lowerPath.includes("status") ||
    lowerPath.includes("legacy") ||
    lowerCtx.includes("application") ||
    lowerCtx.includes("place") ||
    lowerCtx.includes("category") ||
    lowerCtx.includes("device")
  );
}

function iconExtensionPriority(filename: string): number {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".svg")) return 3;
  if (lower.endsWith(".png")) return 2;
  if (lower.endsWith(".xpm")) return 1;
  return 0;
}

function stripIconExtension(filename: string): string {
  return filename.replace(/\.(svg|png|xpm)$/i, "");
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

  const queue = [
    ...preferredThemes,
    "Adwaita",
    "Papirus",
    "breeze",
    "Yaru",
    "gnome",
    "hicolor",
  ];

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

    let descriptor: XdgIconThemeDescriptor | null = null;
    for (const baseDir of matchingBaseDirs) {
      const indexRes = await files.readText(`${baseDir}/${themeId}/index.theme`);
      const text = indexRes.match({ Ok: (t) => t, Err: () => undefined });
      if (text) {
        descriptor = parseIconThemeIndex(text, themeId);
        if (descriptor) break;
      }
    }

    descriptor ??= {
      id: themeId,
      name: themeId,
      inherits: themeId === "hicolor" ? [] : ["hicolor"],
      directories: [...DEFAULT_ICON_SUBDIRS],
    };

    themes.set(themeId, descriptor);
    themeOrder.push(themeId);

    for (const parent of descriptor.inherits) {
      if (!visitedThemes.has(parent)) {
        queue.unshift(parent);
      }
    }
  }

  const readTasks: Promise<void>[] = [];
  for (const themeId of themeOrder) {
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

      for (const baseDir of matchingBaseDirs) {
        const fullSubdirPath = `${baseDir}/${themeId}/${subdir.path}`;
        readTasks.push(
          files.readDir(fullSubdirPath).then((res) => {
            const entries = res.match({ Ok: (list) => list, Err: () => [] });
            for (const entry of entries) {
              if (entry.fileType === 1) continue;
              const prio = iconExtensionPriority(entry.name);
              if (prio === 0) continue;
              const baseName = stripIconExtension(entry.name);
              const existing = targetMap.get(baseName);
              if (!existing || prio > iconExtensionPriority(existing)) {
                targetMap.set(baseName, `${fullSubdirPath}/${entry.name}`);
              }
            }
          })
        );
      }
    }
  }

  await Promise.all(readTasks);
  return { themeOrder, themes, subdirFiles, fallbackFiles };
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

    const isSymbolic =
      subdir.path.includes("symbolic") || iconName.endsWith("-symbolic");
    if (directoryMatchesSize(subdir, size, scale)) {
      if (!isSymbolic) return found;
      bestSymbolicFallback ??= found;
    }

    const dist = directorySizeDistance(subdir, size, scale);
    const penalty = subdir.size < size && subdir.type !== "Scalable" ? 500 : 0;
    const totalDist = dist + penalty + (isSymbolic ? 1000 : 0);
    if (totalDist < closestDistance) {
      closestDistance = totalDist;
      closestPath = found;
    }
  }

  return closestPath ?? bestSymbolicFallback;
}

function lookupXdgIconPath(
  index: XdgIconThemeIndex,
  rawIconName: string | undefined,
  size = 64,
  scale = 1
): string | undefined {
  if (!rawIconName) return undefined;
  const trimmed = rawIconName.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("/")) return trimmed;

  const baseIcon = stripIconExtension(trimmed);
  const candidateNames: string[] = [baseIcon];
  if (baseIcon.toLowerCase() !== baseIcon) {
    candidateNames.push(baseIcon.toLowerCase());
  }
  if (baseIcon.includes(".")) {
    const lastSegment = baseIcon.split(".").pop()!;
    if (lastSegment) {
      candidateNames.push(
        lastSegment,
        `gnome-${lastSegment.toLowerCase()}`,
        lastSegment.toLowerCase()
      );
    }
  }

  for (const name of candidateNames) {
    for (const themeId of index.themeOrder) {
      const hit = lookupSingleIconInTheme(index, themeId, name, size, scale);
      if (hit && !hit.includes("/symbolic/") && !hit.endsWith("-symbolic.svg")) {
        return hit;
      }
    }
    const pixmapHit = index.fallbackFiles.get(name);
    if (pixmapHit) return pixmapHit;
  }

  for (const name of [...candidateNames, `${baseIcon}-symbolic`]) {
    for (const themeId of index.themeOrder) {
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
    const mime = lower.endsWith(".svg")
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

    if (lower.endsWith(".svg")) {
      const textRes = await files.readText(iconPath);
      const text = textRes.match({ Ok: (t) => t, Err: () => undefined });
      if (text) {
        return `data:image/svg+xml;base64,${bytesToBase64(
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
  const list =
    typeof iconNameOrCandidates === "string"
      ? [iconNameOrCandidates]
      : iconNameOrCandidates;

  for (const candidate of list) {
    const path = lookupXdgIconPath(index, candidate, size, scale);
    if (path) {
      const url = await loadXdgIconDataUrl(files, path);
      if (url) return url;
    }
  }
  return undefined;
}

export {
  buildXdgIconThemeIndex,
  directoryMatchesSize,
  directorySizeDistance,
  loadXdgIconDataUrl,
  lookupXdgIconPath,
  parseIconThemeIndex,
  resolveXdgIconUrl,
};
export type {
  XdgIconSubdirDescriptor,
  XdgIconThemeDescriptor,
  XdgIconThemeIndex,
  XdgIconThresholdType,
};

