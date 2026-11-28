/** The shell's windows as an app sees them (`core/ports/shell-host.ts`). */
import type { ShellWindow } from "@/core/ports/shell-host";
import type { DesktopWindowInstance } from "@/core/windows/types";

export function toShellWindows(
  windows: readonly Pick<DesktopWindowInstance, "id" | "appId" | "title" | "pid">[],
): ShellWindow[] {
  return windows.map(({ id, appId, title, pid }) => (pid ? { id, appId, title, pid } : { id, appId, title }));
}
