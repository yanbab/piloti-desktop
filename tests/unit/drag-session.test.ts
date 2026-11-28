import { afterEach, describe, expect, test } from "bun:test";
import { activeDragCount, endAllDrags, escapeDrags, trackDrag } from "../../src/ui/dnd/drag-session";
import { startPointerDrag } from "../../src/ui/dnd/pointer-drag";

const g = globalThis as unknown as EventTarget;
const pointer = (type: string, x: number, y: number, buttons?: number): Event =>
  Object.assign(new Event(type), { clientX: x, clientY: y, pointerId: 1, buttons });
const key = (k: string): Event => Object.assign(new Event("keydown", { cancelable: true }), { key: k });

afterEach(() => void endAllDrags("lost"));

describe("drag session", () => {
  test("Escape cancels every drag, once", () => {
    const ended: string[] = [];
    trackDrag((r) => ended.push(`a:${r}`));
    trackDrag((r) => ended.push(`b:${r}`));
    expect(activeDragCount()).toBe(2);
    const esc = key("Escape");
    g.dispatchEvent(esc);
    expect(ended).toEqual(["a:cancel", "b:cancel"]);
    expect(esc.defaultPrevented).toBe(true);
    expect(activeDragCount()).toBe(0);
    // Nothing left to cancel: Escape goes on as usual.
    const later = key("Escape");
    g.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
    expect(escapeDrags()).toBe(false);
  });

  test("a drag that ends by itself is not ended again", () => {
    let ended = 0;
    const untrack = trackDrag(() => ended++);
    untrack();
    g.dispatchEvent(key("Escape"));
    expect(ended).toBe(0);
  });

  test("a move without the button, after one with it, is a missed release", () => {
    const ended: string[] = [];
    trackDrag((r) => ended.push(r));
    // A drag a Wayland client started may never report the button.
    g.dispatchEvent(pointer("pointermove", 1, 1, 0));
    expect(ended).toEqual([]);
    g.dispatchEvent(pointer("pointermove", 2, 2, 1));
    g.dispatchEvent(pointer("pointermove", 3, 3, 0));
    expect(ended).toEqual(["lost"]);
  });

  test("a new press ends a drag whose release was missed", () => {
    const ended: string[] = [];
    trackDrag((r) => ended.push(r));
    g.dispatchEvent(pointer("pointerdown", 0, 0, 1));
    expect(ended).toEqual(["lost"]);
  });

  test("Escape ends a pointer drag where the pointer was, marked escaped", () => {
    const target = new EventTarget();
    let end: { dx: number; cancelled: boolean; escaped?: boolean } | null = null;
    let moves = 0;
    startPointerDrag(
      { clientX: 0, clientY: 0, pointerId: 1 },
      { target, threshold: 0, onMove: () => moves++, onEnd: (_e, info) => (end = info) },
    );
    // Not tracked before it moves: a click registers nothing.
    expect(activeDragCount()).toBe(0);
    target.dispatchEvent(pointer("pointermove", 25, 0));
    expect(activeDragCount()).toBe(1);
    g.dispatchEvent(key("Escape"));
    expect(end).toMatchObject({ dx: 25, cancelled: true, escaped: true });
    // Its listeners are gone.
    target.dispatchEvent(pointer("pointermove", 90, 0));
    target.dispatchEvent(pointer("pointerup", 90, 0));
    expect(moves).toBe(1);
    expect(end).toMatchObject({ dx: 25 });
  });

  test("a released pointer drag leaves the session", () => {
    const target = new EventTarget();
    startPointerDrag({ clientX: 0, clientY: 0, pointerId: 1 }, { target, threshold: 0, onMove: () => {} });
    target.dispatchEvent(pointer("pointermove", 5, 0));
    target.dispatchEvent(pointer("pointerup", 5, 0));
    expect(activeDragCount()).toBe(0);
  });
});
