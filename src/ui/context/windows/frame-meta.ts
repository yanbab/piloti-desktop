/**
 * Where every window stands, in one record keyed by window id (`shell:…`,
 * `browser:…`, `wayland:…`): a window's place belongs to its frame, not to
 * what it shows, so tabs of any kind can share it later.
 *
 * Code written for one kind of window still sees a record keyed by raw id
 * (`useScopedMeta`, `scopedSetter`).
 */
import * as React from "react";
import type { WindowPlacement } from "@/core/windows/types";
import type { DesktopWindowInstance, ExternalWindowMeta } from "./types";

export type FrameMeta = Record<string, ExternalWindowMeta>;
type Scoped = Record<string, ExternalWindowMeta>;

export const placementOf = (w: WindowPlacement): ExternalWindowMeta => ({
  position: w.position,
  size: w.size,
  minimized: w.minimized,
  maximized: w.maximized,
  fullscreen: w.fullscreen,
  pinned: w.pinned,
  tiled: w.tiled ?? null,
  zIndex: w.zIndex,
  workspace: w.workspace,
});

export function scopedMeta(all: FrameMeta, prefix: string): Scoped {
  const out: Scoped = {};
  for (const [id, meta] of Object.entries(all)) {
    if (id.startsWith(prefix)) out[id.slice(prefix.length)] = meta;
  }
  return out;
}

const sameEntries = (a: Scoped, b: Scoped): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
};

/** The records of one kind, raw ids, kept the same object while they don't change. */
export function useScopedMeta(all: FrameMeta, prefix: string): Scoped {
  const last = React.useRef<Scoped>({});
  return React.useMemo(() => {
    const next = scopedMeta(all, prefix);
    if (sameEntries(next, last.current)) return last.current;
    last.current = next;
    return next;
  }, [all, prefix]);
}

/** A setter for the records of one kind, raw ids, writing through to the whole. */
export function scopedSetter(
  set: React.Dispatch<React.SetStateAction<FrameMeta>>,
  prefix: string,
): React.Dispatch<React.SetStateAction<Scoped>> {
  return (action) =>
    set((prev) => {
      const sub = scopedMeta(prev, prefix);
      const next = typeof action === "function" ? action(sub) : action;
      if (next === sub) return prev;
      const out: FrameMeta = {};
      for (const [id, meta] of Object.entries(prev)) if (!id.startsWith(prefix)) out[id] = meta;
      for (const [id, meta] of Object.entries(next)) out[prefix + id] = meta;
      return out;
    });
}

/**
 * Shell windows' records: a new window starts where it opened, a closed one
 * goes (unless its frame still holds other views).
 */
export function syncShellMeta(
  prev: FrameMeta,
  shellWindows: readonly DesktopWindowInstance[],
  keep: (frameId: string) => boolean,
): FrameMeta {
  const open = new Set(shellWindows.map((w) => w.id));
  let next: FrameMeta | null = null;
  for (const id of Object.keys(prev)) {
    if (id.startsWith("shell:") && !open.has(id) && !keep(id)) {
      next ??= { ...prev };
      delete next[id];
    }
  }
  for (const w of shellWindows) {
    if (!prev[w.id]) {
      next ??= { ...prev };
      next[w.id] = placementOf(w);
    }
  }
  return next ?? prev;
}
