/**
 * Back and Forward for a view that moves between locations (a folder, a
 * page): a list of visited entries and the current one. Pure: every change
 * returns a new history.
 */

export interface NavEntry {
  /** The folder path or page address. */
  location: string;
  title: string;
}

export interface NavHistory {
  entries: readonly NavEntry[];
  /** The current entry. */
  index: number;
}

/** Longest history kept: the oldest entries go first. */
export const NAV_HISTORY_LIMIT = 50;

export function startNavHistory(entry: NavEntry): NavHistory {
  return { entries: [entry], index: 0 };
}

export function currentNavEntry(h: NavHistory): NavEntry {
  return h.entries[h.index];
}

/**
 * Goes to `entry`: the Forward entries are dropped. Going to the current
 * location only updates its title.
 */
export function navPush(h: NavHistory, entry: NavEntry, limit = NAV_HISTORY_LIMIT): NavHistory {
  const current = h.entries[h.index];
  if (current?.location === entry.location) {
    if (current.title === entry.title) return h;
    const entries = [...h.entries];
    entries[h.index] = entry;
    return { entries, index: h.index };
  }
  const entries = [...h.entries.slice(0, h.index + 1), entry].slice(-limit);
  return { entries, index: entries.length - 1 };
}

export function canNavigate(h: NavHistory, delta: number): boolean {
  const i = h.index + delta;
  return delta !== 0 && i >= 0 && i < h.entries.length;
}

/** Moves by `delta` (-1 is Back); out of range keeps the history. */
export function navGo(h: NavHistory, delta: number): NavHistory {
  return canNavigate(h, delta) ? { entries: h.entries, index: h.index + delta } : h;
}

/** Entries for a Back or Forward list, nearest first, with the `delta` to reach each. */
export function navMenuEntries(
  h: NavHistory,
  direction: "back" | "forward",
  limit = 15
): { entry: NavEntry; delta: number }[] {
  const out: { entry: NavEntry; delta: number }[] = [];
  const step = direction === "back" ? -1 : 1;
  for (let i = h.index + step; i >= 0 && i < h.entries.length && out.length < limit; i += step) {
    out.push({ entry: h.entries[i], delta: i - h.index });
  }
  return out;
}
