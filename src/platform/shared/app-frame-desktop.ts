/** The desktop settings in the demo's iframe: the page around it has them. */
import { DEFAULT_SETTINGS, type DesktopSettings } from "@/core/config/desktop-settings";
import { parseDesktopSettingsRaw } from "@/core/config/piloti-settings-ini";
import { SHELL_SETTINGS_PATH } from "@/core/state/settings";
import { readVfsStateText } from "@/core/state/vfs-state";
import { type FrameRequest, postToShell, type ShellToAppMessage } from "@/platform/shared/app-bridge";

export interface FrameDesktop {
  current(): DesktopSettings;
  /** Called on each change. Returns stop. */
  watch(listener: (settings: DesktopSettings) => void): () => void;
  update(patch: Partial<DesktopSettings>): void;
}

export function frameDesktop(windowId: string): FrameDesktop {
  const raw = readVfsStateText(SHELL_SETTINGS_PATH);
  let settings: DesktopSettings = { ...DEFAULT_SETTINGS, ...(raw ? parseDesktopSettingsRaw(raw) : null) };
  const listeners = new Set<(settings: DesktopSettings) => void>();
  const onMessage = (e: MessageEvent) => {
    const data = e.data as ShellToAppMessage | undefined;
    if (data?.type !== "piloti:desktop-settings") return;
    settings = data.settings;
    listeners.forEach((l) => l(settings));
  };
  const request = (request: FrameRequest) => postToShell({ type: "piloti:shell-request", windowId, request });
  return {
    current: () => settings,
    watch(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        addEventListener("message", onMessage);
        request({ do: "watch-settings", on: true });
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        removeEventListener("message", onMessage);
        request({ do: "watch-settings", on: false });
      };
    },
    update: (patch) => request({ do: "update-settings", patch }),
  };
}
