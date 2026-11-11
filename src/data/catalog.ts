export type AccentColorId =
  | "blue"
  | "purple"
  | "pink"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "mint"
  | "teal"
  | "cyan"
  | "indigo"
  | "brown"
  | "graphite";

export type UiThemeId = "cupertino" | "adwaita";

export interface AccentColorOption {
  id: AccentColorId;
  label: string;
  adwaitaLabel?: string;
  cssVar: string;
  hex: string;
  adwaitaHex: string;
  inAdwaita: boolean;
}

export const ACCENT_COLORS: AccentColorOption[] = [
  { id: "blue", label: "Blue", cssVar: "var(--mac-blue)", hex: "#0088ff", adwaitaHex: "#3584e4", inAdwaita: true },
  { id: "teal", label: "Teal", cssVar: "var(--mac-teal)", hex: "#00c3d0", adwaitaHex: "#2190a4", inAdwaita: true },
  { id: "green", label: "Green", cssVar: "var(--mac-green)", hex: "#34c759", adwaitaHex: "#3a944a", inAdwaita: true },
  { id: "yellow", label: "Yellow", cssVar: "var(--mac-yellow)", hex: "#ffcc00", adwaitaHex: "#c88800", inAdwaita: true },
  { id: "orange", label: "Orange", cssVar: "var(--mac-orange)", hex: "#ff8d28", adwaitaHex: "#ed5b00", inAdwaita: true },
  { id: "red", label: "Red", cssVar: "var(--mac-red)", hex: "#ff383c", adwaitaHex: "#e62d42", inAdwaita: true },
  { id: "pink", label: "Pink", cssVar: "var(--mac-pink)", hex: "#ff2d55", adwaitaHex: "#d56199", inAdwaita: true },
  { id: "purple", label: "Purple", cssVar: "var(--mac-purple)", hex: "#cb30e0", adwaitaHex: "#9141ac", inAdwaita: true },
  { id: "graphite", label: "Graphite", adwaitaLabel: "Slate", cssVar: "var(--mac-gray)", hex: "#8e8e93", adwaitaHex: "#6f8396", inAdwaita: true },
  { id: "mint", label: "Mint", cssVar: "var(--mac-mint)", hex: "#00c8b3", adwaitaHex: "#2190a4", inAdwaita: false },
  { id: "cyan", label: "Cyan", cssVar: "var(--mac-cyan)", hex: "#00c0e8", adwaitaHex: "#2190a4", inAdwaita: false },
  { id: "indigo", label: "Indigo", cssVar: "var(--mac-indigo)", hex: "#6155f5", adwaitaHex: "#3584e4", inAdwaita: false },
  { id: "brown", label: "Brown", cssVar: "var(--mac-brown)", hex: "#ac7f5e", adwaitaHex: "#986a44", inAdwaita: false },
];

export interface WallpaperOption {
  id: string;
  name: string;
  subtitle: string;
  category: "Dynamic" | "Landscape" | "Minimal";
  backgroundCss: string;
  overlayCss?: string;
}

export const WALLPAPERS: WallpaperOption[] = [
  {
    id: "piloti-aurora",
    name: "Piloti Aurora",
    subtitle: "Dynamic Liquid Glass Mesh",
    category: "Dynamic",
    backgroundCss:
      "radial-gradient(120% 90% at 15% 10%, #1d4ed8 0%, transparent 55%), radial-gradient(100% 90% at 85% 15%, #7c3aed 0%, transparent 55%), radial-gradient(110% 100% at 50% 90%, #0f766e 0%, transparent 60%), linear-gradient(135deg, #090d16 0%, #111827 50%, #0f172a 100%)",
    overlayCss:
      "radial-gradient(circle at 65% 35%, rgba(56, 189, 248, 0.18), transparent 45%)",
  },
  {
    id: "cupertino-sequoia",
    name: "Cupertino Horizon",
    subtitle: "Warm Dusk over the Ridge",
    category: "Dynamic",
    backgroundCss:
      "radial-gradient(130% 80% at 50% 0%, #fb7185 0%, transparent 50%), radial-gradient(90% 80% at 15% 40%, #f97316 0%, transparent 55%), radial-gradient(110% 90% at 85% 65%, #6366f1 0%, transparent 60%), linear-gradient(180deg, #1e1b4b 0%, #0f172a 65%, #020617 100%)",
  },
  {
    id: "gnome-adwaita",
    name: "Adwaita Emerald",
    subtitle: "GNOME Inspired Geometric Flow",
    category: "Dynamic",
    backgroundCss:
      "radial-gradient(100% 100% at 20% 20%, #059669 0%, transparent 55%), radial-gradient(100% 90% at 80% 30%, #0284c7 0%, transparent 55%), radial-gradient(90% 90% at 40% 85%, #1e40af 0%, transparent 60%), linear-gradient(160deg, #042f2e 0%, #0f172a 100%)",
  },
  {
    id: "alpine-midnight",
    name: "Alpine Midnight",
    subtitle: "Deep Slate & Indigo Peaks",
    category: "Landscape",
    backgroundCss:
      "radial-gradient(90% 70% at 70% 15%, #38bdf8 0%, transparent 50%), radial-gradient(110% 85% at 25% 70%, #312e81 0%, transparent 60%), linear-gradient(180deg, #0b1120 0%, #111827 55%, #030712 100%)",
  },
  {
    id: "solar-bloom",
    name: "Solar Bloom",
    subtitle: "Daylight Amber & Violet",
    category: "Dynamic",
    backgroundCss:
      "radial-gradient(100% 90% at 20% 15%, #f59e0b 0%, transparent 55%), radial-gradient(100% 90% at 85% 25%, #ec4899 0%, transparent 55%), radial-gradient(120% 100% at 50% 90%, #3b82f6 0%, transparent 65%), linear-gradient(135deg, #1e1b4b 0%, #311042 100%)",
  },
  {
    id: "monolith-graphite",
    name: "Studio Graphite",
    subtitle: "Minimalist Pro Studio Surface",
    category: "Minimal",
    backgroundCss:
      "radial-gradient(90% 90% at 50% 10%, rgba(255,255,255,0.09) 0%, transparent 60%), linear-gradient(180deg, #18181b 0%, #09090b 100%)",
  },
];

export type BuiltinAppId = "settings";

export interface AppMenuSection {
  title: string;
  items: {
    label: string;
    shortcut?: string;
    actionId: string;
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
  gradient: string;
  pinnedByDefault: boolean;
  builtinComponent?: BuiltinAppId;
  linuxCommand?: string[];
  defaultSize: { width: number; height: number };
  minSize?: { width: number; height: number };
  menus: AppMenuSection[];
}

export const APP_CATALOG: AppDefinition[] = [
  {
    id: "settings",
    name: "System Settings",
    shortName: "Settings",
    description: "Configure appearance, dock, wallpaper, network, sound, and displays",
    category: "System",
    iconName: "settings",
    xdgIcons: ["org.gnome.Settings", "preferences-system", "gnome-control-center"],
    gradient: "from-slate-400 via-zinc-500 to-zinc-700",
    pinnedByDefault: true,
    builtinComponent: "settings",
    defaultSize: { width: 820, height: 550 },
    minSize: { width: 620, height: 400 },
    menus: [
      {
        title: "View",
        items: [
          { label: "Appearance", shortcut: "⌘1", actionId: "settings:appearance" },
          { label: "Dock & Menu Bar", shortcut: "⌘2", actionId: "settings:dock" },
          { label: "Wallpaper", shortcut: "⌘3", actionId: "settings:wallpaper" },
          { label: "Wi-Fi & Network", shortcut: "⌘4", actionId: "settings:network" },
          { label: "Sound", shortcut: "⌘5", actionId: "settings:sound" },
          { label: "Displays", shortcut: "⌘6", actionId: "settings:displays" },
          { label: "About Piloti", shortcut: "⌘7", actionId: "settings:about" },
        ],
      },
    ],
  },
  {
    id: "nautilus",
    name: "Files",
    shortName: "Files",
    description: "GNOME Files (Nautilus)",
    category: "System",
    iconName: "folder",
    xdgIcons: ["org.gnome.Nautilus", "system-file-manager", "folder"],
    gradient: "from-sky-400 via-blue-500 to-blue-600",
    pinnedByDefault: true,
    linuxCommand: ["nautilus"],
    defaultSize: { width: 780, height: 500 },
    menus: [],
  },
  {
    id: "terminal",
    name: "Terminal",
    shortName: "Terminal",
    description: "Launch Terminal (`kgx` / `kitty`)",
    category: "Development",
    iconName: "terminal",
    xdgIcons: ["org.gnome.Console", "kitty", "utilities-terminal", "terminal"],
    gradient: "from-zinc-700 via-zinc-800 to-zinc-950",
    pinnedByDefault: true,
    linuxCommand: ["kitty"],
    defaultSize: { width: 720, height: 460 },
    menus: [],
  },
  {
    id: "browser",
    name: "Web Browser",
    shortName: "Browser",
    description: "Launch Web Browser (`firefox`)",
    category: "Internet",
    iconName: "globe",
    xdgIcons: ["org.gnome.Epiphany", "firefox-esr", "firefox", "chromium", "web-browser"],
    gradient: "from-cyan-400 via-blue-500 to-indigo-600",
    pinnedByDefault: true,
    linuxCommand: ["firefox"],
    defaultSize: { width: 880, height: 560 },
    menus: [],
  },
];

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
  { ssid: "Cupertino-Studio-Mesh", signal: 84, secured: true, band: "5 GHz", ipAddress: "10.0.1.18" },
];
