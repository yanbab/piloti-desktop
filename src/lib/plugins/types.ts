import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";

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
  };
  notifications: {
    push: (opts: { summary: string; body?: string; urgency?: "low" | "normal" | "critical" }) => void;
  };
  storage: {
    get: <T = unknown>(key: string) => T | undefined;
    set: (key: string, value: unknown) => void;
  };
  domicile: Domicile;
  onCleanup: (fn: () => void) => void;
}
