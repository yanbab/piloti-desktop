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
    subtitle: "Matches Active System Accent Color",
    category: "Dynamic",
    backgroundCss: resolveDynamicWallpaperCss("dynamic-accent")!,
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
  {
    id: "piloti-waves",
    name: "Piloti Waves",
    subtitle: "Light & Dark Adaptive",
    category: "Pictures",
    backgroundCss: "#cde4fa",
    backgroundCssDark: "#0b1526",
    imageUrl: "file:///usr/share/backgrounds/piloti/piloti-waves-l.svg",
    imageUrlDark: "file:///usr/share/backgrounds/piloti/piloti-waves-d.svg",
  },
  // Curated Unsplash Pictures
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
    id: "unsplash-desert-dunes",
    name: "Desert Dunes",
    subtitle: "Unsplash · Warm Minimalism",
    category: "Pictures",
    backgroundCss: "#2c1d11",
    imageUrl:
      "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=2400&q=80",
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
  | "login-screen";

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
  gradient: string;
  pinnedByDefault: boolean;
  builtinComponent?: BuiltinAppId;
  command?: string;
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
    description: "Configure appearance, fonts, dock, and wallpaper",
    category: "System",
    iconName: "settings",
    xdgIcons: ["preferences-desktop", "preferences-system", "piloti-settings"],
    gradient: "from-slate-400 via-zinc-500 to-zinc-700",
    pinnedByDefault: true,
    builtinComponent: "settings",
    command: "piloti-settings",
    defaultSize: { width: 820, height: 550 },
    minSize: { width: 320, height: 400 },
    menus: [
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
  },
  {
    id: "console",
    name: "Desktop Console",
    shortName: "Desktop Console",
    description: "Desktop Console, live logs, inspector, and JS REPL",
    category: "Development",
    iconName: "code",
    xdgIcons: ["piloti-console", "piloti-desktop", "utilities-terminal"],
    gradient: "from-indigo-700 via-slate-800 to-zinc-950",
    pinnedByDefault: true,
    builtinComponent: "console",
    command: "piloti-console",
    defaultSize: { width: 840, height: 540 },
    minSize: { width: 320, height: 360 },
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
    name: "Folders",
    shortName: "Folders",
    description: "Browse local virtual files and folders",
    category: "System",
    iconName: "folder",
    xdgIcons: ["system-file-manager", "piloti-files", "folder"],
    gradient: "from-sky-400 via-blue-500 to-blue-600",
    pinnedByDefault: true,
    builtinComponent: "files",
    command: "piloti-files",
    defaultSize: { width: 780, height: 500 },
    menus: [
      {
        title: "File",
        items: [
          { label: "New Folder", shortcut: "Ctrl+Shift+N", actionId: "files:new-folder" },
          { label: "New Text File", actionId: "files:new-text-file", separatorAfter: true },
          { label: "Open", shortcut: "Enter", actionId: "files:open" },
          { label: "Back", shortcut: "Alt+Left", actionId: "files:go-up" },
          { label: "Edit Location", shortcut: "Ctrl+L", actionId: "files:edit-location" },
          { label: "Search", shortcut: "Ctrl+F", actionId: "files:find", separatorAfter: true },
          { label: "Empty Trash", actionId: "files:empty-trash" },
        ],
      },
      {
        title: "Edit",
        items: [
          { label: "Cut", shortcut: "Ctrl+X", actionId: "files:cut" },
          { label: "Copy", shortcut: "Ctrl+C", actionId: "files:copy" },
          { label: "Paste", shortcut: "Ctrl+V", actionId: "files:paste" },
          { label: "Duplicate", shortcut: "Ctrl+D", actionId: "files:duplicate", separatorAfter: true },
          { label: "Compress", actionId: "files:compress" },
          { label: "Rename…", shortcut: "Ctrl+Enter", actionId: "files:rename", separatorAfter: true },
          { label: "Move to Trash", shortcut: "Del", actionId: "files:trash" },
        ],
      },
      {
        title: "View",
        items: [
          { label: "As Icons", shortcut: "Ctrl+1", actionId: "files:view-grid", checked: true },
          { label: "As List", shortcut: "Ctrl+2", actionId: "files:view-list", checked: false, separatorAfter: true },
          { label: "Zoom In", shortcut: "Ctrl++", actionId: "files:zoom-in" },
          { label: "Zoom Out", shortcut: "Ctrl+-", actionId: "files:zoom-out", separatorAfter: true },
          { label: "Show Hidden Files", shortcut: "Ctrl+H", actionId: "files:toggle-hidden", checked: false },
          { label: "Info Panel", shortcut: "Ctrl+I", actionId: "files:toggle-info", checked: false },
        ],
      },
    ],
  },
  {
    id: "terminal",
    name: "Desktop Shell",
    shortName: "Desktop Shell",
    description: "Desktop shell with VFS commands (ls, cd, mkdir, cat, top)",
    category: "Development",
    iconName: "terminal",
    xdgIcons: ["utilities-terminal", "piloti-shell", "piloti-terminal"],
    gradient: "from-zinc-700 via-zinc-800 to-zinc-950",
    pinnedByDefault: true,
    builtinComponent: "terminal",
    command: "piloti-shell",
    defaultSize: { width: 720, height: 460 },
    menus: [],
  },
  {
    id: "text-editor",
    name: "Notepad",
    shortName: "Notepad",
    description: "Minimal plain-text notepad with instant localStorage VFS save",
    category: "Utilities",
    iconName: "file-text",
    xdgIcons: ["accessories-text-editor", "piloti-notepad", "piloti-text-editor"],
    gradient: "from-amber-400 via-orange-500 to-rose-500",
    pinnedByDefault: true,
    builtinComponent: "text-editor",
    command: "piloti-notepad",
    defaultSize: { width: 520, height: 380 },
    menus: [
      {
        title: "View",
        items: [
          {
            label: "Line Numbers",
            actionId: "text-editor:toggle-line-numbers",
            checked: false,
          },
          {
            label: "Syntax Highlighting",
            actionId: "text-editor:toggle-syntax",
            checked: true,
          },
          {
            label: "Word Wrap",
            actionId: "text-editor:toggle-word-wrap",
            checked: false,
          },
          {
            label: "Active Line",
            actionId: "text-editor:toggle-active-line",
            checked: false,
          },
          {
            label: "Cursor Position",
            actionId: "text-editor:toggle-cursor-position",
            checked: false,
          },
        ],
      },
    ],
  },
  {
    id: "app-store",
    name: "Applications",
    shortName: "Applications",
    description: "Browse and install apps and web apps",
    category: "System",
    iconName: "sparkles",
    xdgIcons: ["system-software-install", "software-store", "piloti-applications"],
    gradient: "from-blue-500 via-indigo-500 to-violet-600",
    pinnedByDefault: true,
    builtinComponent: "app-store",
    command: "piloti-applications",
    defaultSize: { width: 880, height: 580 },
    minSize: { width: 320, height: 400 },
    menus: [],
  },
  {
    id: "calculator",
    name: "Calculator",
    shortName: "Calculator",
    description: "macOS-style Basic & Scientific Calculator (Isolated App)",
    category: "Utilities",
    iconName: "activity",
    xdgIcons: ["accessories-calculator", "org.gnome.Calculator", "piloti-calculator"],
    gradient: "from-zinc-700 via-zinc-800 to-orange-500",
    pinnedByDefault: true,
    builtinComponent: "calculator",
    command: "piloti-calculator",
    defaultSize: { width: 196, height: 292 },
    minSize: { width: 184, height: 276 },
    menus: [],
  },
  {
    id: "image-viewer",
    name: "Image Viewer",
    shortName: "Image Viewer",
    description: "Fast image viewer and crop/rotate editor (Isolated App)",
    category: "Utilities",
    iconName: "sparkles",
    xdgIcons: ["org.gnome.Loupe", "loupe", "multimedia-photo-viewer", "piloti-image-viewer", "image-viewer"],
    gradient: "from-sky-500 via-indigo-500 to-purple-600",
    pinnedByDefault: true,
    builtinComponent: "image-viewer",
    command: "piloti-image-viewer",
    defaultSize: { width: 640, height: 480 },
    minSize: { width: 320, height: 300 },
    menus: [],
  },
  {
    id: "login-screen",
    name: "Login Screen",
    shortName: "Login",
    description: "Piloti Display Manager (GDM alternative preview)",
    category: "System",
    iconName: "settings",
    xdgIcons: ["system-users", "preferences-system-login", "system-lock-screen"],
    gradient: "from-sky-500 via-blue-600 to-indigo-700",
    pinnedByDefault: false,
    builtinComponent: "login-screen",
    command: "piloti-login",
    defaultSize: { width: 760, height: 500 },
    minSize: { width: 420, height: 360 },
    menus: [],
  },
  {
    id: "browser",
    name: "Web Browser",
    shortName: "Browser",
    description: "Launch Web Browser (`firefox`)",
    category: "Internet",
    iconName: "globe",
    xdgIcons: ["internet-web-browser", "web-browser", "firefox-esr", "firefox", "chromium"],
    gradient: "from-cyan-400 via-blue-500 to-indigo-600",
    pinnedByDefault: false,
    linuxCommand: ["firefox"],
    defaultSize: { width: 720, height: 500 },
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
