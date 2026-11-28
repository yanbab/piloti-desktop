import { describe, expect, test } from "bun:test";
import { startPointerDrag } from "../../src/ui/dnd/pointer-drag";
import { DRAG_THRESHOLD, dragShuffleCss } from "../../src/ui/fx/drag-feedback";

function pointer(type: string, clientX: number, clientY: number, pointerId = 1): Event {
  return Object.assign(new Event(type), { clientX, clientY, pointerId });
}

describe("startPointerDrag", () => {
  test("waits for the threshold, then reports deltas from the press", () => {
    const target = new EventTarget();
    const moves: Array<[number, number]> = [];
    let starts = 0;
    let end: { moved: boolean; dx: number } | null = null;
    startPointerDrag(
      { clientX: 10, clientY: 10, pointerId: 1 },
      {
        target,
        onStart: () => starts++,
        onMove: (_e, d) => moves.push([d.dx, d.dy]),
        onEnd: (_e, info) => (end = info),
      },
    );
    target.dispatchEvent(pointer("pointermove", 10 + DRAG_THRESHOLD - 1, 10));
    expect(moves).toEqual([]);
    target.dispatchEvent(pointer("pointermove", 30, 14));
    target.dispatchEvent(pointer("pointermove", 40, 20));
    expect(starts).toBe(1);
    expect(moves).toEqual([
      [20, 4],
      [30, 10],
    ]);
    target.dispatchEvent(pointer("pointerup", 40, 20));
    expect(end).toMatchObject({ moved: true, dx: 30, cancelled: false });
    // Listeners are gone after the release.
    target.dispatchEvent(pointer("pointermove", 90, 90));
    expect(moves.length).toBe(2);
  });

  test("a click without travel ends with moved=false", () => {
    const target = new EventTarget();
    let end: { moved: boolean } | null = null;
    startPointerDrag({ clientX: 0, clientY: 0 }, { target, onMove: () => {}, onEnd: (_e, i) => (end = i) });
    target.dispatchEvent(pointer("pointerup", 1, 1));
    expect(end).toMatchObject({ moved: false });
  });

  test("pointercancel ends the drag, other pointers are ignored", () => {
    const target = new EventTarget();
    let moves = 0;
    let end: { cancelled: boolean } | null = null;
    startPointerDrag(
      { clientX: 0, clientY: 0, pointerId: 7 },
      { target, threshold: 0, onMove: () => moves++, onEnd: (_e, i) => (end = i) },
    );
    target.dispatchEvent(pointer("pointermove", 5, 5, 8));
    target.dispatchEvent(pointer("pointerup", 5, 5, 8));
    expect(moves).toBe(0);
    expect(end).toBeNull();
    target.dispatchEvent(pointer("pointermove", 5, 5, 7));
    target.dispatchEvent(pointer("pointercancel", 5, 5, 7));
    expect(moves).toBe(1);
    expect(end).toMatchObject({ cancelled: true });
  });

  test("the returned stop function detaches without onEnd", () => {
    const target = new EventTarget();
    let ended = false;
    const stop = startPointerDrag(
      { clientX: 0, clientY: 0 },
      { target, threshold: 0, onMove: () => {}, onEnd: () => (ended = true) },
    );
    stop();
    target.dispatchEvent(pointer("pointerup", 0, 0));
    expect(ended).toBe(false);
  });
});

describe("drag feedback", () => {
  test("shuffle transition covers every property with one curve", () => {
    expect(dragShuffleCss("left", "top")).toBe(
      "left 320ms cubic-bezier(0.34, 1.45, 0.5, 1), top 320ms cubic-bezier(0.34, 1.45, 0.5, 1)",
    );
  });
});
