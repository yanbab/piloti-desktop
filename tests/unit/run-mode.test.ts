import { describe, expect, it } from "bun:test";
import { APP_MODULES } from "../../src/data/app-modules";
import { canRunIsolated } from "../../src/lib/windows/run-mode";

describe("run mode", () => {
  it("offers separate windows only for apps with a module", () => {
    expect(canRunIsolated("texts")).toBe(true);
    expect(canRunIsolated("terminal")).toBe(false);
    for (const id of ["texts", "calculator"]) {
      expect(canRunIsolated(id)).toBe(true);
      expect(APP_MODULES.some((m) => m.id === id)).toBe(true);
    }
    expect(APP_MODULES.some((m) => m.id === "texts")).toBe(true);
  });
});
