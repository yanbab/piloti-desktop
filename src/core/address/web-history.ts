/**
 * Web Browser history: the pages visited, for the address bar's suggestions,
 * in `~/.config/piloti/browser/history.json` (most recent first, 500 at most).
 */
import { VFS_HOME } from "@/core/state/vfs-home";
import { canonicalizeWebUrl } from "@/core/data/web-apps";
import { readVfsStateJson, writeVfsStateJson } from "@/core/state/vfs-state";
import type { AddressSuggestion } from "@/core/address/types";

/** A bookmarked page, as the browser's bookmarks list keeps it. */
export interface WebBookmark {
  url: string;
  title: string;
  /** ms since epoch */
  added: number;
}

export interface BrowserHistoryEntry {
  url: string;
  title: string;
  visits: number;
  /** ms since epoch */
  last: number;
}

const PATH = `${VFS_HOME}/.config/piloti/browser/history.json`;
const MAX_ENTRIES = 500;

function isEntry(v: unknown): v is BrowserHistoryEntry {
  const e = v as BrowserHistoryEntry;
  return Boolean(e) && typeof e.url === "string" && typeof e.title === "string";
}

let cache: BrowserHistoryEntry[] | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

export function readBrowserHistory(): BrowserHistoryEntry[] {
  if (!cache) {
    const raw = readVfsStateJson<unknown>(PATH);
    cache = Array.isArray(raw) ? raw.filter(isEntry) : [];
  }
  return cache;
}

/** Same page, whatever the trailing slash or hash. */
export function pageKey(url: string): string {
  const canonical = canonicalizeWebUrl(url) ?? url;
  return canonical.replace(/#.*$/, "").replace(/\/$/, "");
}

function isRecordable(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** Pure: `history` with a visit of `url` (or a better title for it) on top. */
export function withVisit(
  history: readonly BrowserHistoryEntry[],
  url: string,
  title: string,
  now: number,
  countVisit = true
): BrowserHistoryEntry[] {
  const key = pageKey(url);
  const previous = history.find((e) => pageKey(e.url) === key);
  const rest = history.filter((e) => e !== previous);
  const entry: BrowserHistoryEntry = {
    url,
    title: title.trim() || previous?.title || "",
    visits: (previous?.visits ?? 0) + (countVisit || !previous ? 1 : 0),
    last: countVisit || !previous ? now : previous.last,
  };
  return [entry, ...rest].slice(0, MAX_ENTRIES);
}

/** Counts a visit to `url`; a title alone (`countVisit` false) names it. */
export function recordBrowserVisit(url: string, title = "", countVisit = true): void {
  if (!isRecordable(url)) return;
  cache = withVisit(readBrowserHistory(), url, title, Date.now(), countVisit);
  // Pages load in bursts (redirects, titles): one write a second at most.
  writeTimer ??= setTimeout(() => {
    writeTimer = null;
    if (cache) writeVfsStateJson(PATH, cache, false);
  }, 1000);
}

export function clearBrowserHistory(): void {
  cache = [];
  writeVfsStateJson(PATH, [], false);
}

/** `url` without its scheme, `www.` and trailing slash. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Pure: pages for what is typed, best first. A page whose host starts with
 * the text comes first, then one whose address or title holds every word;
 * bookmarks and pages visited often and lately rank higher.
 */
export function addressSuggestions(
  query: string,
  bookmarks: readonly WebBookmark[],
  history: readonly BrowserHistoryEntry[],
  now: number,
  limit = 6
): AddressSuggestion[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const pages = new Map<string, { url: string; title: string; bookmarked: boolean; visits: number; last: number }>();
  for (const e of history) {
    pages.set(pageKey(e.url), { url: e.url, title: e.title, bookmarked: false, visits: e.visits, last: e.last });
  }
  for (const b of bookmarks) {
    const key = pageKey(b.url);
    const seen = pages.get(key);
    pages.set(key, {
      url: b.url,
      title: b.title || seen?.title || "",
      bookmarked: true,
      visits: seen?.visits ?? 0,
      last: seen?.last ?? b.added,
    });
  }
  const scored: { page: { url: string; title: string; bookmarked: boolean }; score: number }[] = [];
  for (const p of pages.values()) {
    const bare = p.url.replace(/^https?:\/\/(www\.)?/i, "").toLowerCase();
    const haystack = `${bare} ${p.title.toLowerCase()}`;
    let score: number;
    if (words.length === 0) {
      if (!p.bookmarked) continue;
      score = 0;
    } else if (bare.startsWith(words.join(" ")) || hostOf(p.url).startsWith(words[0])) {
      score = 100;
    } else if (words.every((w) => haystack.includes(w))) {
      score = 40;
    } else {
      continue;
    }
    const days = Math.max(0, (now - p.last) / 86_400_000);
    score += (p.bookmarked ? 20 : 0) + Math.min(30, p.visits * 3) - Math.min(30, days);
    scored.push({ page: { url: p.url, title: p.title, bookmarked: p.bookmarked }, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ page }) => ({
    key: page.url,
    title: page.title || displayUrl(page.url),
    detail: displayUrl(page.url),
    icon: page.bookmarked ? "bookmark" : "history",
    target: { kind: "url", url: page.url },
  }));
}
