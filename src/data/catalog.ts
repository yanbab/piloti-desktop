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
  hex: string;
}

export const ACCENT_COLORS: AccentColorOption[] = [
  { id: "blue", label: "Blue", cssVar: "var(--adw-blue)", hex: "#3584e4" },
  { id: "teal", label: "Teal", cssVar: "var(--adw-teal)", hex: "#2190a4" },
  { id: "green", label: "Green", cssVar: "var(--adw-green)", hex: "#3a944a" },
  { id: "yellow", label: "Yellow", cssVar: "var(--adw-yellow)", hex: "#c88800" },
  { id: "orange", label: "Orange", cssVar: "var(--adw-orange)", hex: "#ed5b00" },
  { id: "red", label: "Red", cssVar: "var(--adw-red)", hex: "#e62d42" },
  { id: "pink", label: "Pink", cssVar: "var(--adw-pink)", hex: "#d56199" },
  { id: "purple", label: "Purple", cssVar: "var(--adw-purple)", hex: "#9141ac" },
  { id: "graphite", label: "Slate", cssVar: "var(--adw-gray)", hex: "#6f8396" },
];

export interface WallpaperOption {
  id: string;
  name: string;
  subtitle: string;
  category: "Dynamic" | "Landscape" | "Minimal" | "Solid";
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
    id: "horizon-dusk",
    name: "Horizon Dusk",
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
  // Solid Color Wallpapers (Classic OS default colors + Black)
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
  | "app-store";

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
  isWebApp?: boolean;
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
    name: "Desktop Settings",
    shortName: "Desktop Settings",
    description: "Configure appearance, dock, wallpaper, network, sound, and displays",
    category: "System",
    iconName: "settings",
    xdgIcons: ["piloti-settings"],
    gradient: "from-slate-400 via-zinc-500 to-zinc-700",
    pinnedByDefault: false,
    builtinComponent: "settings",
    defaultSize: { width: 820, height: 550 },
    minSize: { width: 620, height: 400 },
    menus: [
      {
        title: "View",
        items: [
          { label: "Appearance", shortcut: "⌘1", actionId: "settings:appearance" },
          { label: "Fonts & Rendering", shortcut: "⌘2", actionId: "settings:fonts" },
          { label: "Dock & Menu Bar", shortcut: "⌘3", actionId: "settings:dock" },
          { label: "Wallpaper", shortcut: "⌘4", actionId: "settings:wallpaper" },
          { label: "Wi-Fi & Network", shortcut: "⌘5", actionId: "settings:network" },
          { label: "Sound", shortcut: "⌘6", actionId: "settings:sound" },
          { label: "Displays", shortcut: "⌘7", actionId: "settings:displays" },
          { label: "About Piloti", shortcut: "⌘8", actionId: "settings:about" },
        ],
      },
    ],
  },
  {
    id: "console",
    name: "DevTools",
    shortName: "DevTools",
    description: "Shell DevTools, live logs, inspector, and JS console",
    category: "Development",
    iconName: "code",
    xdgIcons: ["org.gnome.DevTools"],
    gradient: "from-slate-700 via-zinc-800 to-zinc-950",
    pinnedByDefault: true,
    builtinComponent: "console",
    defaultSize: { width: 840, height: 540 },
    minSize: { width: 560, height: 360 },
    menus: [
      {
        title: "View",
        items: [
          { label: "Console", actionId: "console:repl" },
          { label: "Logs", actionId: "console:logs" },
          { label: "State", actionId: "console:inspector" },
          { label: "Storage", actionId: "console:storage" },
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
    xdgIcons: ["piloti-terminal"],
    gradient: "from-zinc-700 via-zinc-800 to-zinc-950",
    pinnedByDefault: true,
    linuxCommand: ["kitty"],
    defaultSize: { width: 720, height: 460 },
    menus: [],
  },
  {
    id: "text-editor",
    name: "Text Editor",
    shortName: "Notepad",
    description: "Minimal plain-text notepad with instant localStorage VFS save",
    category: "Utilities",
    iconName: "file-text",
    xdgIcons: ["piloti-text-editor"],
    gradient: "from-amber-400 via-orange-500 to-rose-500",
    pinnedByDefault: false,
    builtinComponent: "text-editor",
    defaultSize: { width: 520, height: 380 },
    menus: [],
  },
  {
    id: "app-store",
    name: "Application Store",
    shortName: "Application Store",
    description: "Browse and install apps and web apps",
    category: "System",
    iconName: "sparkles",
    xdgIcons: ["org.gnome.Software", "system-software-install", "software-store"],
    gradient: "from-blue-500 via-indigo-500 to-violet-600",
    pinnedByDefault: true,
    builtinComponent: "app-store",
    defaultSize: { width: 880, height: 580 },
    minSize: { width: 640, height: 420 },
    menus: [],
  },
  {
    id: "browser",
    name: "Web Browser",
    shortName: "Browser",
    description: "Launch Web Browser (`firefox`)",
    category: "Internet",
    iconName: "globe",
    xdgIcons: ["org.gnome.Epiphany", "chromium", "firefox-esr", "firefox", "web-browser", "text-html"],
    gradient: "from-cyan-400 via-blue-500 to-indigo-600",
    pinnedByDefault: false,
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
  { ssid: "Adwaita-Lab-5G", signal: 84, secured: true, band: "5 GHz", ipAddress: "10.0.1.18" },
];
