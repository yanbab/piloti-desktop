/**
 * `ShellHost` for an app module, over its channel: it tells the shell what it
 * watches in its window state, and the shell sends the windows when they change.
 */
import type { createModuleChannel } from "@/core/apps/module-channel";
import type { ShellHost, ShellWindow } from "@/core/ports/shell-host";

type Channel = Pick<ReturnType<typeof createModuleChannel>, "publish" | "onWindows" | "request">;

export function createModuleShell(channel: Channel): ShellHost {
  const listeners = new Set<(windows: readonly ShellWindow[]) => void>();
  let known: readonly ShellWindow[] | null = null;
  channel.onWindows((windows) => {
    known = windows;
    listeners.forEach((l) => l(windows));
  });

  return {
    watchWindows(listener) {
      listeners.add(listener);
      // The first watcher asks; the shell answers with the windows at once.
      if (listeners.size === 1) void channel.publish({ watch: ["windows"] });
      else if (known) listener(known);
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        known = null;
        void channel.publish({ watch: [] });
      };
    },
    closeWindow: (windowId) => void channel.request({ do: "close-window", windowId }),
    focusWindow: (windowId) => void channel.request({ do: "focus-window", windowId }),
  };
}
