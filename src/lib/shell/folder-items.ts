import {
  type IconGridItem,
  inferFileVisual,
} from "@/lib/shell/desktop-icons";
import { getVfsContentType } from "@/lib/core/vfs-media";
import { getVfsDirHiddenNames, getVfsEntry, parseDotHiddenFile } from "@/lib/engine-web/web-vfs";
import { type WebVfsEntry } from "@/lib/core/vfs-paths";
import { parseDesktopEntry } from "@/lib/xdg/xdg-desktop-entry";

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
export function hiddenNamesOf(entries: readonly WebVfsEntry[], dirPath: string): Set<string> {
  const dotHidden = entries.find((e) => e.name === ".hidden");
  return dotHidden ? parseDotHiddenFile(dotHidden.content) : getVfsDirHiddenNames(dirPath);
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
    gradient: visual.gradient,
    isEmpty: isVfsEntryEmpty(entry),
    isHidden,
    isSymlink: entry.isSymlink,
    symlinkTarget: entry.symlinkTarget,
    accessCount:
      entry.kind === "file"
        ? (entry.accessCount ?? getVfsEntry(entry.path)?.accessCount ?? 0)
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
