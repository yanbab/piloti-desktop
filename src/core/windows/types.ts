/** The shell's windows, as data (`ui/context/WindowsContext.tsx` holds them). */
import type { BuiltinAppId } from "@/core/data/catalog";

export interface DesktopWindowInstance {
  id: string;
  appId: string;
  title: string;
  iconName: string;
  iconUrl?: string;
  builtinComponent?: BuiltinAppId;
  /** Browser demo: the built-in app runs in its own iframe. */
  isolated?: boolean;
  waylandAppId?: string;
  waylandDesktopId?: string;
  pid?: number | null;
  browserWindowId?: string;
  browserUrl?: string;
  browserIsApp?: boolean;
  /** Tabs of a Web Browser window (each one a Domicile browser window);
   *  `browserWindowId` is the active one. Absent for a single page. */
  browserTabs?: BrowserTab[];
  clientFrame?: boolean;
  cursor?: string;
  syncedFrame?: number;
  tiled?: "left" | "right" | null;
  workspace: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  minSize: { width: number; height: number };
  maxSize?: { width: number; height: number };
  minimized: boolean;
  maximized: boolean;
  fullscreen?: boolean;
  pinned?: boolean;
  ready?: boolean;
  zIndex: number;
  payload?: string;
}

/** The tabs of one web window; `pinned` ones are always first in `tabs`. */
export interface BrowserTabGroup {
  tabs: string[];
  active: string;
  pinned?: string[];
}

export interface BrowserTab {
  id: string;
  /** Pinned tabs sit first, as icons. */
  pinned?: boolean;
  url: string;
  title: string;
  iconUrl?: string;
  /** An app (an app module or an installed web app), not a web page. */
  isApp?: boolean;
}

export interface ResolvedPopupWindow {
  appId: string;
  parentToplevelId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  frame: number;
  cursor?: string;
  zIndex: number;
}
