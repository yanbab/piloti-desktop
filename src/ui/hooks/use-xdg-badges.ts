import * as React from "react";
import {
  getXdgBadges,
  subscribeXdgBadges,
  getXdgProgress,
  subscribeXdgProgress,
  getXdgUrgent,
  subscribeXdgUrgent,
  type XdgBadgeEntry,
} from "@/core/xdg/xdg-badge-count";

export function useXdgAppBadgeCounts(): Record<string, XdgBadgeEntry> {
  return React.useSyncExternalStore(subscribeXdgBadges, getXdgBadges, getXdgBadges);
}

export function useXdgAppProgress(): Record<string, number | null> {
  return React.useSyncExternalStore(subscribeXdgProgress, getXdgProgress, getXdgProgress);
}

export function useXdgAppUrgent(): Record<string, boolean> {
  return React.useSyncExternalStore(subscribeXdgUrgent, getXdgUrgent, getXdgUrgent);
}
