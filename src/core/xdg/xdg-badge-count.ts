import * as React from "react";

export interface XdgBadgeEntry {
  count: number;
  visible: boolean;
}

const badgeCounts = new Map<string, XdgBadgeEntry>();
const listeners = new Set<() => void>();
let snapshotCache: Record<string, XdgBadgeEntry> = {};

export const XDG_BADGE_CHANGED_EVENT = "piloti:xdg-badge-count";

function emitChange() {
  const next: Record<string, XdgBadgeEntry> = {};
  for (const [k, v] of badgeCounts.entries()) {
    if (v.visible && v.count > 0) {
      next[k] = v;
    }
  }
  snapshotCache = next;
  for (const listener of listeners) {
    listener();
  }
}

function normalizeBadgeAppId(appId: string): string {
  return appId
    .trim()
    .toLowerCase()
    .replace(/\.desktop$/i, "");
}

/**
 * Sets an XDG / Unity LauncherEntry-style badge count for an application ID.
 */
export function setXdgAppBadgeCount(
  appId: string,
  count: number,
  visible = count > 0
): void {
  const key = normalizeBadgeAppId(appId);
  if (!key) return;
  const normalizedCount = Math.max(0, Math.floor(count));
  const nextVisible = Boolean(visible && normalizedCount > 0);
  const prev = badgeCounts.get(key);
  if (prev && prev.count === normalizedCount && prev.visible === nextVisible) {
    return;
  }
  if (!nextVisible) {
    badgeCounts.delete(key);
  } else {
    badgeCounts.set(key, { count: normalizedCount, visible: true });
  }
  emitChange();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(XDG_BADGE_CHANGED_EVENT, {
        detail: { appId: key, count: normalizedCount, visible: nextVisible },
      })
    );
  }
}

export function getXdgAppBadgeCount(appId: string): number {
  const key = normalizeBadgeAppId(appId);
  const entry = badgeCounts.get(key);
  return entry && entry.visible ? entry.count : 0;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Record<string, XdgBadgeEntry> {
  return snapshotCache;
}

export function useXdgAppBadgeCounts(): Record<string, XdgBadgeEntry> {
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}


/* ---------- Progress (0..1 determinate, null indeterminate, undefined clear) ---------- */
const progressMap = new Map<string, number | null>();
const progressListeners = new Set<() => void>();
let progressSnapshot: Record<string, number | null> = {};

export function setXdgAppProgress(
  appId: string,
  progress: number | null | undefined
): void {
  const key = normalizeBadgeAppId(appId);
  if (!key) return;
  const prev = progressMap.get(key);
  const has = progressMap.has(key);
  if (progress === undefined) {
    if (!has) return;
    progressMap.delete(key);
  } else {
    const next = progress === null ? null : Math.min(1, Math.max(0, progress));
    if (has && prev === next) return;
    progressMap.set(key, next);
  }
  progressSnapshot = Object.fromEntries(progressMap.entries());
  for (const l of progressListeners) l();
}

export function useXdgAppProgress(): Record<string, number | null> {
  return React.useSyncExternalStore(
    (l) => {
      progressListeners.add(l);
      return () => {
        progressListeners.delete(l);
      };
    },
    () => progressSnapshot,
    () => progressSnapshot
  );
}

/* ---------- Urgent ---------- */
const urgentSet = new Set<string>();
const urgentListeners = new Set<() => void>();
let urgentSnapshot: Record<string, boolean> = {};

export function setXdgAppUrgent(appId: string, urgent: boolean): void {
  const key = normalizeBadgeAppId(appId);
  if (!key) return;
  if (urgent === urgentSet.has(key)) return;
  if (urgent) urgentSet.add(key);
  else urgentSet.delete(key);
  urgentSnapshot = Object.fromEntries([...urgentSet].map((k) => [k, true]));
  for (const l of urgentListeners) l();
}

export function useXdgAppUrgent(): Record<string, boolean> {
  return React.useSyncExternalStore(
    (l) => {
      urgentListeners.add(l);
      return () => {
        urgentListeners.delete(l);
      };
    },
    () => urgentSnapshot,
    () => urgentSnapshot
  );
}
