import { parseIniText } from "@/lib/config/ini";
export type AccentColorId =
  | "blue"
  | "purple"
  | "pink"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "graphite";

export interface AccentColorOption {
  id: AccentColorId;
  label: string;
  cssVar: string;
  /** The Piloti (Cupertino UI / macOS) light value of `cssVar`, from
   *  piloti-macos.css. Sent to apps and dynamic wallpapers. */
  hex: string;
  /** The Adwaita (GNOME) value of `cssVar`, from adwaita.css. */
  adwaitaHex: string;
}

export const ACCENT_COLORS: AccentColorOption[] = [
  { id: "blue", label: "Blue", cssVar: "var(--ui-blue)", hex: "#0088ff", adwaitaHex: "#3584e4" },
  { id: "purple", label: "Purple", cssVar: "var(--ui-purple)", hex: "#cb30e0", adwaitaHex: "#9141ac" },
  { id: "pink", label: "Pink", cssVar: "var(--ui-pink)", hex: "#ff2d55", adwaitaHex: "#d56199" },
  { id: "red", label: "Red", cssVar: "var(--ui-red)", hex: "#ff383c", adwaitaHex: "#e62d42" },
  { id: "orange", label: "Orange", cssVar: "var(--ui-orange)", hex: "#ff8d28", adwaitaHex: "#ed5b00" },
  { id: "yellow", label: "Yellow", cssVar: "var(--ui-yellow)", hex: "#ffcc00", adwaitaHex: "#c88800" },
  { id: "green", label: "Green", cssVar: "var(--ui-green)", hex: "#34c759", adwaitaHex: "#3a944a" },
  { id: "graphite", label: "Graphite", cssVar: "var(--ui-gray)", hex: "#8e8e93", adwaitaHex: "#6f8396" },
];

/** The accent hex the UI uses (selections, sidebar items, tinted icons):
 *  a custom hex as is, otherwise the preset's value for the interface theme
 *  (what `--ui-accent` resolves to: Cupertino UI for Piloti and Cupertino, GNOME for Adwaita). */
export function resolveUiAccentHex(
  accentColor: string | undefined,
  customAccentHex?: string,
  interfaceTheme?: string
): string {
  const custom = customAccentHex?.trim();
  if (custom && /^#[0-9a-fA-F]{6}$/.test(custom)) return custom;
  const accent = ACCENT_COLORS.find((c) => c.id === accentColor) ?? ACCENT_COLORS[0];
  return interfaceTheme === "adwaita" ? accent.adwaitaHex : accent.hex;
}

export interface WallpaperOption {
  id: string;
  name: string;
  subtitle: string;
  category: "Dynamic" | "Pictures" | "Minimal" | "Solid";
  backgroundCss: string;
  backgroundCssDark?: string;
  overlayCss?: string;
  imageUrl?: string;
  imageUrlDark?: string;
  kind?: "static" | "css" | "html";
  cssAnimation?: string;
  cssAnimationDark?: string;
  htmlSrcDoc?: string;
  htmlSrcDocDark?: string;
  pluginId?: string;
}

export function resolveDynamicWallpaperCss(
  id: string,
  accentHex = "#3584e4",
  hour = new Date().getHours()
): string | null {
  if (id === "dynamic-accent") {
    return `radial-gradient(85% 65% at 50% 92%, color-mix(in srgb, ${accentHex} 58%, #111827) 0%, transparent 65%), radial-gradient(65% 45% at 50% 100%, color-mix(in srgb, ${accentHex} 40%, #090d16) 0%, transparent 60%), linear-gradient(180deg, #05070d 0%, color-mix(in srgb, ${accentHex} 18%, #090d16) 72%, #06080f 100%)`;
  }
  if (id === "dynamic-time") {
    if (hour >= 6 && hour < 10) {
      // Morning sunrise (dark top, centered dock-upward glow)
      return "radial-gradient(85% 65% at 50% 92%, #9f1239 0%, transparent 64%), radial-gradient(65% 45% at 50% 100%, #9a3412 0%, transparent 60%), linear-gradient(180deg, #070917 0%, #17153b 64%, #1e1b4b 100%)";
    }
    if (hour >= 10 && hour < 17) {
      // Crisp daylight sky (dark top, centered dock-upward glow)
      return "radial-gradient(85% 65% at 50% 92%, #0369a1 0%, transparent 64%), radial-gradient(65% 45% at 50% 100%, #1d4ed8 0%, transparent 60%), linear-gradient(180deg, #040b18 0%, #082f49 66%, #0c192c 100%)";
    }
    if (hour >= 17 && hour < 21) {
      // Golden evening dusk (dark top, centered dock-upward glow)
      return "radial-gradient(85% 65% at 50% 92%, #9a3412 0%, transparent 62%), radial-gradient(65% 45% at 50% 100%, #831843 0%, transparent 60%), linear-gradient(180deg, #050412 0%, #1e1038 66%, #090d1a 100%)";
    }
    // Deep night
    return "radial-gradient(85% 65% at 50% 92%, #1e3a8a 0%, transparent 64%), radial-gradient(65% 45% at 50% 100%, #312e81 0%, transparent 60%), linear-gradient(180deg, #02050e 0%, #060a14 66%, #090d18 100%)";
  }
  return null;
}

export const WALLPAPERS: WallpaperOption[] = [
  {
    id: "dynamic-time",
    name: "Time of Day",
    subtitle: "Shifts with Morning, Day, Dusk & Night",
    category: "Dynamic",
    backgroundCss: resolveDynamicWallpaperCss("dynamic-time")!,
  },
  {
    id: "dynamic-accent",
    name: "Accent Mesh",
    subtitle: "Animated Accent Color Mesh",
    category: "Dynamic",
    backgroundCss: resolveDynamicWallpaperCss("dynamic-accent")!,
    cssAnimation: "piloti-accent-mesh-drift 18s ease-in-out infinite",
  },
  {
    id: "piloti-aurora",
    name: "Piloti Deep Blue",
    subtitle: "Subtle Cobalt & Slate Depth",
    category: "Dynamic",
    backgroundCss:
      "radial-gradient(95% 85% at 84% 84%, rgba(37, 99, 185, 0.44) 0%, transparent 62%), radial-gradient(85% 75% at 58% 92%, rgba(23, 62, 110, 0.48) 0%, transparent 62%), linear-gradient(175deg, #050811 0%, #0a101d 65%, #0c1424 100%)",
  },
  {
    id: "monolith-graphite",
    name: "Studio Graphite",
    subtitle: "Minimalist Neutral Surface",
    category: "Minimal",
    backgroundCss:
      "radial-gradient(90% 85% at 84% 86%, rgba(255,255,255,0.08) 0%, transparent 60%), linear-gradient(175deg, #09090b 0%, #121215 65%, #18181b 100%)",
  },
  // Curated Nature Pictures
  {
    id: "unsplash-alpine-mist",
    name: "Alpine Mist",
    subtitle: "Unsplash · Mountain Ridge",
    category: "Pictures",
    backgroundCss: "#0f172a",
    imageUrl:
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=2400&q=80",
  },
  {
    id: "unsplash-nordic-fjord",
    name: "Nordic Fjord",
    subtitle: "Unsplash · Calm Blue Water",
    category: "Pictures",
    backgroundCss: "#0c192c",
    imageUrl:
      "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=2400&q=80",
  },
  {
    id: "unsplash-dark-forest",
    name: "Evergreen Canopy",
    subtitle: "Unsplash · Misty Pines",
    category: "Pictures",
    backgroundCss: "#0b1914",
    imageUrl:
      "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2400&q=80",
  },
  // Solid Color Wallpapers
  {
    id: "solid-w95-teal",
    name: "Windows 95 Teal",
    subtitle: "Classic Windows 95 / 98 Teal",
    category: "Solid",
    backgroundCss: "#008080",
  },
  {
    id: "solid-beos-cobalt",
    name: "BeOS Cobalt",
    subtitle: "BeOS R5 Desktop Blue",
    category: "Solid",
    backgroundCss: "#336699",
  },
  {
    id: "solid-gnome-slate",
    name: "Adwaita Slate",
    subtitle: "Deep Libadwaita Neutral",
    category: "Solid",
    backgroundCss: "#202024",
  },
  {
    id: "solid-debian-blue",
    name: "GNOME Cobalt",
    subtitle: "Classic Linux Desktop Blue",
    category: "Solid",
    backgroundCss: "#1c4a7e",
  },
  {
    id: "solid-nord-polar",
    name: "Nord Polar",
    subtitle: "Cool Arctic Slate",
    category: "Solid",
    backgroundCss: "#2e3440",
  },
  {
    id: "solid-deep-forest",
    name: "Deep Forest",
    subtitle: "Muted Pine Green",
    category: "Solid",
    backgroundCss: "#183329",
  },
  {
    id: "solid-indigo",
    name: "Classic Indigo",
    subtitle: "Deep Night Indigo",
    category: "Solid",
    backgroundCss: "#1e1b4b",
  },
  {
    id: "solid-black",
    name: "Black",
    subtitle: "Solid Black",
    category: "Solid",
    backgroundCss: "#000000",
  },
];

export type BuiltinAppId =
  | "settings"
  | "console"
  | "files"
  | "text-editor"
  | "terminal"
  | "app-store"
  | "calculator"
  | "image-viewer"
  | "camera"
  | "system-monitor"
  | "login-screen"
  | "piloti-demo"
  | "hello-world";

export interface AppMenuSection {
  title: string;
  items: {
    label: string;
    shortcut?: string;
    actionId: string;
    checked?: boolean;
    separatorAfter?: boolean;
  }[];
}

export interface AppDefinition {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: "System" | "Utilities" | "Productivity" | "Development" | "Internet";
  iconName:
  | "settings"
  | "folder"
  | "terminal"
  | "file-text"
  | "activity"
  | "globe"
  | "code"
  | "sparkles";
  xdgIcons?: string[];
  iconUrl?: string;
  isWebApp?: boolean;
  pinnedByDefault: boolean;
  builtinComponent?: BuiltinAppId;
  command?: string;
  linuxCommand?: string[];
  defaultSize: { width: number; height: number };
  minSize?: { width: number; height: number };
  menus: AppMenuSection[];
}

/** App menus: structure and actions are code; everything else is in the .desktop files. */
const APP_MENUS: Record<string, AppMenuSection[]> = {
  settings: [
    {
      title: "View",
      items: [
        { label: "Appearance", shortcut: "⌘1", actionId: "settings:appearance" },
        { label: "Fonts", shortcut: "⌘2", actionId: "settings:fonts" },
        { label: "Dock & Menu Bar", shortcut: "⌘3", actionId: "settings:dock" },
        { label: "Wallpaper", shortcut: "⌘4", actionId: "settings:wallpaper" },
      ],
    },
  ],
  console: [
    {
      title: "View",
      items: [
        { label: "Logs", actionId: "console:logs" },
        { label: "State", actionId: "console:inspector" },
        { label: "Storage", actionId: "console:storage" },
      ],
    },
  ],
  nautilus: [
    {
      title: "File",
      items: [
        { label: "New Folder", shortcut: "Ctrl+Shift+N", actionId: "files:new-folder" },
        { label: "New Text File", actionId: "files:new-text-file", separatorAfter: true },
        { label: "Open", shortcut: "Enter", actionId: "files:open" },
        { label: "Back", shortcut: "Alt+Left", actionId: "files:go-up" },
        { label: "Edit Location", shortcut: "Ctrl+L", actionId: "files:edit-location" },
        { label: "Search", shortcut: "Ctrl+F", actionId: "files:find", separatorAfter: true },
        { label: "Print…", shortcut: "Ctrl+P", actionId: "file:print", separatorAfter: true },
        { label: "Move to Trash", shortcut: "Del", actionId: "files:trash" },
        { label: "Eject", actionId: "files:eject", separatorAfter: true },
        { label: "Empty Trash", actionId: "files:empty-trash" },
      ],
    },
    {
      title: "Edit",
      items: [
        { label: "Undo", shortcut: "Ctrl+Z", actionId: "files:undo" },
        { label: "Redo", shortcut: "Ctrl+Shift+Z", actionId: "files:redo", separatorAfter: true },
        { label: "Cut", shortcut: "Ctrl+X", actionId: "files:cut" },
        { label: "Copy", shortcut: "Ctrl+C", actionId: "files:copy" },
        { label: "Paste", shortcut: "Ctrl+V", actionId: "files:paste" },
        { label: "Duplicate", shortcut: "Ctrl+D", actionId: "files:duplicate" },
        { label: "Select All", shortcut: "Ctrl+A", actionId: "edit:select-all", separatorAfter: true },
        { label: "Compress", actionId: "files:compress" },
        { label: "Rename…", shortcut: "Ctrl+Enter", actionId: "files:rename" },
      ],
    },
    {
      title: "View",
      items: [
        { label: "As Icons", shortcut: "Ctrl+1", actionId: "files:view-grid", checked: true },
        { label: "As List", shortcut: "Ctrl+2", actionId: "files:view-list", checked: false },
        { label: "As Desktop", actionId: "files:view-desktop", checked: false, separatorAfter: true },
        { label: "Sort Manually", actionId: "files:sort-manual", checked: false },
        { label: "Sort by Name", actionId: "files:sort-name", checked: true },
        { label: "Sort by Kind", actionId: "files:sort-kind", checked: false },
        { label: "Sort by Date Modified", actionId: "files:sort-modified", checked: false },
        { label: "Sort by Size", actionId: "files:sort-size", checked: false, separatorAfter: true },
        { label: "Ascending", actionId: "files:sort-asc", checked: true },
        { label: "Descending", actionId: "files:sort-desc", checked: false, separatorAfter: true },
        { label: "Zoom In", shortcut: "Ctrl++", actionId: "files:zoom-in" },
        { label: "Zoom Out", shortcut: "Ctrl+-", actionId: "files:zoom-out", separatorAfter: true },
        { label: "Show Hidden Files", shortcut: "Ctrl+H", actionId: "files:toggle-hidden", checked: false },
        { label: "Info Panel", shortcut: "Ctrl+I", actionId: "files:toggle-info", checked: false },
      ],
    },
  ],
  "text-editor": [
    {
      title: "File",
      items: [
        { label: "Print…", shortcut: "Ctrl+P", actionId: "file:print" },
      ],
    },
    {
      title: "View",
      items: [
        { label: "Line Numbers", actionId: "text-editor:toggle-line-numbers", checked: false },
        { label: "Syntax Highlighting", actionId: "text-editor:toggle-syntax", checked: true },
        { label: "Word Wrap", actionId: "text-editor:toggle-word-wrap", checked: false },
        { label: "Active Line", actionId: "text-editor:toggle-active-line", checked: false },
        { label: "Cursor Position", actionId: "text-editor:toggle-cursor-position", checked: false, separatorAfter: true },
        { label: "Open New Windows Separately", actionId: "shell:run-separately", checked: false },
      ],
    },
  ],
  "app-store": [
    {
      title: "View",
      items: [
        { label: "Sort by Default", actionId: "app-store:sort-default", checked: true },
        { label: "Sort by Name", actionId: "app-store:sort-name", checked: false },
        { label: "Sort by Category", actionId: "app-store:sort-category", checked: false },
        { label: "Sort by Installed", actionId: "app-store:sort-installed", checked: false, separatorAfter: true },
        { label: "Refresh Software Catalog", actionId: "app-store:refresh" },
      ],
    },
  ],
  calculator: [
    {
      title: "View",
      items: [
        { label: "Basic", actionId: "calculator:basic", checked: true },
        { label: "Scientific", actionId: "calculator:scientific", checked: false },
      ],
    },
  ],
  "image-viewer": [
    {
      title: "File",
      items: [
        { label: "Print…", shortcut: "Ctrl+P", actionId: "file:print" },
      ],
    },
  ],
  browser: [
    {
      title: "File",
      items: [
        { label: "New Window", shortcut: "Ctrl+N", actionId: "browser:new-window" },
        { label: "New Tab", shortcut: "Ctrl+T", actionId: "browser:new-tab" },
        { label: "Close Tab", shortcut: "Ctrl+W", actionId: "browser:close-tab" },
        { label: "Reopen Closed Tab", shortcut: "Ctrl+Shift+T", actionId: "browser:reopen-tab", separatorAfter: true },
        { label: "Print…", shortcut: "Ctrl+P", actionId: "file:print" },
      ],
    },
  ],
};

/**
 * The built-in apps, read at start from `/usr/share/applications/piloti*.desktop`
 * (`registerApps`, before the shell is imported). Each file's `X-Piloti-*` keys
 * carry what XDG has no key for.
 */
export const APP_CATALOG: AppDefinition[] = [];

/** One app from a desktop file, or null when it isn't a Piloti app. */
export function appFromDesktopFile(text: string): (AppDefinition & { order: number }) | null {
  const entry = parseIniText(text)["Desktop Entry"];
  const id = entry?.["X-Piloti-AppId"];
  if (!entry || !id) return null;
  const x = (key: string) => entry[`X-Piloti-${key}`] ?? "";
  const size = (value: string) => {
    const [width, height] = value.split("x").map(Number);
    return width && height ? { width, height } : undefined;
  };
  const xdgIcons = x("XdgIcons").split(";").filter(Boolean);
  return {
    id,
    name: entry.Name ?? id,
    shortName: x("ShortName") || (entry.Name ?? id),
    description: entry.Comment ?? "",
    category: (x("Category") || "Utilities") as AppDefinition["category"],
    iconName: (x("IconName") || "sparkles") as AppDefinition["iconName"],
    xdgIcons: xdgIcons.length > 0 ? xdgIcons : undefined,
    pinnedByDefault: x("Pinned") === "true",
    builtinComponent: (x("Component") || undefined) as BuiltinAppId | undefined,
    command: entry.Exec?.split(/\s+/)[0],
    defaultSize: size(x("Size")) ?? { width: 720, height: 480 },
    minSize: size(x("MinSize")),
    menus: APP_MENUS[id] ?? [],
    order: Number(x("Order")) || 1000,
  };
}

/** Fills the catalog from desktop file contents, in `X-Piloti-Order`. */
export function registerApps(desktopFiles: readonly string[]): void {
  const apps = desktopFiles
    .map(appFromDesktopFile)
    .filter((app): app is AppDefinition & { order: number } => app !== null)
    .sort((a, b) => a.order - b.order);
  APP_CATALOG.splice(0, APP_CATALOG.length, ...apps.map(({ order: _order, ...app }) => app));
}

/** A desktop entry that launches a built-in app: lists show the app only once. */
export function isBuiltinAppEntry(exec: string | undefined): boolean {
  const program = exec?.trim().split(/\s+/)[0]?.split("/").pop();
  return Boolean(
    program && APP_CATALOG.some((app) => app.builtinComponent && app.command === program)
  );
}

export interface WifiNetwork {
  ssid: string;
  signal: number; // 1-100
  secured: boolean;
  band: "5 GHz" | "6 GHz" | "2.4 GHz";
  ipAddress?: string;
}

export const SAMPLE_WIFI_NETWORKS: WifiNetwork[] = [
  { ssid: "Piloti-5G-Ultra", signal: 96, secured: true, band: "6 GHz", ipAddress: "192.168.1.42" },
  { ssid: "Debian-VMware-Bridge", signal: 100, secured: true, band: "5 GHz", ipAddress: "172.16.84.129" },
  { ssid: "Adwaita-Lab-5G", signal: 84, secured: true, band: "5 GHz", ipAddress: "10.0.1.18" },
];
