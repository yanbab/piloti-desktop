/**
 * Link files: small text files that point to a web page, a file or a folder.
 *
 * Supported formats (all open the target on double-click):
 * - freedesktop `.desktop` with `Type=Link` and `URL=` (what "Make Link" creates)
 * - Windows `.url` (`[InternetShortcut]` / `URL=`)
 * - macOS `.webloc` (plist with a `<string>` URL)
 */

export interface LinkTarget {
  /** `http(s)://…`, `file:///…` or an absolute / `~/` path. */
  url: string;
  /** Display name from `Name=`, when present. */
  name?: string;
  icon?: string;
  format: "desktop" | "url" | "webloc";
}

function parseKeyValues(content: string): Record<string, Record<string, string>> {
  const groups: Record<string, Record<string, string>> = {};
  let group = "";
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const header = line.match(/^\[(.+)\]$/);
    if (header) {
      group = header[1] ?? "";
      groups[group] ??= {};
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    (groups[group] ??= {})[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return groups;
}

function isValidTarget(url: string): boolean {
  return /^(https?|ftp):\/\//i.test(url) || /^file:\/\//i.test(url) || url.startsWith("/") || url.startsWith("~/");
}

export function isLinkFileName(name: string): boolean {
  return /\.(url|webloc)$/i.test(name);
}

/** Parses a link file; null when `name` / `content` is not a link. */
export function parseLinkFile(name: string, content: string | undefined): LinkTarget | null {
  const lower = name.toLowerCase();
  const text = content ?? "";
  if (lower.endsWith(".webloc")) {
    const match = text.match(/<string>\s*([^<\s][^<]*?)\s*<\/string>/i);
    const url = match?.[1]?.trim();
    return url && isValidTarget(url) ? { url, format: "webloc" } : null;
  }
  if (lower.endsWith(".url")) {
    const groups = parseKeyValues(text);
    const section = groups["InternetShortcut"] ?? groups[""] ?? {};
    const url = section["URL"];
    return url && isValidTarget(url) ? { url, icon: section["IconFile"], format: "url" } : null;
  }
  if (lower.endsWith(".desktop")) {
    const entry = parseKeyValues(text)["Desktop Entry"];
    if (!entry || entry["Type"] !== "Link") return null;
    const url = entry["URL"];
    if (!url || !isValidTarget(url)) return null;
    return { url, name: entry["Name"], icon: entry["Icon"], format: "desktop" };
  }
  return null;
}

/** True when this file should be shown / opened as a link. */
export function isLinkFile(name: string, content: string | undefined): boolean {
  return parseLinkFile(name, content) !== null;
}

/** Converts a link `url` into an absolute path when it points at the local filesystem. */
export function linkTargetToPath(url: string, homeDir = "/home/user"): string | null {
  if (url.startsWith("~/")) return `${homeDir}${url.slice(1)}`;
  if (url.startsWith("/")) return url;
  if (/^file:\/\//i.test(url)) {
    try {
      return decodeURIComponent(new URL(url).pathname) || "/";
    } catch {
      return null;
    }
  }
  return null;
}

/** Builds the contents of a `.desktop` link file. */
export function buildLinkFile(options: { name: string; url: string; icon?: string }): string {
  const lines = [
    "[Desktop Entry]",
    "Type=Link",
    `Name=${options.name.replace(/[\r\n]+/g, " ")}`,
    `URL=${options.url.replace(/[\r\n]+/g, "")}`,
  ];
  if (options.icon) lines.push(`Icon=${options.icon}`);
  return `${lines.join("\n")}\n`;
}

/** `file:///` URL for an absolute path (each segment percent-encoded). */
export function pathToFileUrl(path: string): string {
  return `file://${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Suggested file name for a link to `targetPath` ("Report.pdf" → "Link to Report.pdf.desktop"). */
export function linkFileNameFor(targetName: string, prefix = "Link to"): string {
  return `${prefix} ${targetName}.desktop`;
}
