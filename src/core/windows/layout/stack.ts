/**
 * Changes to one stack of tabs. Each returns `null` for "no change". Generalises
 * the Web Browser's tab groups (`core/windows/tab-groups.ts`) to any view.
 */
import type { StackNode, SurfaceId } from "./types";

export const stackOf = (...tabs: SurfaceId[]): StackNode => ({
  kind: "stack",
  tabs,
  active: tabs[tabs.length - 1]!,
});

/** Pinned tabs first, each side keeping its order. */
export function pinnedFirst(tabs: SurfaceId[], pinned: SurfaceId[] | undefined): SurfaceId[] {
  if (!pinned?.length) return tabs;
  return [...tabs.filter((id) => pinned.includes(id)), ...tabs.filter((id) => !pinned.includes(id))];
}

export function selectTab(stack: StackNode, tab: SurfaceId): StackNode | null {
  if (stack.active === tab || !stack.tabs.includes(tab)) return null;
  return { ...stack, active: tab };
}

/** The tab `offset` places away from the active one, wrapping. */
export function cycleTab(stack: StackNode, offset: number): StackNode | null {
  if (stack.tabs.length < 2) return null;
  const at = stack.tabs.indexOf(stack.active);
  const n = stack.tabs.length;
  return selectTab(stack, stack.tabs[(((at + offset) % n) + n) % n]!);
}

export function reorderTabs(stack: StackNode, tabs: SurfaceId[]): StackNode | null {
  if (tabs.length !== stack.tabs.length || !tabs.every((id) => stack.tabs.includes(id))) return null;
  if (tabs.every((id, i) => id === stack.tabs[i])) return null;
  return { ...stack, tabs: pinnedFirst(tabs, stack.pinned) };
}

/** A tab just pinned goes after the pinned ones; one unpinned goes right after them. */
export function pinTab(stack: StackNode, tab: SurfaceId, pinned: boolean): StackNode | null {
  if (!stack.tabs.includes(tab)) return null;
  const current = stack.pinned ?? [];
  if (current.includes(tab) === pinned) return null;
  const nextPinned = pinned ? [...current, tab] : current.filter((id) => id !== tab);
  const rest = stack.tabs.filter((id) => id !== tab);
  return withPinned(
    { ...stack, tabs: [...rest.filter((id) => nextPinned.includes(id)), tab, ...rest.filter((id) => !nextPinned.includes(id))] },
    nextPinned,
  );
}

/** `tab` added at `index` (never before the pinned ones, end by default), and shown. */
export function addTab(stack: StackNode, tab: SurfaceId, index = Infinity): StackNode {
  const tabs = stack.tabs.filter((id) => id !== tab);
  const lead = stack.pinned?.filter((id) => id !== tab).length ?? 0;
  const slot = Math.min(Math.max(index, lead), tabs.length);
  return withPinned(
    { ...stack, tabs: [...tabs.slice(0, slot), tab, ...tabs.slice(slot)], active: tab },
    stack.pinned?.filter((id) => id !== tab),
  );
}

/** `tab` taken out; a removed active tab hands over to the one that took its place. `null` when emptied. */
export function removeTab(stack: StackNode, tab: SurfaceId): StackNode | null {
  const at = stack.tabs.indexOf(tab);
  if (at < 0) return stack;
  const tabs = stack.tabs.filter((id) => id !== tab);
  if (!tabs.length) return null;
  const active = stack.active === tab ? tabs[Math.min(at, tabs.length - 1)]! : stack.active;
  return withPinned({ ...stack, tabs, active }, stack.pinned?.filter((id) => id !== tab));
}

function withPinned(stack: StackNode, pinned: SurfaceId[] | undefined): StackNode {
  const { pinned: _old, ...rest } = stack;
  return pinned?.length ? { ...rest, pinned } : rest;
}
