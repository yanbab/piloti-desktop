/**
 * A tab pulled off the tab bar becomes a window that follows the pointer
 * until release, as in Chrome. The window moves by its CSS `translate` (what
 * `<Window>` does while dragged), so nothing re-renders per pointermove; the
 * position is committed once, on release.
 */
import { startPointerDrag } from "@/ui/dnd/pointer-drag";
import { DRAG_DURATION, DRAG_EASE_SETTLE, DRAG_EASE_SPRING } from "@/ui/fx/drag-feedback";
import { createTabDropIndicator, findTabDropTarget, type TabDropTarget } from "@/ui/shell/windows/browser-tab-drop";

/** While carried, the window is a little smaller and see-through: it is held. */
const HELD = { scale: "0.94", opacity: "0.88" };
/** Over another window's tabs: it shrinks back toward a tab, about to join them. */
const JOINING = { scale: "0.32", opacity: "0.8" };
/** Above every window while carried, so a window raised under it stays below. */
const CARRIED_Z = "9990";

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
  grabX = 80,
  /** Dropped on another window's tabs: the tab joins them at `index`. */
  onJoin?: (target: { windowId: string; index: number }) => void
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
  let restoreZ = "";
  let guard: MutationObserver | null = null;
  // The window mounts a frame or two after the tab leaves the bar.
  const tryLift = () => {
    const node = element();
    if (node && !lifted) {
      lifted = node;
      restoreZ = node.style.zIndex;
      node.style.zIndex = CARRIED_Z;
      lift(node, grabX);
      // React re-renders the window while it is carried (its position, its
      // z-index, its origin): put back what the carry needs.
      guard = new MutationObserver(() => {
        const want = {
          translate: `${latest.x}px ${latest.y}px`,
          zIndex: CARRIED_Z,
          transformOrigin: `${grabX}px ${TEAR_GRAB_Y}px`,
        };
        for (const [key, value] of Object.entries(want) as Array<[keyof typeof want, string]>) {
          if (node.style[key] !== value) node.style[key] = value;
        }
      });
      guard.observe(node, { attributes: true, attributeFilter: ["style"] });
    }
    return Boolean(lifted);
  };
  const indicator = onJoin ? createTabDropIndicator() : null;
  let target: TabDropTarget | null = null;
  let pointerAt = { x: pointer.clientX, y: pointer.clientY };
  const showJoining = (joining: boolean) => {
    if (!lifted) return;
    lifted.style.transition = `scale ${DRAG_DURATION.lift}ms ${DRAG_EASE_SPRING}, opacity ${DRAG_DURATION.lift}ms ease`;
    lifted.style.scale = joining ? JOINING.scale : HELD.scale;
    lifted.style.opacity = joining ? JOINING.opacity : HELD.opacity;
  };
  // The hovered window comes forward (just under the carried one) so its
  // tabs show; it goes back on leave.
  let raised: { node: HTMLElement; z: string } | null = null;
  const raise = (id: string | null) => {
    if (raised) raised.node.style.zIndex = raised.z;
    raised = null;
    const node = id ? document.querySelector<HTMLElement>(`[data-window-id="${CSS.escape(id)}"]`) : null;
    if (node) {
      raised = { node, z: node.style.zIndex };
      node.style.zIndex = String(Number(CARRIED_Z) - 1);
    }
  };
  let tries = 0;
  const waitForWindow = () => {
    if (!tryLift() && tries++ < 30) requestAnimationFrame(waitForWindow);
  };
  requestAnimationFrame(waitForWindow);
  startPointerDrag(pointer, {
    threshold: 0,
    onMove: (event, { dx, dy }) => {
      latest = { x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
      pointerAt = { x: event.clientX, y: event.clientY };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const node = element();
        if (node) node.style.translate = `${latest.x}px ${latest.y}px`;
        tryLift();

        if (indicator) {
          const next = findTabDropTarget(pointerAt.x, pointerAt.y, windowId);
          if (Boolean(next) !== Boolean(target)) showJoining(Boolean(next));
          if (next?.windowId !== target?.windowId) raise(next?.windowId ?? null);
          target = next;
          indicator.show(target);
        }
      });
    },
    onEnd: () => {
      cancelAnimationFrame(frame);
      cover.remove();
      tries = Infinity;
      guard?.disconnect();
      indicator?.remove();
      raise(null);
      // The last frame may not have run: look again where the pointer is.
      const join = onJoin ? findTabDropTarget(pointerAt.x, pointerAt.y, windowId) : null;
      if (join && onJoin) {
        onJoin({ windowId: join.windowId, index: join.index });
        return;
      }
      commit(latest);
      const node = lifted ?? element();
      if (node) {
        node.style.zIndex = restoreZ;
        settle(node);
      }
    },
  });
}
