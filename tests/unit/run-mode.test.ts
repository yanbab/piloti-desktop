import { describe, expect, it } from "bun:test";
import { APP_MODULES } from "../../src/data/app-modules";
import { canRunIsolated } from "../../src/lib/shell/run-mode";

describe("run mode", () => {
  it("offers separate windows only for apps with a module", () => {
    expect(canRunIsolated("text-editor")).toBe(true);
    expect(canRunIsolated("calculator")).toBe(false);
    expect(APP_MODULES.some((m) => m.id === "text-editor")).toBe(true);
  });
});
