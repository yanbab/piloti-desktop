/** Changes to the tabs of one Web Browser window. Each returns `null` for "no change". */
import type { BrowserTabGroup } from "@/core/windows/types";

/** Pinned tabs first, each side keeping its order. */
export function pinnedFirst(tabs: string[], pinned: string[] | undefined): string[] {
  if (!pinned?.length) return tabs;
  return [
    ...tabs.filter((id) => pinned.includes(id)),
    ...tabs.filter((id) => !pinned.includes(id)),
  ];
}

export function reorderedTabs(
  grp: BrowserTabGroup | undefined,
  tabIds: string[],
): BrowserTabGroup | null {
  if (!grp || tabIds.length !== grp.tabs.length) return null;
  if (!tabIds.every((id) => grp.tabs.includes(id))) return null;
  if (tabIds.every((id, i) => id === grp.tabs[i])) return null;
  return { ...grp, tabs: pinnedFirst(tabIds, grp.pinned) };
}

/** A tab just pinned goes after the pinned ones; one unpinned goes right after them. */
export function pinnedTabs(
  grp: BrowserTabGroup | undefined,
  tabId: string,
  pinned: boolean,
): BrowserTabGroup | null {
  if (!grp || !grp.tabs.includes(tabId)) return null;
  const current = grp.pinned ?? [];
  if (current.includes(tabId) === pinned) return null;
  const nextPinned = pinned ? [...current, tabId] : current.filter((id) => id !== tabId);
  const rest = grp.tabs.filter((id) => id !== tabId);
  const lead = rest.filter((id) => nextPinned.includes(id));
  const tail = rest.filter((id) => !nextPinned.includes(id));
  return { ...grp, tabs: [...lead, tabId, ...tail], pinned: nextPinned.length ? nextPinned : undefined };
}

/**
 * Tab `tabId` leaves window `from` for window `to`, at `index` among its tabs
 * (never before its pinned ones), and becomes its active tab. A window is
 * keyed by its group, or by its only tab when it has no record. Returns the
 * new groups and whether `from` is left empty (its window goes away), or
 * `null` when the move makes no sense.
 */
export function movedTabGroups(
  groups: Readonly<Record<string, BrowserTabGroup>>,
  from: string,
  to: string,
  tabId: string,
  index: number,
): { groups: Record<string, BrowserTabGroup>; fromEmptied: boolean } | null {
  if (from === to) return null;
  const source: BrowserTabGroup = groups[from] ?? { tabs: [from], active: from };
  const target: BrowserTabGroup = groups[to] ?? { tabs: [to], active: to };
  if (!source.tabs.includes(tabId) || target.tabs.includes(tabId)) return null;
  const next: Record<string, BrowserTabGroup> = { ...groups };

  const remaining = source.tabs.filter((id) => id !== tabId);
  const fromEmptied = remaining.length === 0;
  if (fromEmptied) {
    delete next[from];
  } else {
    const at = source.tabs.indexOf(tabId);
    const pinned = source.pinned?.filter((id) => id !== tabId);
    next[from] = {
      tabs: remaining,
      active: source.active === tabId ? remaining[Math.min(at, remaining.length - 1)]! : source.active,
      ...(pinned?.length ? { pinned } : {}),
    };
  }

  const lead = target.pinned?.length ?? 0;
  const slot = Math.min(Math.max(index, lead), target.tabs.length);
  next[to] = {
    ...target,
    tabs: [...target.tabs.slice(0, slot), tabId, ...target.tabs.slice(slot)],
    active: tabId,
  };
  return { groups: next, fromEmptied };
}
