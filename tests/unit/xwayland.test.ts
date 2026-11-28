import { describe, expect, it } from "bun:test";
import type { Piloti } from "@/platform/shared/piloti";
import {
  ensureXwaylandSatellite,
  parseRunningSatelliteDisplay,
  parseX11DisplaySockets,
  pickAvailableXDisplay,
  resetXwaylandCacheForTest,
  XWAYLAND_SATELLITE_FALLBACK_PATHS,
} from "@/platform/native/xwayland";

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


describe("root access to the display", () => {
  it("grants it once on a running satellite", async () => {
    resetXwaylandCacheForTest();
    const calls: string[][] = [];
    const piloti = {
      processes: {
        run: async (argv: string[]) => {
          calls.push(argv);
          const stdout = "ENV_DISPLAY=\nX3\n---\n/usr/bin/xwayland-satellite :3\n";
          return { match: (m: { Ok: (r: unknown) => unknown }) => m.Ok({ code: 0, stdout }) };
        },
      },
    } as unknown as Piloti;
    expect(await ensureXwaylandSatellite(piloti)).toBe(":3");
    expect(await ensureXwaylandSatellite(piloti)).toBe(":3");
    const grants = calls.filter((argv) => argv[2]?.includes("xhost +si:localuser:root"));
    expect(grants.map((argv) => argv.at(-1))).toEqual([":3"]);
    resetXwaylandCacheForTest();
  });
});
