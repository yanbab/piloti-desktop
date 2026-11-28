import { describe, expect, test } from "bun:test";
import { followDrag } from "@/ui/dnd/follow-drag";

const at = (type: string, clientX: number, clientY: number) => Object.assign(new Event(type), { clientX, clientY });
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("follow drag", () => {
  test("the surface moves with the pointer and goes back after the drop", async () => {
    const page = new EventTarget();
    const surface = { style: { marginLeft: "", marginTop: "" } } as unknown as HTMLElement;
    followDrag(surface, { clientX: 100, clientY: 100 }, page);
    page.dispatchEvent(at("dragover", 130, 60));
    expect([surface.style.marginLeft, surface.style.marginTop]).toEqual(["30px", "-40px"]);
    page.dispatchEvent(new Event("drop"));
    expect(surface.style.marginLeft).toBe("30px");
    await tick();
    expect(surface.style.marginLeft).toBe("");
    page.dispatchEvent(at("dragover", 500, 500));
    expect(surface.style.marginLeft).toBe("");
  });
});
