/** Whether the on-screen keyboard is shown. Not saved: it starts hidden. */
import * as React from "react";

let open = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (next === open) return;
  open = next;
  for (const listener of listeners) listener();
}

export const showOnScreenKeyboard = () => set(true);
export const hideOnScreenKeyboard = () => set(false);
export const toggleOnScreenKeyboard = () => set(!open);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function useOnScreenKeyboardOpen(): boolean {
  return React.useSyncExternalStore(subscribe, () => open, () => false);
}
