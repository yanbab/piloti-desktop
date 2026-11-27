/**
 * Web Browser bookmarks: a flat list (no folders) in
 * `~/.config/piloti/browser/bookmarks.json`, newest last.
 */
import * as React from "react";
import { canonicalizeWebUrl } from "@/data/web-apps";
import {
  VFS_STATE_PATHS,
  readVfsStateJson,
  subscribeVfsPath,
  writeVfsStateJson,
} from "@/lib/engine/vfs-state";

export interface BrowserBookmark {
  url: string;
  title: string;
  /** ms since epoch */
  added: number;
}

const PATH = VFS_STATE_PATHS.browserBookmarks;

function isBookmark(v: unknown): v is BrowserBookmark {
  const b = v as BrowserBookmark;
  return Boolean(b) && typeof b.url === "string" && typeof b.title === "string";
}

export function readBrowserBookmarks(): BrowserBookmark[] {
  const raw = readVfsStateJson<unknown>(PATH);
  return Array.isArray(raw) ? raw.filter(isBookmark) : [];
}

/** Same page, whatever the trailing slash or hash. */
function bookmarkKey(url: string): string {
  const canonical = canonicalizeWebUrl(url) ?? url;
  return canonical.replace(/#.*$/, "").replace(/\/$/, "");
}

export function isBookmarked(bookmarks: readonly BrowserBookmark[], url: string): boolean {
  const key = bookmarkKey(url);
  return bookmarks.some((b) => bookmarkKey(b.url) === key);
}

/** Adds the page, or removes it when it is already bookmarked. */
export function toggleBrowserBookmark(url: string, title: string): boolean {
  if (!url) return false;
  const bookmarks = readBrowserBookmarks();
  const key = bookmarkKey(url);
  const kept = bookmarks.filter((b) => bookmarkKey(b.url) !== key);
  const adding = kept.length === bookmarks.length;
  writeVfsStateJson(
    PATH,
    adding ? [...kept, { url, title: title || url, added: Date.now() }] : kept
  );
  return adding;
}

let cache: BrowserBookmark[] | null = null;
const subscribe = (onChange: () => void) => {
  cache = null; // changes made while nobody listened
  return subscribeVfsPath(PATH, () => {
    cache = null;
    onChange();
  });
};
const getSnapshot = () => (cache ??= readBrowserBookmarks());

/** Live bookmarks (also follows edits of the file in Files / Texts). */
export function useBrowserBookmarks(): BrowserBookmark[] {
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
