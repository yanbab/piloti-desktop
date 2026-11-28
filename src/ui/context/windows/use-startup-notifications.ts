import * as React from "react";
import { canonicalizeWebUrl } from "@/core/data/web-apps";
import type { DesktopWindowInstance } from "./types";

/** XDG Startup Notification: the apps being launched, until a window of theirs is ready. */
export function useStartupNotifications(combinedWindows: readonly DesktopWindowInstance[]) {
  const [launchingApps, setLaunchingApps] = React.useState<string[]>([]);
  const launchingTimersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const launchingStartedAtRef = React.useRef<Map<string, number>>(new Map());
  const launchingClearTimersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const beginStartupNotification = React.useCallback((appId: string) => {
    launchingStartedAtRef.current.set(appId, Date.now());
    const pendingClear = launchingClearTimersRef.current.get(appId);
    if (pendingClear) {
      clearTimeout(pendingClear);
      launchingClearTimersRef.current.delete(appId);
    }
    setLaunchingApps((prev) => (prev.includes(appId) ? prev : [...prev, appId]));
    const existingTimer = launchingTimersRef.current.get(appId);
    if (existingTimer) clearTimeout(existingTimer);
    // Per XDG Startup Notification Spec, clear launching state after timeout if no window maps
    const timer = setTimeout(() => {
      launchingTimersRef.current.delete(appId);
      launchingStartedAtRef.current.delete(appId);
      setLaunchingApps((prev) => prev.filter((id) => id !== appId));
    }, 15000);
    launchingTimersRef.current.set(appId, timer);
  }, []);

  // Clear XDG Startup Notification launching state when a matching ready window appears
  // (after a brief minimum bounce so Dock feedback is visible for fast built-in apps).
  React.useEffect(() => {
    if (launchingApps.length === 0) return;
    const readyWindows = combinedWindows.filter((w) => w.ready !== false);
    const runningIds = new Set(
      readyWindows.flatMap((w) => [
        w.appId.toLowerCase(),
        (w.waylandAppId ?? "").toLowerCase(),
      ])
    );
    const readyWebCanonicals = new Set(
      readyWindows
        .map((w) => canonicalizeWebUrl(w.browserUrl))
        .filter((u): u is string => Boolean(u))
    );
    const completed = launchingApps.filter((id) => {
      const lower = id.toLowerCase();
      const base = lower.replace(/\.desktop$/, "");
      if (runningIds.has(lower) || runningIds.has(base)) return true;
      if (id.startsWith("webview:")) {
        const canonical = canonicalizeWebUrl(id.slice("webview:".length));
        if (canonical && readyWebCanonicals.has(canonical)) return true;
      }
      return false;
    });
    if (completed.length > 0) {
      const immediate: string[] = [];
      for (const id of completed) {
        const timer = launchingTimersRef.current.get(id);
        if (timer) {
          clearTimeout(timer);
          launchingTimersRef.current.delete(id);
        }
        const startedAt = launchingStartedAtRef.current.get(id) ?? 0;
        const remaining = 700 - (Date.now() - startedAt);
        if (remaining <= 0) {
          launchingStartedAtRef.current.delete(id);
          immediate.push(id);
        } else if (!launchingClearTimersRef.current.has(id)) {
          const clearTimer = setTimeout(() => {
            launchingClearTimersRef.current.delete(id);
            launchingStartedAtRef.current.delete(id);
            setLaunchingApps((prev) => prev.filter((item) => item !== id));
          }, remaining);
          launchingClearTimersRef.current.set(id, clearTimer);
        }
      }
      if (immediate.length > 0) {
        setLaunchingApps((prev) => prev.filter((id) => !immediate.includes(id)));
      }
    }
  }, [combinedWindows, launchingApps]);

  React.useEffect(() => {
    const timers = launchingTimersRef.current;
    const clearTimers = launchingClearTimersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      for (const timer of clearTimers.values()) clearTimeout(timer);
      clearTimers.clear();
    };
  }, []);

  const endStartupNotification = React.useCallback((appId: string) => {
    setLaunchingApps((prev) => prev.filter((id) => id !== appId));
  }, []);

  return { launchingApps, beginStartupNotification, endStartupNotification };
}
