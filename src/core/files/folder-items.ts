import {
  type IconGridItem,
  inferFileVisual,
} from "@/core/files/desktop-icons";
import { getVfsContentType, getVfsImageThumbnailUrl } from "@/core/files/vfs-media";
import { parseDotHiddenFile } from "@/core/files/file-types";
import { type WebVfsEntry } from "@/core/files/vfs-paths";
import { parseDesktopEntry } from "@/core/xdg/xdg-desktop-entry";

/** Folder entries as icon grid items: shared by Folders and the desktop. */

export function isVfsEntryEmpty(entry: WebVfsEntry): boolean {
  if (entry.kind !== "file") return false;
  if (typeof entry.size === "number") return entry.size === 0;
  return !entry.content || entry.content.length === 0;
}

export function entryVisual(entry: WebVfsEntry) {
  return inferFileVisual(entry.name, entry.kind, getVfsContentType(entry), {
    isEmpty: isVfsEntryEmpty(entry),
  });
}

/** Names the folder's `.hidden` file lists. */
export function hiddenNamesOf(entries: readonly WebVfsEntry[]): Set<string> {
  return parseDotHiddenFile(entries.find((e) => e.name === ".hidden")?.content);
}

export function vfsEntryToGridItem(
  entry: WebVfsEntry,
  getAppIconUrl: (id?: string) => string | undefined,
  isHidden?: boolean
): IconGridItem {
  const visual = entryVisual(entry);
  return {
    id: entry.path,
    name: entry.name,
    kind: entry.kind,
    path: entry.path,
    iconName: visual.iconName,
    iconCandidates: visual.iconCandidates,
    isEmpty: isVfsEntryEmpty(entry),
    isHidden,
    isSymlink: entry.isSymlink,
    symlinkTarget: entry.symlinkTarget,
    accessCount: entry.kind === "file" ? (entry.accessCount ?? 0) : undefined,
    size: entry.kind === "file" ? (entry.size ?? entry.content?.length) : undefined,
    modifiedMs: entry.updatedAt || undefined,
    thumbnailUrl:
      entry.kind === "file"
        ? getVfsImageThumbnailUrl(entry.name, entry.content, entry.metadata)
        : undefined,
    iconUrl: visual.iconCandidates.map((c) => getAppIconUrl(c)).find(Boolean),
  };
}

export function isLauncherItem(item: IconGridItem): boolean {
  return item.kind === "file" && item.path.endsWith(".desktop");
}

/**
 * A `.desktop` file as the application launcher it describes. The id stays the
 * file's path, and `name` stays the file name's key in saved layouts.
 */
export function toLauncherItem(
  item: IconGridItem,
  content: string
): IconGridItem {
  const parsed = parseDesktopEntry(content, {
    filePath: item.path,
    baseDir: item.path.replace(/\/[^/]*$/, ""),
  });
  if (!parsed) return item;
  return {
    ...item,
    name: parsed.name,
    layoutKey: item.name,
    kind: "desktop-entry",
    iconName: "sparkles",
    iconCandidates: parsed.icon ? [parsed.icon] : undefined,
    iconUrl: undefined,
    desktopEntry: parsed,
  };
}

export type FolderSortBy = "manual" | "name" | "kind" | "modified" | "size";

/** A folder's entries as Folders lists them: folders first, then by the chosen column. */
export function folderEntriesToItems(
  entries: readonly WebVfsEntry[],
  options: {
    showHidden: boolean;
    query?: string;
    sortBy: FolderSortBy;
    sortDir: "asc" | "desc";
    getAppIconUrl: (id?: string) => string | undefined;
  },
): IconGridItem[] {
  const { showHidden, query, sortBy, sortDir, getAppIconUrl } = options;
  const hiddenNames = hiddenNamesOf(entries);
  const isHidden = (entry: WebVfsEntry) =>
    entry.name.startsWith(".") || hiddenNames.has(entry.name);
  const visible = showHidden ? entries : entries.filter((entry) => !isHidden(entry));
  const searched = query
    ? visible.filter((entry) => entry.name.toLowerCase().includes(query))
    : visible;
  const dirFactor = sortDir === "asc" ? 1 : -1;
  const sizeOf = (e: WebVfsEntry) => e.size ?? e.content?.length ?? 0;
  const extensionOf = (e: WebVfsEntry) =>
    e.kind === "directory" ? "" : (e.name.split(".").pop()?.toLowerCase() ?? "");
  return [...searched]
    .sort((a, b) => {
      const rankA = a.kind === "directory" ? 0 : 1;
      const rankB = b.kind === "directory" ? 0 : 1;
      if (rankA !== rankB) return rankA - rankB;
      const diff =
        sortBy === "modified"
          ? a.updatedAt - b.updatedAt
          : sortBy === "size"
            ? sizeOf(a) - sizeOf(b)
            : sortBy === "kind"
              ? extensionOf(a).localeCompare(extensionOf(b))
              : 0;
      if (diff !== 0) return diff * dirFactor;
      return (
        a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }) *
        dirFactor
      );
    })
    .map((entry) => vfsEntryToGridItem(entry, getAppIconUrl, isHidden(entry)));
}
