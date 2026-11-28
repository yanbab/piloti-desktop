/**
 * What text typed in an address bar means: a web address, a folder path or
 * free text (a web search in the browser, a filter in Folders, a query in the
 * Launcher). One reading for every app.
 */
import { looksLikeUrl } from "@/core/util/web-search";
import { normalizeWebUrl } from "@/core/windows/browser-url";

export type AddressInput =
  | { kind: "url"; url: string }
  | { kind: "path"; path: string }
  | { kind: "text"; text: string }
  | { kind: "empty" };

/** True for text that names a path: `/…`, `~`, `~/…` or `file://…`. */
export function looksLikePath(raw: string): boolean {
  const text = raw.trim();
  return /^(\/|~(\/|$)|file:\/\/)/i.test(text);
}

/**
 * The absolute path `raw` names: `~` is `home`, `file://` URLs are decoded,
 * `.` and `..` segments and repeated slashes are resolved. A trailing slash
 * is dropped (except for `/`). `null` if `raw` is not a path.
 */
export function expandPath(raw: string, home: string): string | null {
  let text = raw.trim();
  if (!looksLikePath(text)) return null;
  if (/^file:\/\//i.test(text)) {
    try {
      text = decodeURIComponent(new URL(text).pathname);
    } catch {
      return null;
    }
  } else if (text === "~" || text.startsWith("~/")) {
    text = home.replace(/\/+$/, "") + text.slice(1);
  }
  const parts: string[] = [];
  for (const part of text.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`;
}

/** `path` with `home` shown as `~` (for display and completions). */
export function tildePath(path: string, home: string): string {
  const h = home.replace(/\/+$/, "");
  if (path === h) return "~";
  return path.startsWith(`${h}/`) ? `~${path.slice(h.length)}` : path;
}

/** Reads typed text. A path wins over an address, so `file://` opens a folder. */
export function classifyAddressInput(raw: string, home: string): AddressInput {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  const path = expandPath(text, home);
  if (path !== null) return { kind: "path", path };
  if (looksLikeUrl(text)) {
    const url = normalizeWebUrl(text);
    if (url) return { kind: "url", url };
  }
  return { kind: "text", text };
}
