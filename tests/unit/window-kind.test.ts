import { describe, expect, test } from "bun:test";
import { windowKind } from "@/core/windows/window-kind";

const native = { compositor: true };
const demo = { compositor: false };

describe("windowKind", () => {
  test("shell and demo iframe", () => {
    expect(windowKind({ builtinComponent: "texts" }, native)).toBe("shell");
    expect(windowKind({ builtinComponent: "texts", isolated: true }, demo)).toBe("frame");
  });

  test("Domicile browser windows", () => {
    const base = { browserWindowId: "b1" };
    expect(windowKind({ ...base, browserUrl: "https://a.org" }, native)).toBe("web-page");
    expect(windowKind({ ...base, browserUrl: "https://a.org", browserIsApp: true }, native)).toBe("web-app");
    expect(
      windowKind({ ...base, browserUrl: "domicile://app-terminal/", browserIsApp: true }, native),
    ).toBe("module");
  });

  test("native clients", () => {
    const w = { waylandAppId: "w1" };
    expect(windowKind(w, native)).toBe("wayland");
    expect(windowKind(w, { compositor: true, processName: "gnome-calculato" })).toBe("wayland");
    expect(windowKind(w, { compositor: true, processName: "xwayland-satell" })).toBe("x11");
    expect(windowKind(w, demo)).toBe("simulated");
  });
});
