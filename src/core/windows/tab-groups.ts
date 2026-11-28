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
