/**
 * What Folders and the views it shares with the Desktop (icon grid, folder
 * layout, item menu) take from whoever runs them: the shell, or Folders' own
 * process as a Domicile app module (or the demo's iframe). Hooks, so the
 * shell's can read its contexts and a module's its own sources; nothing under
 * it imports the shell.
 */
import type { AppDragState } from "@/core/apps/module-channel";
import * as React from "react";
import type { DesktopSettings } from "@/core/config/desktop-settings";
import type { XdgDesktopEntry } from "@/core/xdg/xdg-desktop-entry";
import type { MimeAppOption } from "@/core/xdg/xdg-mimeapps";
import type { XdgUserDir } from "@/core/xdg/xdg-user-dirs";
import type { OpenPathOptions } from "@/ui/hooks/use-open-path";

/** A notification from Folders (a failed copy, an ejected drive…). */
export type FilesNotify = (n: { appName: string; summary: string; body: string }) => void;

export interface FilesApps {
  installedXdgApps: XdgDesktopEntry[];
  /** An icon already loaded; asking for one loads it, and the hook draws again. */
  getAppIconUrl: (appIdOrName: string | undefined) => string | undefined;
  /** Loads the icons of these apps, if not yet. */
  ensureWaylandIcons: (ids: readonly string[]) => void;
  xdgUserDirs: XdgUserDir[];
}

export interface FilesActions {
  launchApp: (appId: string, options?: { payload?: string; forceNew?: boolean }) => void;
  launchXdgApp: (entry: XdgDesktopEntry) => void;
  openWebUrl: (url: string) => void;
  updateSettings: (patch: Partial<DesktopSettings>) => void;
  notify: FilesNotify;
}

export interface FilesOpenPath {
  openPath(path: string, options?: OpenPathOptions): Promise<void>;
  openPathWith(path: string, app: MimeAppOption, options?: OpenPathOptions): Promise<void>;
}

export interface FilesHost {
  /** These settings; draws again only when one of them changes. */
  useDesktopSettings<K extends keyof DesktopSettings>(keys: readonly K[]): Pick<DesktopSettings, K>;
  useApps(): FilesApps;
  /** Stable functions. */
  useActions(): FilesActions;
  useOpenPath(): FilesOpenPath;
  /** The desktop's windows (to mark open folders and files), and the focused one. */
  useWindows(): { windows: readonly { appId: string; payload?: string }[]; focusedWindowId: string | null };
  /**
   * Items released outside this window (Folders on its own): the shell drops
   * them where the pointer is, on the Desktop, the Dock or another window.
   * `point` is in this window's coordinates. Unset in the shell.
   */
  dropOutside?(paths: readonly string[], point: { x: number; y: number; copy: boolean }): void;
  /**
   * A drag in this window (Folders on its own): the shell takes it over once
   * the pointer leaves the window, since the window then hears nothing more.
   * Unset in the shell.
   */
  appDrag?: {
    /** These items are being dragged; none: the drag ended here. */
    report(paths: readonly string[]): void;
    /** "outside": the shell draws the drag now; "ended": it dropped or let go. */
    watch(listener: (state: AppDragState) => void): () => void;
  };
}

const FilesHostContext = React.createContext<FilesHost | null>(null);
export const FilesHostProvider = FilesHostContext.Provider;

export function useFilesHost(): FilesHost {
  const host = React.useContext(FilesHostContext);
  if (!host) throw new Error("Folders needs a FilesHostProvider");
  return host;
}
