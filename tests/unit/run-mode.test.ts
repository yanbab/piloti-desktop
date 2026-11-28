import { describe, expect, it } from "bun:test";
import { APP_MODULES } from "../../src/core/data/app-modules";
import { getEngine, nativeEngine, setEngine, webEngine } from "../../src/core/ports/engine";
import { canRunIsolated, getRunIn } from "../../src/core/windows/run-mode";

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

  it("runs the editor and the viewer on their own on Linux, unless chosen", () => {
    const before = getEngine();
    try {
      setEngine(nativeEngine);
      expect(getRunIn("texts")).toBe("isolated");
      expect(getRunIn("image-viewer")).toBe("isolated");
      expect(getRunIn("calculator")).toBe("shell");
      expect(getRunIn("terminal")).toBe("shell");
      setEngine(webEngine);
      expect(getRunIn("texts")).toBe("shell");
    } finally {
      setEngine(before);
    }
  });
});
