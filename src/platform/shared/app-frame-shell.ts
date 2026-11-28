/** `ShellHost` for an app in the demo's iframe: the page around it answers. */
import type { ShellHost, ShellWindow } from "@/core/ports/shell-host";
import { postToShell, type ShellToAppMessage } from "@/platform/shared/app-bridge";

export function createFrameShellHost(windowId: string): ShellHost {
  const listeners = new Set<(windows: readonly ShellWindow[]) => void>();
  const onMessage = (e: MessageEvent) => {
    const data = e.data as ShellToAppMessage | undefined;
    if (data?.type === "piloti:shell-windows") listeners.forEach((l) => l(data.windows));
  };
  return {
    watchWindows(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        window.addEventListener("message", onMessage);
        postToShell({ type: "piloti:shell-request", windowId, request: { do: "watch-windows", on: true } });
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        window.removeEventListener("message", onMessage);
        postToShell({ type: "piloti:shell-request", windowId, request: { do: "watch-windows", on: false } });
      };
    },
    closeWindow: (target) =>
      postToShell({ type: "piloti:shell-request", windowId, request: { do: "close-window", windowId: target } }),
    focusWindow: (target) =>
      postToShell({ type: "piloti:shell-request", windowId, request: { do: "focus-window", windowId: target } }),
  };
}
