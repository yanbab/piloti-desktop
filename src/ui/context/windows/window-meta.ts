/** Updates to the records the shell keeps about listed windows. */
import type * as React from "react";
import type { ExternalWindowMeta } from "./types";

export function patchExternalMeta(
  setMeta: React.Dispatch<
    React.SetStateAction<Record<string, ExternalWindowMeta>>
  >,
  rawId: string,
  updater: (cur: ExternalWindowMeta) => ExternalWindowMeta
) {
  setMeta((prev) => {
    const cur = prev[rawId];
    if (!cur) return prev;
    return { ...prev, [rawId]: updater(cur) };
  });
}

export function upsertBrowserRecord(
  prev: Record<string, string>,
  browserWindowId: string,
  value: string
): Record<string, string> {
  if (!value) {
    if (!(browserWindowId in prev)) return prev;
    const next = { ...prev };
    delete next[browserWindowId];
    return next;
  }
  if (prev[browserWindowId] === value) return prev;
  return { ...prev, [browserWindowId]: value };
}

export function pruneBrowserRecord(
  prev: Record<string, string>,
  activeIds: Set<string>
): Record<string, string> {
  let changed = false;
  const next: Record<string, string> = {};
  for (const [id, val] of Object.entries(prev)) {
    if (activeIds.has(id)) next[id] = val;
    else changed = true;
  }
  return changed ? next : prev;
}
