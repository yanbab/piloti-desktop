/**
 * Every drag in progress, whatever moves it (a window, a torn-off tab, a
 * launcher, a split handle), so none can outlive its gesture:
 *
 * - Escape ends them all as cancelled (`"cancel"`): a window goes back where
 *   it was. The shell grabs Escape from the compositor while a drag runs
 *   (`useDragEscape`), so it works whichever app has the keyboard.
 * - A release the shell never heard of ends them as dropped (`"lost"`): a
 *   move with no button held after one was, or a new press. This is what used
 *   to leave the pointer stuck in a drag. (Not the shell losing focus: a
 *   press on a Linux app's window gives it the keyboard as its drag starts.)
 */

export type DragEndReason = "cancel" | "lost";
type Ender = (reason: DragEndReason) => void;

const active = new Set<Ender>();
const listeners = new Set<() => void>();
let sawButton = false;
let installed: (() => void) | null = null;

const notify = () => {
  for (const listener of listeners) listener();
};

/** Drags in progress. */
export const activeDragCount = (): number => active.size;

/** Called when drags start or end. */
export function onDragsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/**
 * Registers a drag; `end` is called once if it must stop early. Returns what
 * the drag calls when it ends by itself.
 */
export function trackDrag(end: Ender): () => void {
  active.add(end);
  install();
  notify();
  return () => {
    if (!active.delete(end)) return;
    if (active.size === 0) uninstall();
    notify();
  };
}

/** Ends every drag in progress. True when there was one. */
export function endAllDrags(reason: DragEndReason): boolean {
  if (active.size === 0) return false;
  const ending = [...active];
  active.clear();
  uninstall();
  for (const end of ending) {
    try {
      end(reason);
    } catch (error) {
      console.error("[drag] ending a drag failed", error);
    }
  }
  notify();
  return true;
}

/** Escape from the keyboard of the shell itself. True when it ended a drag. */
export function escapeDrags(): boolean {
  return endAllDrags("cancel");
}

function install() {
  if (installed) return;
  const target = globalThis as unknown as EventTarget;
  if (typeof target.addEventListener !== "function") return;
  sawButton = false;
  const onKey = (e: Event) => {
    if ((e as KeyboardEvent).key !== "Escape") return;
    if (escapeDrags()) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  const onMove = (e: Event) => {
    const buttons = (e as PointerEvent).buttons;
    if (buttons === undefined) return;
    // A drag a Wayland client started (xdg_toplevel.move) may never report
    // the button: only a button seen, then gone, is a missed release.
    if ((buttons & 1) !== 0) sawButton = true;
    else if (sawButton) endAllDrags("lost");
  };
  // A press while a drag runs: its release was missed.
  const onDown = () => endAllDrags("lost");
  const capture = { capture: true };
  target.addEventListener("keydown", onKey, capture);
  target.addEventListener("pointermove", onMove, capture);
  target.addEventListener("pointerdown", onDown, capture);
  installed = () => {
    target.removeEventListener("keydown", onKey, capture);
    target.removeEventListener("pointermove", onMove, capture);
    target.removeEventListener("pointerdown", onDown, capture);
  };
}

function uninstall() {
  installed?.();
  installed = null;
}
