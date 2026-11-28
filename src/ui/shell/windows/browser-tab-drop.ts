/**
 * Where a carried tab lands: the tab bar of another Web Browser window, or
 * its toolbar when it shows a single page (no bar yet). While the tab hovers
 * one, an accent line marks the slot it will take and the zone is tinted.
 */

/** A Web Browser window that takes tabs (set on its tabs container). */
export const TAB_DROP_ATTR = "data-tab-drop";

export interface TabDropTarget {
  /** The window's id, `browser:<group>`. */
  windowId: string;
  /** The slot among its tabs. */
  index: number;
  /** The zone to tint, in viewport coordinates. */
  zone: { left: number; top: number; width: number; height: number };
  /** The insertion line: x, and its top and height. */
  line: { x: number; top: number; height: number };
}

/** The slot a pointer at `x` takes among tabs with these left/right edges. */
export function insertionIndex(tabs: ReadonlyArray<{ left: number; right: number }>, x: number): number {
  let index = 0;
  for (const t of tabs) if (x > (t.left + t.right) / 2) index++;
  return index;
}

/** Where the line goes for slot `index`: between two tabs, or at an end. */
export function insertionX(tabs: ReadonlyArray<{ left: number; right: number }>, index: number, fallback: number): number {
  if (tabs.length === 0) return fallback;
  if (index <= 0) return tabs[0]!.left - 1;
  if (index >= tabs.length) return tabs[tabs.length - 1]!.right + 1;
  return (tabs[index - 1]!.right + tabs[index]!.left) / 2;
}

/**
 * The target under the pointer, topmost window first, skipping window
 * `exclude` (the one being carried).
 */
export function findTabDropTarget(x: number, y: number, exclude: string): TabDropTarget | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const frame = el.closest<HTMLElement>("[data-window-id]");
    if (!frame) continue;
    if (frame.dataset.windowId === exclude) continue;
    const host = frame.querySelector<HTMLElement>(`[${TAB_DROP_ATTR}]`);
    const windowId = host?.getAttribute(TAB_DROP_ATTR);
    // The first other window under the pointer decides: covered ones don't count.
    if (!host || !windowId) return null;
    const bar = host.querySelector<HTMLElement>('[data-slot="browser-tab-bar"]:not([hidden])');
    const barRect = bar?.getBoundingClientRect();
    if (bar && barRect && barRect.height > 0) {
      // The bar, and a little above and below it.
      if (y < barRect.top - 14 || y > barRect.bottom + 14) return null;
      const tabs = Array.from(bar.querySelectorAll<HTMLElement>("[data-tab-id]")).map((t) => t.getBoundingClientRect());
      const pinned = bar.querySelectorAll("[data-tab-pinned]").length;
      const index = Math.max(pinned, insertionIndex(tabs, x));
      return {
        windowId,
        index,
        zone: { left: barRect.left, top: barRect.top, width: barRect.width, height: barRect.height },
        line: { x: insertionX(tabs, index, barRect.left + 4), top: barRect.top + 3, height: barRect.height - 6 },
      };
    }
    // One page: its toolbar takes the tab, after the page it shows.
    const toolbar = host
      .querySelector<HTMLElement>('[data-active-tab] [data-slot="header-bar-start"]')
      ?.parentElement?.getBoundingClientRect();
    if (!toolbar || y < toolbar.top || y > toolbar.bottom + 14) return null;
    return {
      windowId,
      index: 1,
      zone: { left: toolbar.left, top: toolbar.top, width: toolbar.width, height: toolbar.height },
      line: { x: toolbar.right - 6, top: toolbar.top + 6, height: toolbar.height - 12 },
    };
  }
  return null;
}

/** The tint and the line, drawn over everything while the tab hovers a target. */
export function createTabDropIndicator() {
  const zone = document.createElement("div");
  zone.dataset.slot = "browser-tab-drop-zone";
  zone.style.cssText =
    "position:fixed;z-index:9999;pointer-events:none;border-radius:8px;" +
    "background:color-mix(in srgb, var(--ui-accent) 14%, transparent);" +
    "box-shadow:inset 0 0 0 1.5px color-mix(in srgb, var(--ui-accent) 55%, transparent);" +
    "opacity:0;transition:opacity 120ms ease";
  const line = document.createElement("div");
  line.dataset.slot = "browser-tab-drop-line";
  line.style.cssText =
    "position:fixed;z-index:9999;pointer-events:none;width:3px;border-radius:2px;background:var(--ui-accent);" +
    "opacity:0;transition:opacity 120ms ease, left 90ms ease";
  document.body.append(zone, line);
  return {
    show(target: TabDropTarget | null) {
      if (!target) {
        zone.style.opacity = "0";
        line.style.opacity = "0";
        return;
      }
      Object.assign(zone.style, {
        left: `${target.zone.left}px`,
        top: `${target.zone.top}px`,
        width: `${target.zone.width}px`,
        height: `${target.zone.height}px`,
        opacity: "1",
      });
      Object.assign(line.style, {
        left: `${Math.round(target.line.x - 1.5)}px`,
        top: `${target.line.top}px`,
        height: `${target.line.height}px`,
        opacity: "1",
      });
    },
    remove() {
      zone.remove();
      line.remove();
    },
  };
}
