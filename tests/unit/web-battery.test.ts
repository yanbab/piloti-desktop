import { describe, expect, it } from "bun:test";
import type { BatteryInfo } from "@/lib/ports/hardware";
import {
  type BatteryManagerLike,
  batteryFromManager,
  subscribeWebBattery,
} from "@/lib/engine-web/web-battery";

class FakeBatteryManager extends EventTarget implements BatteryManagerLike {
  level: number;
  charging: boolean;
  constructor(level: number, charging: boolean) {
    super();
    this.level = level;
    this.charging = charging;
  }
}

describe("web battery helpers", () => {
  it("clamps and converts BatteryManager values cleanly", () => {
    expect(batteryFromManager({ level: 0.724, charging: false })).toEqual({
      present: true,
      percentage: 72,
      charging: false,
    });
    expect(batteryFromManager({ level: 1.2, charging: true })).toEqual({
      present: true,
      percentage: 100,
      charging: true,
    });
    expect(batteryFromManager({ level: -0.5, charging: false })).toEqual({
      present: true,
      percentage: 0,
      charging: false,
    });
  });

  it("reports absent battery when navigator.getBattery is unavailable", () => {
    const updates: BatteryInfo[] = [];
    const stop = subscribeWebBattery((info) => updates.push(info), {});
    stop();
    expect(updates).toEqual([{ present: false, percentage: 100, charging: true }]);
  });

  it("reads initial status and tracks live levelchange and chargingchange events", async () => {
    const fakeManager = new FakeBatteryManager(0.64, true);
    const updates: BatteryInfo[] = [];

    const stop = subscribeWebBattery(
      (info) => updates.push(info),
      { getBattery: async () => fakeManager }
    );

    await Promise.resolve();
    fakeManager.level = 0.41;
    fakeManager.charging = false;
    fakeManager.dispatchEvent(new Event("levelchange"));

    stop();
    fakeManager.level = 0.2;
    fakeManager.dispatchEvent(new Event("levelchange"));

    expect(updates).toEqual([
      { present: true, percentage: 64, charging: true },
      { present: true, percentage: 41, charging: false },
    ]);
  });
});

