/**
 * GTK bookmarks (`~/.config/gtk-3.0/bookmarks`), the sidebar bookmarks Nautilus
 * and every GTK file chooser share. One `file:///uri Optional label` per line.
 */

export interface GtkBookmark {
  /** Absolute path. */
  path: string;
  /** Custom label, when the user renamed it. */
  label?: string;
}

export const GTK_BOOKMARKS_RELATIVE_PATH = ".config/gtk-3.0/bookmarks";

function pathFromUri(uri: string): string | null {
  if (!uri.startsWith("file://")) return null;
  try {
    return decodeURIComponent(uri.slice("file://".length)).replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
}

function uriFromPath(path: string): string {
  return `file://${path
    .split("/")
    .map((seg) => encodeURIComponent(seg).replace(/%40/g, "@"))
    .join("/")}`;
}

export function parseGtkBookmarks(text: string): GtkBookmark[] {
  const out: GtkBookmark[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const space = line.indexOf(" ");
    const uri = space < 0 ? line : line.slice(0, space);
    const label = space < 0 ? "" : line.slice(space + 1).trim();
    const path = pathFromUri(uri);
    if (!path) continue;
    out.push(label ? { path, label } : { path });
  }
  return out;
}

export function serializeGtkBookmarks(bookmarks: readonly GtkBookmark[]): string {
  return bookmarks
    .map((b) => `${uriFromPath(b.path)}${b.label ? ` ${b.label}` : ""}`)
    .join("\n")
    .concat(bookmarks.length > 0 ? "\n" : "");
}

export function addGtkBookmark(list: readonly GtkBookmark[], path: string): GtkBookmark[] {
  return list.some((b) => b.path === path) ? [...list] : [...list, { path }];
}

export function removeGtkBookmark(list: readonly GtkBookmark[], path: string): GtkBookmark[] {
  return list.filter((b) => b.path !== path);
}
