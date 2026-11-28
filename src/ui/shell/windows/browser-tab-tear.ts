/**
 * A tab pulled off the tab bar becomes a window that follows the pointer
 * until release, as in Chrome. The window moves by its CSS `translate` (what
 * `<Window>` does while dragged), so nothing re-renders per pointermove; the
 * position is committed once, on release.
 */
import { startPointerDrag } from "@/ui/dnd/pointer-drag";

interface Point {
  x: number;
  y: number;
}

/** Where the pointer holds the new window: inside its header, near the tab. */
export const TEAR_GRAB_Y = 18;

/**
 * Follows the pointer with window `windowId`, first placed at `start`, from
 * the press at `pointer`. Calls `commit` with the final position.
 */
export function followTornTab(
  windowId: string,
  start: Point,
  pointer: { clientX: number; clientY: number },
  commit: (position: Point) => void
): void {
  // Pages are iframes or web views that swallow the pointer: cover them.
  const cover = document.createElement("div");
  cover.style.cssText = "position:fixed;inset:0;z-index:9998;cursor:grabbing";
  document.body.appendChild(cover);
  const element = () =>
    document.querySelector<HTMLElement>(`[data-window-id="${CSS.escape(windowId)}"]`);
  let frame = 0;
  let latest = start;
  startPointerDrag(pointer, {
    threshold: 0,
    onMove: (_event, { dx, dy }) => {
      latest = { x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const node = element();
        if (node) node.style.translate = `${latest.x}px ${latest.y}px`;
      });
    },
    onEnd: () => {
      cancelAnimationFrame(frame);
      cover.remove();
      commit(latest);
    },
  });
}
