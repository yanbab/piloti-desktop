import { describe, expect, it } from "bun:test";
import { hasOpenPopupSurface, openPopupSurface } from "@/lib/windows/popup-layer";

describe("popup layer", () => {
  it("keeps one surface: opening one closes the previous", () => {
    const closed: string[] = [];
    const releaseA = openPopupSurface(() => closed.push("a"));
    const releaseB = openPopupSurface(() => closed.push("b"));
    expect(closed).toEqual(["a"]);
    releaseA(); // stale release does not drop B
    expect(hasOpenPopupSurface()).toBe(true);
    releaseB();
    expect(hasOpenPopupSurface()).toBe(false);
  });
});
