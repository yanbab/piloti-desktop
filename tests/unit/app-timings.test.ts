import { describe, expect, test } from "bun:test";
import { appTimings, logAppLaunch, recordAppReady, setAppMemory } from "@/core/util/perf-log";
import { parseRendererMemory } from "@/platform/shared/system-commands";
import { describeStarts } from "@/ui/apps/console/AppsModule";

describe("app start measures", () => {
  test("counts each launch once, by the way the app ran", () => {
    const before = appTimings().length;
    logAppLaunch("demo-app");
    recordAppReady("demo-app", true);
    recordAppReady("demo-app", true);
    expect(appTimings().length).toBe(before + 1);
    const timing = appTimings()[appTimings().length - 1]!;
    expect(timing).toMatchObject({ appId: "demo-app", separate: true });
    setAppMemory(timing, 148 * 1024);
    expect(describeStarts([timing])).toContain("+148 MB");
    expect(describeStarts([])).toBe("—");
  });

  test("sums the renderers only", () => {
    const ps = " 1000 /usr/lib/chromium --type=renderer --a\n 500 /usr/lib/chromium --type=gpu\n2000 x --type=renderer\n";
    expect(parseRendererMemory(ps)).toEqual({ count: 2, totalKb: 3000 });
  });
});
