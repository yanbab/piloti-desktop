import { describe, expect, it } from "bun:test";
import { APP_MODULES } from "../../src/core/data/app-modules";
import { canRunIsolated } from "../../src/core/windows/run-mode";

describe("run mode", () => {
  it("offers separate windows only for apps with a module", () => {
    expect(canRunIsolated("texts")).toBe(true);
    expect(canRunIsolated("terminal")).toBe(false);
    for (const id of ["texts", "calculator", "image-viewer", "selfies"]) {
      expect(canRunIsolated(id)).toBe(true);
      expect(APP_MODULES.some((m) => m.id === id)).toBe(true);
    }
    expect(APP_MODULES.some((m) => m.id === "texts")).toBe(true);
  });
});
