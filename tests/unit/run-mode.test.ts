import { describe, expect, it } from "bun:test";
import { APP_MODULES } from "../../src/core/data/app-modules";
import { getEngine, nativeEngine, setEngine, webEngine } from "../../src/core/ports/engine";
import { canRunIsolated, getRunIn } from "../../src/core/windows/run-mode";

describe("run mode", () => {
  it("offers separate windows only for apps with a module", () => {
    const before = getEngine();
    try {
      setEngine(nativeEngine);
      expect(canRunIsolated("nautilus")).toBe(false);
      for (const id of ["texts", "calculator", "image-viewer", "selfies", "system-monitor", "terminal"]) {
        expect(canRunIsolated(id)).toBe(true);
        expect(APP_MODULES.some((m) => m.id === id)).toBe(true);
      }
      // The demo runs them in an iframe.
      setEngine(webEngine);
      expect(canRunIsolated("terminal")).toBe(true);
    } finally {
      setEngine(before);
    }
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
