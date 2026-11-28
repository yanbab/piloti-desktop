/** The window manager's shapes (`context/WindowsContext.tsx` provides them). */
import type {
  DesktopWindowInstance,
  BrowserTab,
  ResolvedPopupWindow,
  WindowPlacement,
} from "@/core/windows/types";
import type { WindowRequest } from "@domicile-desktop/sdk/window-state";
import type { AppDefinition } from "@/core/data/catalog";
import type { XdgDesktopEntry } from "xdg-desktop-entry";
import type { GnomeSettingsPanel } from "@/platform/shared/desktop-integration";

export type { DesktopWindowInstance, BrowserTab, ResolvedPopupWindow };

export interface WindowsContextValue {
  windows: DesktopWindowInstance[];
  workspaceWindows: DesktopWindowInstance[];
  waylandPopups: ResolvedPopupWindow[];
  focusedWindowId: string | null;
  focusedWindow: DesktopWindowInstance | undefined;
  clearFocusedWindow: () => void;
  activeAppDef: AppDefinition;
  mruWindows: DesktopWindowInstance[];
  launchingApps: string[];
  markWindowReady: (windowId: string) => void;
  launchApp: (
    appId: string,
    options?: { payload?: string; forceNew?: boolean; forceCsd?: boolean }
  ) => void;
  launchXdgApp: (entry: XdgDesktopEntry, actionId?: string) => void;
  /** Opens a file with an installed application, with startup feedback. */
  openFileWithXdgApp: (entry: XdgDesktopEntry, path: string) => void;
  openGnomeSettings: (panel?: GnomeSettingsPanel | (string & {})) => void;
  openWebUrl: (
    rawUrl: string,
    options?: { asApp?: boolean; appId?: string; title?: string }
  ) => void;
  setBrowserFavicon: (browserWindowId: string, favicon: string) => void;
  setBrowserTitle: (browserWindowId: string, title: string) => void;
  /** Opens `url` (or the start page) in a new tab of Web Browser window `windowId`. */
  openBrowserTab: (windowId: string, url?: string) => void;
  /** Opens app module `moduleId` as a tab of Web Browser window `windowId` (native only). */
  openModuleTab: (windowId: string, moduleId: string) => void;
  selectBrowserTab: (windowId: string, tabId: string) => void;
  closeBrowserTab: (windowId: string, tabId: string) => void;
  /** Puts a window's tabs in the given order (same set of ids). */
  reorderBrowserTabs: (windowId: string, tabIds: string[]) => void;
  /** Moves a tab to a window of its own, at `at` when given; returns its id. */
  detachBrowserTab: (
    windowId: string,
    tabId: string,
    at?: { x: number; y: number }
  ) => string | undefined;
  /** Moves a tab into another Web Browser window, at `index` among its tabs. */
  moveBrowserTab: (fromWindowId: string, tabId: string, toWindowId: string, index: number) => void;
  pinBrowserTab: (windowId: string, tabId: string, pinned: boolean) => void;
  /** Opens the tab closed last again, in this window. */
  reopenClosedBrowserTab: (windowId: string) => void;
  focusWindow: (windowId: string) => void;
  closeWindow: (windowId: string) => void;
  forceQuitApp: (appId: string) => void;
  toggleMinimizeWindow: (windowId: string) => void;
  minimizeWindow: (windowId: string) => void;
  toggleMaximizeWindow: (windowId: string) => void;
  tileWindow: (windowId: string, side: "left" | "right" | "full") => void;
  updateWindowGeometry: (
    windowId: string,
    patch: {
      position?: { x: number; y: number };
      size?: { width: number; height: number };
    }
  ) => void;
  handleMenuAction: (actionId: string) => void;
  launcherOpen: boolean;
  setLauncherOpen: React.Dispatch<React.SetStateAction<boolean>>;
  controlPanelOpen: boolean;
  setControlPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  aboutOpen: boolean;
  setAboutOpen: React.Dispatch<React.SetStateAction<boolean>>;
  altTabOpen: boolean;
  altTabIndex: number;
  setAltTabIndex: React.Dispatch<React.SetStateAction<number>>;
  openAltTab: () => void;
  cycleAltTab: (delta: number) => void;
  commitAltTab: (explicitWindowId?: string) => void;
  closeAltTab: () => void;
  overviewOpen: boolean;
  setOverviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleOverview: () => void;
  moveWindowToWorkspace: (windowId: string, workspace: number) => void;
  removeWorkspace: (workspace: number) => void;
  registerDockRef: (appId: string, node: HTMLElement | null) => void;
  getDockRef: (appId: string) => React.RefObject<Element | null>;
  subscribeClientWindowRequest: (
    listener: (req: WindowRequest) => void
  ) => () => void;
}

export type WindowActionsValue = Pick<
  WindowsContextValue,
  | "launchApp"
  | "launchXdgApp"
  | "openFileWithXdgApp"
  | "markWindowReady"
  | "openGnomeSettings"
  | "openWebUrl"
  | "focusWindow"
  | "closeWindow"
  | "forceQuitApp"
  | "toggleMinimizeWindow"
  | "minimizeWindow"
  | "toggleMaximizeWindow"
  | "tileWindow"
  | "updateWindowGeometry"
  | "handleMenuAction"
  | "setLauncherOpen"
  | "setControlPanelOpen"
  | "setAboutOpen"
  | "setOverviewOpen"
  | "toggleOverview"
  | "moveWindowToWorkspace"
  | "removeWorkspace"
  | "openAltTab"
>;

/** What the shell keeps about a window Domicile lists (Wayland or browser). */
export interface ExternalWindowMeta extends WindowPlacement {
  /** Opened by the Web Browser: grouped under its Dock icon whatever the page. */
  browserApp?: boolean;
}
