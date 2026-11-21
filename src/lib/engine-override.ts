import * as React from "react";

export type RuntimeEngineMode = "web" | "system";

export const ENGINE_OVERRIDE_STORAGE_KEY = "piloti.engine-override";
export const ENGINE_OVERRIDE_CHANGED_EVENT = "piloti:engine-override-changed";

declare global {
  interface Window {
    __PILOTI_NATIVE_SYSTEM_HOST__?: boolean;
  }
}

/**
 * Records whether the session originally booted with a native Domicile Linux host
 * (so switching `engine:system -> engine:web -> engine:system` knows system mode is available).
 */
export function markNativeSystemHostAvailable(): void {
  if (typeof window !== "undefined") {
    window.__PILOTI_NATIVE_SYSTEM_HOST__ = true;
  }
}

export function hasNativeSystemHost(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.__PILOTI_NATIVE_SYSTEM_HOST__)
  );
}

export function getEngineOverride(): RuntimeEngineMode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ENGINE_OVERRIDE_STORAGE_KEY);
    return raw === "web" || raw === "system" ? raw : null;
  } catch {
    return null;
  }
}

export function setEngineOverride(mode: RuntimeEngineMode | null): void {
  if (typeof window === "undefined") return;
  try {
    if (mode === null) {
      window.localStorage.removeItem(ENGINE_OVERRIDE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(ENGINE_OVERRIDE_STORAGE_KEY, mode);
    }
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(new Event(ENGINE_OVERRIDE_CHANGED_EVENT));
}

export function useEngineOverride(): RuntimeEngineMode | null {
  const [override, setOverride] = React.useState<RuntimeEngineMode | null>(() =>
    getEngineOverride()
  );
  React.useEffect(() => {
    const update = () => setOverride(getEngineOverride());
    window.addEventListener(ENGINE_OVERRIDE_CHANGED_EVENT, update);
    return () => {
      window.removeEventListener(ENGINE_OVERRIDE_CHANGED_EVENT, update);
    };
  }, []);
  return override;
}

