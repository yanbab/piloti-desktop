/**
 * What the Terminal needs from whoever runs it: the shell, or its own process
 * as a Domicile app module. `XtermTerminalApp` imports nothing of the shell.
 */
import type { DesktopSettings } from "@/core/config/desktop-settings";
import type { Apps } from "@/core/ports/apps";
import type { ShellHost } from "@/core/ports/shell-host";
import type { Vfs } from "@/core/ports/vfs";
import type { SystemSample } from "@/core/system/system-stats";
import type { Piloti } from "@/platform/shared/piloti";

/** Programs, pseudo-terminals and `/etc/shells`. */
export interface TerminalSystem {
  files: Pick<Piloti["files"], "readText" | "stat">;
  processes: Pick<Piloti["processes"], "run" | "spawn">;
}

export interface TerminalHost {
  vfs: Vfs;
  /** In the demo, its made-up files; programs run only where `simulatedProcesses` is false. */
  system: TerminalSystem;
  shell: ShellHost;
  apps: Pick<Apps, "list">;
  /** Opens an app (its id), with a path or pane. */
  launch(appId: string, payload?: string): void;
  /** Opens a file or folder with its application. */
  open(path: string, kind: "file" | "directory"): void;
  notify(notification: { summary: string; body?: string }): void;
  /** The desktop's settings: the prompt's accent, fonts, and `settings()` / `set()`. */
  desktop: {
    current(): DesktopSettings;
    watch(listener: (settings: DesktopSettings) => void): () => void;
    update(patch: Partial<DesktopSettings>): void;
  };
  readSample(): Promise<SystemSample | null>;
  /** What `piloti` and `files` name in Piloti Shell. */
  globals: { piloti: unknown; files: unknown };
  /** Whether the window has the keyboard, now and as it changes. */
  watchFocus(listener: (focused: boolean) => void): () => void;
  /** Edit ▸ Select All for this window. */
  onSelectAll(listener: () => void): () => void;
  /** The demo has no processes: its apps are given made-up ones. */
  simulatedProcesses: boolean;
}

