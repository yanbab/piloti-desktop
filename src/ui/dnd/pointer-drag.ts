/**
 * Hand-rolled pointer drags for moving or resizing surfaces (launcher,
 * floating presentations, split-view handles). Item drag-and-drop (lists,
 * grids, sortable) uses dnd-kit instead.
 *
 * One press → move → release lifecycle: a threshold before the drag starts,
 * listeners on the window (capture phase) or on an element holding pointer
 * capture, `pointercancel` treated like a release, and guaranteed cleanup.
 * Once started, a drag is in `drag-session.ts`: Escape, or a release that
 * never came, ends it (`cancelled`).
 */

import { DRAG_THRESHOLD } from "@/ui/fx/drag-feedback";
import { trackDrag, type DragEndReason } from "./drag-session";

export interface PointerDragDelta {
  dx: number;
  dy: number;
}

export interface PointerDragEnd extends PointerDragDelta {
  /** The threshold was crossed (otherwise it was a click). */
  moved: boolean;
  /** Ended by `pointercancel`, Escape or a missed release rather than a release. */
  cancelled: boolean;
  /** Escape: put things back if that means something. */
  escaped?: boolean;
}

export interface PointerDragOptions {
  /** Travel in px before the drag starts; 0 starts at once. */
  threshold?: number;
  /** Listen on this element after `setPointerCapture`, instead of the window. */
  captureElement?: Element;
  /** Clears any text selection when the drag starts (default true). */
  clearSelection?: boolean;
  /** Event source when not capturing (default `window`; tests pass their own). */
  target?: EventTarget;
  onStart?: (event: PointerEvent, delta: PointerDragDelta) => void;
  onMove: (event: PointerEvent, delta: PointerDragDelta) => void;
  /** Always called once, click or drag. */
  onEnd?: (event: PointerEvent, end: PointerDragEnd) => void;
}

interface PressPoint {
  clientX: number;
  clientY: number;
  pointerId?: number;
}

/** Starts tracking a press. Returns a function that stops it without `onEnd`. */
export function startPointerDrag(press: PressPoint, options: PointerDragOptions): () => void {
  const threshold = options.threshold ?? DRAG_THRESHOLD;
  const { captureElement } = options;
  if (captureElement && press.pointerId !== undefined) {
    try {
      captureElement.setPointerCapture(press.pointerId);
    } catch {
      // Pointer already gone: listeners below still clean up on release.
    }
  }
  const target: EventTarget =
    captureElement ?? options.target ?? (globalThis as unknown as EventTarget);
  const listen = { capture: !captureElement };
  let moved = false;
  let done = false;
  let untrack: (() => void) | null = null;
  let last: PointerEvent | null = null;

  const delta = (e: PointerEvent): PointerDragDelta => ({
    dx: e.clientX - press.clientX,
    dy: e.clientY - press.clientY,
  });
  const ours = (e: PointerEvent) =>
    press.pointerId === undefined || e.pointerId === undefined || e.pointerId === press.pointerId;

  const onMove = (e: Event) => {
    const ev = e as PointerEvent;
    if (!ours(ev)) return;
    last = ev;
    const d = delta(ev);
    if (!moved) {
      if (Math.hypot(d.dx, d.dy) < threshold) return;
      moved = true;
      untrack = trackDrag(endEarly);
      if (options.clearSelection !== false) {
        (globalThis as { getSelection?: () => Selection | null }).getSelection?.()?.removeAllRanges();
      }
      options.onStart?.(ev, d);
    }
    options.onMove(ev, d);
  };
  const finish = (e: Event) => {
    const ev = e as PointerEvent;
    if (!ours(ev)) return;
    stop();
    options.onEnd?.(ev, { ...delta(ev), moved, cancelled: e.type === "pointercancel" });
  };
  /** Escape or a missed release: ends where the pointer last was. */
  const endEarly = (reason: DragEndReason) => {
    if (done) return;
    untrack = null;
    stop();
    if (captureElement && press.pointerId !== undefined) {
      try {
        captureElement.releasePointerCapture(press.pointerId);
      } catch {
        // Not held any more.
      }
    }
    const at = last ?? ({ clientX: press.clientX, clientY: press.clientY, pointerId: press.pointerId } as PointerEvent);
    options.onEnd?.(at, { ...delta(at), moved, cancelled: true, escaped: reason === "cancel" });
  };
  const stop = () => {
    if (done) return;
    done = true;
    untrack?.();
    untrack = null;
    target.removeEventListener("pointermove", onMove, listen);
    target.removeEventListener("pointerup", finish, listen);
    target.removeEventListener("pointercancel", finish, listen);
  };

  target.addEventListener("pointermove", onMove, listen);
  target.addEventListener("pointerup", finish, listen);
  target.addEventListener("pointercancel", finish, listen);
  return stop;
}
