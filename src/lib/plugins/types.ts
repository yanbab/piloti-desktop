import type { Piloti } from "@/lib/engine/piloti";
import type {
  WindowMenuItem,
  WindowPresentation,
  WorkArea,
} from "@/lib/windows/window-presentation";

export type { WindowMenuItem, WindowPresentation, WorkArea };

/** A window as plugins see it (geometry in work-area coordinates). */
export interface PluginWindowInfo {
  id: string;
  appId: string;
  title: string;
  workspace: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  minimized: boolean;
  maximized: boolean;
}

export interface PluginCommandManifest {
  id: string;
  title: string;
  keywords?: string;
  exec?: string[];
  url?: string;
  appId?: string;
}

export interface PluginWallpaperManifest {
  id: string;
  name: string;
  subtitle?: string;
  type?: "css" | "html" | "image";
  style?: string;
  darkStyle?: string;
  html?: string;
  darkHtml?: string;
  image?: string;
  darkImage?: string;
  backgroundCss?: string;
}

export interface PluginManifest {
  id?: string;
  name?: string;
  type?: "plugin" | "theme";
  version?: string;
  description?: string;
  style?: string;
  gtk4Style?: string;
  gtk3Style?: string;
  script?: string;
  main?: string;
  commands?: PluginCommandManifest[];
  wallpapers?: PluginWallpaperManifest[];
}

export interface DiscoveredPlugin {
  id: string;
  name: string;
  kind?: "plugin" | "theme";
  scope?: "system" | "user";
  version?: string;
  description?: string;
  sourceType: "css" | "js" | "folder";
  entryPath: string;
  stylePath?: string;
  gtk4StylePath?: string;
  gtk3StylePath?: string;
  scriptPath?: string;
  hasManifest: boolean;
  commands: PluginCommandManifest[];
  wallpapers?: PluginWallpaperManifest[];
  enabled: boolean;
  error?: string;
}

export interface PluginWallpaperInput {
  id: string;
  name: string;
  subtitle?: string;
  kind?: "static" | "css" | "html";
  backgroundCss?: string;
  backgroundCssDark?: string;
  cssAnimation?: string;
  cssAnimationDark?: string;
  htmlSrcDoc?: string;
  htmlSrcDocDark?: string;
  imageUrl?: string;
  imageUrlDark?: string;
}

export interface PluginWallpaperEntry extends PluginWallpaperInput {
  pluginId: string;
  fullId: string;
}

export interface MenuBarStatusItemInput {
  id: string;
  label: string;
  tooltip?: string;
  onClick?: () => void;
}

export interface MenuBarStatusItem extends MenuBarStatusItemInput {
  pluginId: string;
  fullId: string;
}

export interface MenuBarStatusItemHandle {
  update: (patch: Partial<MenuBarStatusItemInput>) => void;
  remove: () => void;
}

export interface PluginCommandEntry {
  pluginId: string;
  id: string;
  title: string;
  keywords?: string;
  run: () => void;
}

export interface LauncherProviderResult {
  id: string;
  title: string;
  subtitle?: string;
  keywords?: string;
}

export interface LauncherProvider {
  pluginId: string;
  id: string;
  search: (query: string) => LauncherProviderResult[] | Promise<LauncherProviderResult[]>;
  onSelect: (item: LauncherProviderResult) => void;
}

export interface PilotiPluginContext {
  pluginId: string;
  menubar: {
    addStatusItem: (item: MenuBarStatusItemInput) => MenuBarStatusItemHandle;
  };
  launcher: {
    registerProvider: (provider: Omit<LauncherProvider, "pluginId">) => () => void;
  };
  commands: {
    register: (cmd: Omit<PluginCommandEntry, "pluginId">) => () => void;
  };
  wallpapers: {
    register: (wallpaper: PluginWallpaperInput) => () => void;
  };
  windows: {
    openWebUrl: (url: string, title?: string) => void;
    launchApp: (appId: string) => void;
    list: () => PluginWindowInfo[];
    get: (windowId: string) => PluginWindowInfo | undefined;
    focus: (windowId: string) => void;
    /** Usable area (what a maximized window fills). */
    getWorkArea: () => WorkArea;
    /** Show a window scaled and moved, without changing its geometry. */
    setPresentation: (windowId: string, presentation: WindowPresentation | null) => void;
    getPresentation: (windowId: string) => WindowPresentation | undefined;
    /** Add an entry to the window menus (⋮ button and titlebar right-click). */
    addMenuItem: (item: WindowMenuItem) => () => void;
  };
  /** Per-app settings (`~/.config/piloti/apps/<app-id>.ini`); `color-scheme=dark` forces an app dark. */
  apps: {
    getSetting: (appId: string, key: string) => string | undefined;
    setSetting: (appId: string, key: string, value: string | null) => void;
  };
  notifications: {
    push: (opts: { summary: string; body?: string; urgency?: "low" | "normal" | "critical" }) => void;
  };
  storage: {
    get: <T = unknown>(key: string) => T | undefined;
    set: (key: string, value: unknown) => void;
  };
  piloti: Piloti;
  onCleanup: (fn: () => void) => void;
}
