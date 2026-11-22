/**
 * Typed shell window events (`piloti:*` CustomEvents on `window`).
 *
 * Use `onShellEvent` (returns a disposer — call it in effect cleanup) and
 * `emitShellEvent` instead of raw `addEventListener` / `dispatchEvent` so names
 * and payloads are checked and listeners can't silently drift apart.
 * Iframe ↔ shell postMessage types (`piloti:fs-read`, `piloti:app-action`…) live
 * in `app-bridge.ts`, not here.
 */
export interface ShellEventMap {
  /** Ask the shell to close a window with its close animation. */
  "piloti:request-animated-close": { windowId: string };
  /**
   * Fired before a window closes; cancelable. An app calls `preventDefault()`
   * to keep the window open (e.g. to show its own confirmation).
   */
  "piloti:before-close-window": { windowId: string };
  /** Print the focused window (or `windowId`). */
  "piloti:print-focused": { windowId?: string } | undefined;
  /** Close every transient popup (menus, launcher, popovers). */
  "piloti:dismiss-popups": undefined;
  /** Open Help ▸ Search menus with the field focused (Cmd/Ctrl+K). */
  "piloti:open-command-hud": undefined;
}

export type ShellEventName = keyof ShellEventMap;

/**
 * Dispatches a shell event. Returns `false` when a listener called
 * `preventDefault()` (only meaningful with `cancelable: true`).
 */
export function emitShellEvent<K extends ShellEventName>(
  name: K,
  ...args: undefined extends ShellEventMap[K]
    ? [detail?: ShellEventMap[K], options?: { cancelable?: boolean }]
    : [detail: ShellEventMap[K], options?: { cancelable?: boolean }]
): boolean {
  if (typeof window === "undefined") return true;
  const [detail, options] = args;
  return window.dispatchEvent(
    new CustomEvent(name, { detail, cancelable: Boolean(options?.cancelable) }),
  );
}

/** Subscribes to a shell event; returns the disposer. */
export function onShellEvent<K extends ShellEventName>(
  name: K,
  handler: (detail: ShellEventMap[K], event: CustomEvent<ShellEventMap[K]>) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const ce = e as CustomEvent<ShellEventMap[K]>;
    handler(ce.detail, ce);
  };
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}
