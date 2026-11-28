import { describe, expect, it } from "bun:test";
import {
  type NotificationPolicySettings,
  clampHistoryLimit,
  formatRelativeNotificationTime,
  loadLocalNotificationHistory,
  loadReadNotificationIds,
  resolveNotificationTimeoutMs,
  saveLocalNotificationHistory,
  saveReadNotificationIds,
  shouldShowNotificationBanner,
} from "@/core/system/notifications";

const BASE_POLICY: NotificationPolicySettings = {
  notificationsEnabled: true,
  notificationBannersEnabled: true,
  notificationShowOnLockScreen: true,
  notificationShowPreviews: true,
  notificationAllowCriticalInDnd: true,
  notificationBannerTimeoutMs: 5000,
  notificationHistoryLimit: 50,
  doNotDisturb: false,
};

describe("notifications policy helpers", () => {
  it("evaluates banner visibility across DND, lock screen, and master toggles", () => {
    expect(
      shouldShowNotificationBanner({ urgency: "normal" }, BASE_POLICY, false)
    ).toBe(true);

    expect(
      shouldShowNotificationBanner(
        { urgency: "normal" },
        { ...BASE_POLICY, notificationsEnabled: false },
        false
      )
    ).toBe(false);

    expect(
      shouldShowNotificationBanner(
        { urgency: "normal" },
        { ...BASE_POLICY, notificationBannersEnabled: false },
        false
      )
    ).toBe(false);

    expect(
      shouldShowNotificationBanner(
        { urgency: "normal" },
        { ...BASE_POLICY, doNotDisturb: true },
        false
      )
    ).toBe(false);

    expect(
      shouldShowNotificationBanner(
        { urgency: "critical" },
        { ...BASE_POLICY, doNotDisturb: true, notificationAllowCriticalInDnd: true },
        false
      )
    ).toBe(true);

    expect(
      shouldShowNotificationBanner(
        { urgency: "critical" },
        {
          ...BASE_POLICY,
          doNotDisturb: true,
          notificationAllowCriticalInDnd: false,
        },
        false
      )
    ).toBe(false);

    expect(
      shouldShowNotificationBanner(
        { urgency: "normal" },
        { ...BASE_POLICY, notificationShowOnLockScreen: false },
        true
      )
    ).toBe(false);
  });

  it("resolves banner timeouts per FreeDesktop urgency and settings", () => {
    expect(
      resolveNotificationTimeoutMs({ urgency: "critical", timeoutMs: 3000 }, 5000)
    ).toBe(0);
    expect(
      resolveNotificationTimeoutMs({ urgency: "normal", timeoutMs: 2500 }, 5000)
    ).toBe(2500);
    expect(
      resolveNotificationTimeoutMs(
        { urgency: "normal", timeoutMs: undefined },
        8000
      )
    ).toBe(8000);
    expect(
      resolveNotificationTimeoutMs({ urgency: "low", timeoutMs: undefined }, 0)
    ).toBe(0);
  });

  it("clamps history retention limits safely", () => {
    expect(clampHistoryLimit(undefined)).toBe(50);
    expect(clampHistoryLimit(1)).toBe(5);
    expect(clampHistoryLimit(999)).toBe(200);
    expect(clampHistoryLimit(75)).toBe(75);
  });

  it("formats relative notification timestamps accurately", () => {
    const now = 1_700_000_000_000;
    expect(formatRelativeNotificationTime(now - 20_000, now)).toBe("Just now");
    expect(formatRelativeNotificationTime(now - 5 * 60_000, now)).toBe("5m ago");
    expect(formatRelativeNotificationTime(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(formatRelativeNotificationTime(now - 2 * 86_400_000, now)).toBe("2d ago");
  });

  it("persists local history and read IDs when localStorage is available", () => {
    const store = new Map<string, string>();
    const prevStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });

    try {
      saveLocalNotificationHistory(
        [
          {
            id: 5001,
            appName: "Screenshot",
            summary: "Saved",
            body: "/tmp/shot.png",
            urgency: "normal",
            time: 1000,
          },
          {
            id: 5002,
            appName: "Network",
            summary: "Connected",
            body: "Wi-Fi online",
            urgency: "normal",
            time: 2000,
          },
        ],
        10
      );
      const loaded = loadLocalNotificationHistory(10);
      expect(loaded.map((n) => n.id)).toEqual([5002, 5001]);

      saveReadNotificationIds(new Set([5001, 5002]));
      expect(Array.from(loadReadNotificationIds())).toEqual([5001, 5002]);
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: prevStorage,
      });
    }
  });
});

