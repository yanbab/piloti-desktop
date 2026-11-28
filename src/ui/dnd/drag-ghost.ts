import { liftGhost } from "@/ui/dnd/drag-feedback";

/** Ghosts show a handful of items; the badge says how many there are. */
const MAX_GHOST_ITEMS = 8;

/**
 * Fills a `DragOverlay` with lifted clones of the dragged items' elements,
 * kept where they are relative to `origin` (the element in hand), so what you
 * drag is what you see. Items that aren't rendered are only counted.
 */
export function buildDragGhost(
  host: HTMLElement,
  options: {
    ids: readonly string[];
    primaryId: string;
    nodeOf: (id: string) => HTMLElement | null | undefined;
    origin: DOMRect;
  },
): void {
  const { ids, primaryId, nodeOf, origin } = options;
  if (host.childElementCount > 0) return;
  const ordered = [primaryId, ...ids.filter((id) => id !== primaryId)];
  for (const id of ordered.slice(0, MAX_GHOST_ITEMS)) {
    const node = nodeOf(id);
    if (!node) continue;
    const rect = node.getBoundingClientRect();
    const clone = node.cloneNode(true) as HTMLElement;
    clone.removeAttribute("id");
    clone.removeAttribute("data-vfs-drop-path");
    clone.removeAttribute("role");
    clone.tabIndex = -1;
    clone.style.cssText = [
      "position:absolute",
      `left:${rect.left - origin.left}px`,
      `top:${rect.top - origin.top}px`,
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      "margin:0",
    ].join(";");
    liftGhost(clone);
    host.appendChild(clone);
    if (id === primaryId && ids.length > 1) {
      const badge = document.createElement("span");
      badge.textContent = String(ids.length);
      badge.style.cssText =
        "position:absolute;top:2px;right:6px;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:var(--ui-accent);color:var(--ui-accent-foreground);font:700 11px/20px system-ui;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.35)";
      clone.appendChild(badge);
    }
  }
}
