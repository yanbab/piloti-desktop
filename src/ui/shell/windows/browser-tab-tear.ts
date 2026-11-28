/**
 * A tab pulled off the tab bar becomes a window that follows the pointer
 * until release, as in Chrome. The window moves by its CSS `translate` (what
 * `<Window>` does while dragged), so nothing re-renders per pointermove; the
 * position is committed once, on release.
 */
import { startPointerDrag } from "@/ui/dnd/pointer-drag";
import { DRAG_DURATION, DRAG_EASE_SETTLE, DRAG_EASE_SPRING } from "@/ui/dnd/drag-feedback";

/** While carried, the window is a little smaller and see-through: it is held. */
const HELD = { scale: "0.94", opacity: "0.88" };

/** The new window grows out of the tab under the pointer. */
function lift(node: HTMLElement, originX: number) {
  node.style.transformOrigin = `${originX}px ${TEAR_GRAB_Y}px`;
  node.style.transition = "none";
  node.style.scale = "0.6";
  node.style.opacity = "0";
  void node.offsetWidth;
  node.style.transition = `scale ${DRAG_DURATION.lift}ms ${DRAG_EASE_SPRING}, opacity ${DRAG_DURATION.lift}ms ease`;
  node.style.scale = HELD.scale;
  node.style.opacity = HELD.opacity;
}

/** Put down: back to full size, then the inline styles go. */
function settle(node: HTMLElement) {
  node.style.transition = `scale ${DRAG_DURATION.lift}ms ${DRAG_EASE_SETTLE}, opacity ${DRAG_DURATION.lift}ms ease`;
  node.style.scale = "";
  node.style.opacity = "";
  window.setTimeout(() => {
    node.style.transition = "";
    node.style.transformOrigin = "";
  }, DRAG_DURATION.lift + 50);
}

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
  commit: (position: Point) => void,
  /** Where the pointer holds the window, from its left edge. */
  grabX = 80
): void {
  // Pages are iframes or web views that swallow the pointer: cover them.
  const cover = document.createElement("div");
  cover.style.cssText = "position:fixed;inset:0;z-index:9998;cursor:grabbing";
  document.body.appendChild(cover);
  const element = () =>
    document.querySelector<HTMLElement>(`[data-window-id="${CSS.escape(windowId)}"]`);
  let frame = 0;
  let latest = start;
  let lifted: HTMLElement | null = null;
  // The window mounts a frame or two after the tab leaves the bar.
  const tryLift = () => {
    const node = element();
    if (node && !lifted) {
      lifted = node;
      lift(node, grabX);
    }
    return Boolean(lifted);
  };
  let tries = 0;
  const waitForWindow = () => {
    if (!tryLift() && tries++ < 30) requestAnimationFrame(waitForWindow);
  };
  requestAnimationFrame(waitForWindow);
  startPointerDrag(pointer, {
    threshold: 0,
    onMove: (_event, { dx, dy }) => {
      latest = { x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const node = element();
        if (node) node.style.translate = `${latest.x}px ${latest.y}px`;
        tryLift();
      });
    },
    onEnd: () => {
      cancelAnimationFrame(frame);
      cover.remove();
      tries = Infinity;
      commit(latest);
      const node = lifted ?? element();
      if (node) settle(node);
    },
  });
}
