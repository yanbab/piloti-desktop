import type { BatteryInfo } from "@/lib/ports/hardware";

export interface BatteryManagerLike extends EventTarget {
  level: number;
  charging: boolean;
  chargingTime?: number;
  dischargingTime?: number;
}

export type BatteryNavigatorLike = {
  getBattery?: () => Promise<BatteryManagerLike>;
};

export function batteryFromManager(manager: Pick<BatteryManagerLike, "level" | "charging">): BatteryInfo {
  const rawPct = Number.isFinite(manager.level) ? Math.round(manager.level * 100) : 100;
  return {
    present: true,
    percentage: Math.max(0, Math.min(100, rawPct)),
    charging: Boolean(manager.charging),
  };
}

/**
 * Subscribes to the Web Battery Status API (`navigator.getBattery()`) when
 * supported by the browser. Reports `{ present: false }` cleanly on browsers
 * without `getBattery` support (e.g., Firefox / Safari).
 */
export function subscribeWebBattery(
  onUpdate: (info: BatteryInfo) => void,
  nav: BatteryNavigatorLike | undefined =
    typeof navigator !== "undefined"
      ? (navigator as unknown as BatteryNavigatorLike)
      : undefined
): () => void {
  if (!nav || typeof nav.getBattery !== "function") {
    onUpdate({ present: false, percentage: 100, charging: true });
    return () => {};
  }

  let cancelled = false;
  let managerRef: BatteryManagerLike | null = null;
  const handleChange = () => {
    if (!cancelled && managerRef) {
      onUpdate(batteryFromManager(managerRef));
    }
  };

  void nav
    .getBattery()
    .then((manager) => {
      if (cancelled || !manager) return;
      managerRef = manager;
      onUpdate(batteryFromManager(manager));
      manager.addEventListener("levelchange", handleChange);
      manager.addEventListener("chargingchange", handleChange);
    })
    .catch(() => {
      if (!cancelled) {
        onUpdate({ present: false, percentage: 100, charging: true });
      }
    });

  return () => {
    cancelled = true;
    if (managerRef) {
      managerRef.removeEventListener("levelchange", handleChange);
      managerRef.removeEventListener("chargingchange", handleChange);
      managerRef = null;
    }
  };
}

