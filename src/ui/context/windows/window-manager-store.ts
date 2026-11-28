import * as React from "react";
import type { WindowsContextValue } from "@/ui/context/WindowsContext";

/**
 * External-store views of the window manager / settings so components can
 * subscribe to a *slice*. `useWindowManager()` / `useSettings()` re-render on
 * every change (focus, drag commit, saved window bounds…); the selector hooks
 * only when the selected value changes according to `isEqual`.
 */
export interface SelectorStore<T> {
  get: () => T;
  subscribe: (listener: () => void) => () => void;
}

export type WindowManagerStore = SelectorStore<WindowsContextValue>;

export const WindowManagerStoreContext =
  React.createContext<WindowManagerStore | null>(null);

/** Creates a store whose `notify()` the provider calls after each commit. */
export function createSelectorStore<T>(
  get: () => T,
): SelectorStore<T> & { notify: () => void } {
  const listeners = new Set<() => void>();
  return {
    get,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    notify() {
      for (const listener of [...listeners]) listener();
    },
  };
}

export const createWindowManagerStore = createSelectorStore<WindowsContextValue>;

export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) {
      return false;
    }
  }
  return true;
}

/** Arrays of plain objects compared item-by-item with `shallowEqual`. */
export function shallowArrayEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (!shallowEqual(a[i], b[i])) return false;
  }
  return true;
}

/** Shallow-compares each top-level field, using `shallowArrayEqual` for arrays. */
export function selectionEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return shallowArrayEqual(a, b);
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const ka = Object.keys(a as object);
  if (ka.length !== Object.keys(b as object).length) return false;
  for (const k of ka) {
    const va = (a as Record<string, unknown>)[k];
    const vb = (b as Record<string, unknown>)[k];
    if (Object.is(va, vb)) continue;
    if (Array.isArray(va) && Array.isArray(vb) && shallowArrayEqual(va, vb)) continue;
    if (
      va && vb && typeof va === "object" && typeof vb === "object" &&
      !Array.isArray(va) && !Array.isArray(vb) && shallowEqual(va, vb)
    ) {
      continue;
    }
    return false;
  }
  return true;
}

/** Subscribes to a slice of any `SelectorStore`. */
export function useStoreSelector<S, T>(
  store: SelectorStore<S>,
  selector: (state: S) => T,
  isEqual: (a: T, b: T) => boolean = selectionEqual,
): T {
  const selectorRef = React.useRef(selector);
  selectorRef.current = selector;
  const isEqualRef = React.useRef(isEqual);
  isEqualRef.current = isEqual;
  const cacheRef = React.useRef<{ value: T } | null>(null);
  const getSnapshot = React.useCallback(() => {
    const next = selectorRef.current(store.get());
    const cached = cacheRef.current;
    if (cached && isEqualRef.current(cached.value, next)) return cached.value;
    cacheRef.current = { value: next };
    return next;
  }, [store]);
  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

/**
 * Subscribes to a slice of the window manager. The default equality is
 * `selectionEqual` (top-level fields, arrays of objects compared shallowly), so
 * return plain objects/arrays of primitives and stable callbacks.
 */
export function useWindowManagerSelector<T>(
  selector: (wm: WindowsContextValue) => T,
  isEqual: (a: T, b: T) => boolean = selectionEqual,
): T {
  const store = React.useContext(WindowManagerStoreContext);
  if (!store) {
    throw new Error("useWindowManagerSelector must be used within DesktopStateProvider");
  }
  return useStoreSelector(store, selector, isEqual);
}
