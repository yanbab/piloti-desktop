import { describe, expect, it } from "bun:test";
import {
  parseRunningSatelliteDisplay,
  parseX11DisplaySockets,
  pickAvailableXDisplay,
  XWAYLAND_SATELLITE_FALLBACK_PATHS,
} from "../../src/lib/engine-desktop/xwayland";

describe("xwayland-satellite helpers", () => {
  it("parses X11 Unix socket listings and picks lowest available display", () => {
    const existing = parseX11DisplaySockets("X0\nX2\nfoo\nX10\n");
    expect(existing).toEqual([0, 2, 10]);
    expect(pickAvailableXDisplay(existing)).toBe(":1");
    expect(pickAvailableXDisplay([])).toBe(":0");
  });

  it("extracts active display argument from running xwayland-satellite process lines", () => {
    expect(
      parseRunningSatelliteDisplay(
        "/usr/local/bin/xwayland-satellite :3\n/usr/bin/qterminal\n"
      )
    ).toBe(":3");
    expect(parseRunningSatelliteDisplay("/usr/bin/Xwayland :0")).toBeNull();
  });

  it("includes local and Projects debug build fallback paths", () => {
    expect(
      XWAYLAND_SATELLITE_FALLBACK_PATHS.some((p) =>
        p.includes("Projets/xwayland-satellite/target/debug/xwayland-satellite")
      )
    ).toBe(true);
    expect(
      XWAYLAND_SATELLITE_FALLBACK_PATHS.some((p) =>
        p.includes(".local/bin/xwayland-satellite")
      )
    ).toBe(true);
  });
});

