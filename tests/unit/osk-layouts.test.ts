import { describe, expect, test } from "bun:test";
import {
  OSK_DOUBLE_TAP_MS,
  OSK_INITIAL_STATE,
  OSK_LAYOUTS,
  oskLayoutFor,
  pressOskButton,
  type OskState,
} from "@/core/osk/osk-layouts";

const press = (state: OskState, ...buttons: [string, number][]) =>
  buttons.reduce(
    (acc, [button, now]) => {
      const r = pressOskButton(acc.state, button, now);
      return { state: r.state, outputs: [...acc.outputs, r.output] };
    },
    { state, outputs: [] as ReturnType<typeof pressOskButton>["output"][] },
  );

describe("on-screen keyboard layouts", () => {
  test("picks AZERTY for French and Belgian keymaps", () => {
    expect(oskLayoutFor("fr")).toBe("fr");
    expect(oskLayoutFor("fr(azerty)")).toBe("fr");
    expect(oskLayoutFor("be")).toBe("fr");
    expect(oskLayoutFor("French")).toBe("fr");
    expect(oskLayoutFor("us")).toBe("us");
    expect(oskLayoutFor("")).toBe("us");
    expect(oskLayoutFor(undefined)).toBe("us");
  });

  test("every layer has the same rows in each layout", () => {
    for (const layout of Object.values(OSK_LAYOUTS)) {
      const rows = Object.values(layout).map((layer) => layer.length);
      expect(new Set(rows).size).toBe(1);
      for (const layer of Object.values(layout)) {
        expect(layer.join(" ")).toContain("{bksp}");
        expect(layer.join(" ")).toContain("{hide}");
      }
    }
  });

  test("types text and keys", () => {
    expect(pressOskButton(OSK_INITIAL_STATE, "é", 0).output).toEqual({ kind: "text", text: "é" });
    expect(pressOskButton(OSK_INITIAL_STATE, "{space}", 0).output).toEqual({ kind: "text", text: " " });
    expect(pressOskButton(OSK_INITIAL_STATE, "{bksp}", 0).output).toEqual({ kind: "key", key: "Backspace" });
    expect(pressOskButton(OSK_INITIAL_STATE, "{enter}", 0).output).toEqual({ kind: "key", key: "Enter" });
    expect(pressOskButton(OSK_INITIAL_STATE, "{hide}", 0).output).toEqual({ kind: "hide" });
    expect(pressOskButton(OSK_INITIAL_STATE, "{unknown}", 0).output).toBeNull();
    expect(pressOskButton(OSK_INITIAL_STATE, "{", 0).output).toEqual({ kind: "text", text: "{" });
  });

  test("Shift lasts one character", () => {
    const { state, outputs } = press(OSK_INITIAL_STATE, ["{shift}", 0], ["A", 1000], ["z", 2000]);
    expect(outputs).toEqual([null, { kind: "text", text: "A" }, { kind: "text", text: "z" }]);
    expect(state.layer).toBe("default");
  });

  test("a double tap of Shift locks it until the next tap", () => {
    const locked = press(OSK_INITIAL_STATE, ["{shift}", 0], ["{shift}", OSK_DOUBLE_TAP_MS - 1], ["A", 1000], ["B", 1100]);
    expect(locked.state).toMatchObject({ layer: "shift", capsLock: true });
    const off = pressOskButton(locked.state, "{shift}", 5000);
    expect(off.state).toMatchObject({ layer: "default", capsLock: false });
  });

  test("a slow second tap of Shift turns it off", () => {
    const { state } = press(OSK_INITIAL_STATE, ["{shift}", 0], ["{shift}", OSK_DOUBLE_TAP_MS + 100]);
    expect(state).toMatchObject({ layer: "default", capsLock: false });
  });

  test("switches to numbers and back", () => {
    const { state } = press(OSK_INITIAL_STATE, ["{numbers}", 0], ["1", 10]);
    expect(state.layer).toBe("numbers");
    expect(pressOskButton(state, "{abc}", 20).state.layer).toBe("default");
  });
});
