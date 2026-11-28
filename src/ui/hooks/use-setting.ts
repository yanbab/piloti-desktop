import * as React from "react";
import type { Settings } from "@/core/state/settings";
import type { SettingValue } from "@/core/ports/settings";

/** One setting as React state: `[value, setValue]`, live when it changes elsewhere. */
export function useSetting<T extends Record<string, SettingValue>, K extends keyof T & string>(
  settings: Settings<T>,
  key: K,
): [T[K], (value: T[K]) => void] {
  const value = React.useSyncExternalStore(
    React.useCallback((onChange) => settings.subscribe(key, onChange), [settings, key]),
    () => settings.get(key),
  );
  const setValue = React.useCallback((next: T[K]) => settings.set(key, next), [settings, key]);
  return [value, setValue];
}
