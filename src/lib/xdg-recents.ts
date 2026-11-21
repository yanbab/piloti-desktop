export interface XdgRecentItem {
  uri: string;
  path: string;
  mimeType: string;
  added: string;
  modified: string;
  visited: string;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function unescapeXml(value: string): string {
  return value
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

function uriToPosixPath(uri: string): string {
  if (!uri.startsWith("file://")) return uri;
  try {
    return decodeURIComponent(uri.slice("file://".length));
  } catch {
    return uri.slice("file://".length);
  }
}

export function posixPathToFileUri(path: string): string {
  if (path.startsWith("file://")) return path;
  const encoded = path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `file://${encoded.startsWith("/") ? encoded : `/${encoded}`}`;
}

/**
 * Parses a FreeDesktop `~/.local/share/recently-used.xbel` XML document.
 */
export function parseRecentlyUsedXbel(xml: string): XdgRecentItem[] {
  if (!xml || !xml.includes("<bookmark")) return [];
  const items: XdgRecentItem[] = [];
  const bookmarkRe = /<bookmark\b([^>]*)>([\s\S]*?)<\/bookmark>/gi;
  let match: RegExpExecArray | null;
  while ((match = bookmarkRe.exec(xml)) !== null) {
    const attrs = match[1] ?? "";
    const body = match[2] ?? "";
    const hrefMatch = /\bhref="([^"]+)"/i.exec(attrs);
    if (!hrefMatch) continue;
    const uri = unescapeXml(hrefMatch[1]);
    const added = /\badded="([^"]+)"/i.exec(attrs)?.[1] ?? "";
    const modified = /\bmodified="([^"]+)"/i.exec(attrs)?.[1] ?? "";
    const visited = /\bvisited="([^"]+)"/i.exec(attrs)?.[1] ?? modified ?? added;
    const mimeMatch = /<mime:mime-type\b[^>]*\btype="([^"]+)"/i.exec(body);
    items.push({
      uri,
      path: uriToPosixPath(uri),
      mimeType: mimeMatch ? unescapeXml(mimeMatch[1]) : "application/octet-stream",
      added,
      modified,
      visited,
    });
  }
  return items.sort((a, b) =>
    (b.visited || b.modified || b.added).localeCompare(
      a.visited || a.modified || a.added
    )
  );
}

/**
 * Serializes recent entries to standard FreeDesktop XBEL XML.
 */
export function serializeRecentlyUsedXbel(items: readonly XdgRecentItem[]): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<xbel version="1.0"',
    '      xmlns:bookmark="http://www.freedesktop.org/standards/desktop-bookmarks"',
    '      xmlns:mime="http://www.freedesktop.org/standards/shared-mime-info"',
    ">",
  ];
  for (const item of items) {
    const added = item.added || new Date().toISOString();
    const modified = item.modified || added;
    const visited = item.visited || modified;
    lines.push(
      `  <bookmark href="${escapeXml(item.uri)}" added="${escapeXml(added)}" modified="${escapeXml(modified)}" visited="${escapeXml(visited)}">`
    );
    lines.push("    <info>");
    lines.push('      <metadata owner="http://freedesktop.org">');
    lines.push(`        <mime:mime-type type="${escapeXml(item.mimeType)}"/>`);
    lines.push("      </metadata>");
    lines.push("    </info>");
    lines.push("  </bookmark>");
  }
  lines.push("</xbel>");
  return `${lines.join("\n")}\n`;
}

/**
 * Upserts a file into an XBEL recent-files list (capped at `limit`).
 */
export function upsertRecentXbelItem(
  existing: readonly XdgRecentItem[],
  path: string,
  mimeType: string,
  limit = 50
): XdgRecentItem[] {
  const now = new Date().toISOString();
  const uri = posixPathToFileUri(path);
  const prev = existing.find((item) => item.uri === uri || item.path === path);
  const nextItem: XdgRecentItem = {
    uri,
    path,
    mimeType,
    added: prev?.added || now,
    modified: now,
    visited: now,
  };
  return [
    nextItem,
    ...existing.filter((item) => item.uri !== uri && item.path !== path),
  ].slice(0, limit);
}

