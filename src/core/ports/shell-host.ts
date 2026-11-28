/**
 * The desktop around an app: its windows, read and asked to change. The shell
 * serves it from its window manager; an app module gets it over its channel
 * (`core/apps/module-shell.ts`), the demo's iframe over `postMessage`.
 */

/** One window of the desktop, as an app may see it. */
export interface ShellWindow {
  id: string;
  appId: string;
  title: string;
  /** The process of a Linux client window; unset for the shell's own apps. */
  pid?: number;
}

export interface ShellHost {
  /**
   * The desktop's windows, then again each time they change. A host that
   * already knows them calls at once. Returns stop.
   */
  watchWindows(listener: (windows: readonly ShellWindow[]) => void): () => void;
  /** Closes a window as its close button would (it may still ask first). */
  closeWindow(windowId: string): void;
  focusWindow(windowId: string): void;
}

/** What changes for an app: the same windows in the same order compare equal. */
export const shellWindowsKey = (windows: readonly ShellWindow[]): string =>
  windows.map((w) => `${w.id}\u0000${w.appId}\u0000${w.title}\u0000${w.pid ?? ""}`).join("\u0001");
