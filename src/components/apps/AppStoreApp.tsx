import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  ArrowUpCircleIcon,
  BlocksIcon,
  BriefcaseIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Code2Icon,
  FlaskConicalIcon,
  Gamepad2Icon,
  GlobeIcon,
  HeartIcon,
  LayersIcon,
  MusicIcon,
  PackageIcon,
  PaletteIcon,
  PuzzleIcon,
  ArrowDownUpIcon,
  LayoutGridIcon,
  ListIcon,
  RefreshCwIcon,
  SearchIcon,
  ServerIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  Trash2Icon,
  TypeIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import { createPortal } from "react-dom";
import { AdwSplitView, type AdwSplitSidebarItem } from "@/components/ui/adw-split-view";
import { AppSquircleIcon } from "@/components/shell/AppSymbol";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import {
  WindowControlButton,
  WindowControls,
  WindowTitlebar,
} from "@/components/ui/window";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useSidebarKeyboardNav } from "@/hooks/use-sidebar-keyboard-nav";
import {
  readVfsStateJson,
  VFS_STATE_PATHS,
  writeVfsStateJson,
} from "@/lib/engine/vfs-state";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  useApps,
  useSettings,
  useSystemBackends,
  useWindowActions,
} from "@/context/DesktopStateContext";
import { usePlugins } from "@/context/PluginsContext";
import type { DiscoveredPlugin } from "@/lib/plugins/types";
import {
  type AptUpdatePackage,
  ensureFlathubRemote,
  type FlatpakAppEntry,
  type FlatpakCapabilities,
  type FlatpakUpdateEntry,
  getPopularFlathubApps,
  installFlatpakApp,
  listAptUpdates,
  listFlatpakUpdates,
  listInstalledFlatpaks,
  probeFlatpakCapabilities,
  runAptUpdateAndFlatpakRefresh,
  runAptUpgrade,
  installDebPackage,
  installFlatpakFile,
  searchFlatpaks,
  uninstallFlatpakApp,
  updateAllFlatpaks,
  updateFlatpakApp,
} from "@/lib/engine-native/flatpak";
import {
  COLLECTION_APPS,
  COLLECTION_APP_IDS_BY_COLLECTION,
  type CollectionId,
} from "@/data/app-store-collections";
import {
  setXdgAppBadgeCount,
  setXdgAppProgress,
  setXdgAppUrgent,
} from "@/lib/xdg/xdg-badge-count";
import { APP_CATALOG, type AppDefinition } from "@/data/catalog";
import {
  canonicalizeWebUrl,
  DEFAULT_BROWSER_WEB_APPS,
  fetchWebPageMetadata,
  getCachedWebDescription,
  getWebAppFaviconUrl,
  type InstalledWebApp,
} from "@/data/web-apps";
import { _ } from "@/lib/core/i18n";
import { publishWindowMenuState } from "@/lib/engine/app-bridge";
import { cn } from "@/lib/core/utils";
import {
  installWebAppDesktopEntry,
  removeWebAppDesktopEntry,
} from "@/lib/xdg/xdg-web-apps";

interface AppStoreAppProps {
  isCsd?: boolean;
  windowId?: string;
  /** `install:deb:<path>` / `install:flatpak:<path>` when a package file was opened. */
  initialPayload?: string;
}

type StoreCategory =
  | "all"
  | "installed"
  | "updates"
  | "gnome-apps"
  | "kde-apps"
  | "web-apps"
  | "web-extensions"
  | "desktop-plugins"
  | "fonts"
  | "Games"
  | "Graphics"
  | "Development"
  | "Productivity"
  | "Multimedia"
  | "Science"
  | "Utilities";

type AppGenreCategory =
  | "Games"
  | "Graphics"
  | "Development"
  | "Productivity"
  | "Multimedia"
  | "Science"
  | "Utilities";

interface SoftwareSourcesState {
  webApps: boolean;
  flatpak: boolean;
  system: boolean;
  webExtensions: boolean;
  desktopPlugins: boolean;
  fonts: boolean;
}

const DEFAULT_SOFTWARE_SOURCES: SoftwareSourcesState = {
  webApps: true,
  flatpak: true,
  system: true,
  webExtensions: true,
  desktopPlugins: true,
  fonts: true,
};

export interface ChromeExtensionEntry {
  id: string;
  name: string;
  description?: string;
  version?: string;
  enabled?: boolean;
  iconUrl?: string;
  storeUrl?: string;
  category?: AppGenreCategory;
}

interface CuratedFontEntry {
  family: string;
  category: "Sans" | "Serif" | "Monospace" | "Display";
  subtitle: string;
  defaultInstalled?: boolean;
}

const CURATED_WEB_EXTENSIONS: ChromeExtensionEntry[] = [
  {
    id: "cjpalhdlnbpafiamejdnhcphjbkeiagm",
    name: "uBlock Origin",
    description: "Efficient wide-spectrum content and ad blocker",
    version: "1.60.0",
    category: "Utilities",
    storeUrl: "https://chromewebstore.google.com/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm",
  },
  {
    id: "nngceckbapebfimnlniiiahkandclblb",
    name: "Bitwarden",
    description: "Secure and free open-source password manager",
    version: "2024.11.0",
    category: "Utilities",
    storeUrl: "https://chromewebstore.google.com/detail/bitwarden-password-manage/nngceckbapebfimnlniiiahkandclblb",
  },
  {
    id: "eimadpbcbfnmbkopoojfekhnkhdbieeh",
    name: "Dark Reader",
    description: "Dark mode for every website with custom contrast",
    version: "4.9.92",
    category: "Utilities",
    storeUrl: "https://chromewebstore.google.com/detail/dark-reader/eimadpbcbfnmbkopoojfekhnkhdbieeh",
  },
  {
    id: "fmkadmapgofadopljbjfkapdkoienihi",
    name: "React Developer Tools",
    description: "Inspect React component hierarchies in DevTools",
    version: "6.0.1",
    category: "Development",
    storeUrl: "https://chromewebstore.google.com/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi",
  },
  {
    id: "dbepggeogbaibhgnhhndojpepiihcmeb",
    name: "Vimium",
    description: "The hacker's browser: keyboard-driven navigation",
    version: "2.1.2",
    category: "Productivity",
    storeUrl: "https://chromewebstore.google.com/detail/vimium/dbepggeogbaibhgnhhndojpepiihcmeb",
  },
  {
    id: "clngdbkpkpeebahjckkjfobafhncgmne",
    name: "Stylus",
    description: "Redesign the web with custom userstyles",
    version: "2.2.0",
    category: "Graphics",
    storeUrl: "https://chromewebstore.google.com/detail/stylus/clngdbkpkpeebahjckkjfobafhncgmne",
  },
  {
    id: "hlepfoohegkhhmjieoechaddaejaokhf",
    name: "Refined GitHub",
    description: "Simplifies the GitHub interface and adds useful features",
    version: "24.11.1",
    category: "Development",
    storeUrl: "https://chromewebstore.google.com/detail/refined-github/hlepfoohegkhhmjieoechaddaejaokhf",
  },
  {
    id: "mnjggcdmjocbbbhaepdhchncahnbgone",
    name: "SponsorBlock",
    description: "Skip sponsorships, intros, and outros on YouTube",
    version: "5.9.5",
    category: "Multimedia",
    storeUrl: "https://chromewebstore.google.com/detail/sponsorblock-for-youtube/mnjggcdmjocbbbhaepdhchncahnbgone",
  },
  {
    id: "aeblfdkhhhdcdjpifhhbdiojplfjncoa",
    name: "1Password",
    description: "Password manager and passkey autofill extension",
    version: "8.10.50",
    category: "Utilities",
    storeUrl: "https://chromewebstore.google.com/detail/1password-%E2%80%93-password-mana/aeblfdkhhhdcdjpifhhbdiojplfjncoa",
  },
];

interface CuratedPluginEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  kind: "plugin" | "theme";
  sourceType: "css" | "js" | "folder";
  category: AppGenreCategory;
}

const CURATED_DESKTOP_PLUGINS: CuratedPluginEntry[] = [
  {
    id: "aurora-drift",
    name: "Aurora Drift",
    description: "Animated aurora borealis desktop wallpaper & panel glow",
    version: "1.0.0",
    kind: "theme",
    sourceType: "css",
    category: "Graphics",
  },
  {
    id: "app-indicator",
    name: "AppIndicator Tray",
    description: "Menu bar status indicators for background desktop apps",
    version: "1.0.0",
    kind: "plugin",
    sourceType: "js",
    category: "Utilities",
  },
  {
    id: "pomodoro-pill",
    name: "Pomodoro Focus Pill",
    description: "Minimalist focus timer in the top menu bar",
    version: "0.4.2",
    kind: "plugin",
    sourceType: "js",
    category: "Productivity",
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    description: "Soothing pastel dark theme for Piloti shell & GTK",
    version: "1.2.0",
    kind: "theme",
    sourceType: "css",
    category: "Graphics",
  },
  {
    id: "window-tiling-snap",
    name: "Quarter Tiling Snap",
    description: "Keyboard shortcuts for quarter-screen window snapping",
    version: "0.9.1",
    kind: "plugin",
    sourceType: "js",
    category: "Utilities",
  },
];

const CURATED_FONTS: CuratedFontEntry[] = [
  { family: "Inter", category: "Sans", subtitle: "Clean UI sans-serif designed for computer screens", defaultInstalled: true },
  { family: "Cantarell", category: "Sans", subtitle: "GNOME & Adwaita classic humanist sans-serif", defaultInstalled: true },
  { family: "Adwaita Sans", category: "Sans", subtitle: "Modern GNOME desktop interface sans-serif", defaultInstalled: true },
  { family: "Roboto", category: "Sans", subtitle: "Neo-grotesque geometric sans-serif by Google", defaultInstalled: true },
  { family: "Noto Sans", category: "Sans", subtitle: "Universal multi-script humanist sans-serif", defaultInstalled: true },
  { family: "Ubuntu", category: "Sans", subtitle: "Humanist sans-serif with distinctive warmth", defaultInstalled: false },
  { family: "JetBrains Mono", category: "Monospace", subtitle: "Developer monospace font with code ligatures", defaultInstalled: true },
  { family: "Fira Code", category: "Monospace", subtitle: "Free monospaced font with programming ligatures", defaultInstalled: false },
  { family: "Source Code Pro", category: "Monospace", subtitle: "Monospaced coding font family by Adobe", defaultInstalled: false },
  { family: "Adwaita Mono", category: "Monospace", subtitle: "GNOME default monospace terminal font", defaultInstalled: true },
  { family: "Noto Serif", category: "Serif", subtitle: "Balanced editorial serif for long-form reading", defaultInstalled: true },
  { family: "Playfair Display", category: "Display", subtitle: "High-contrast transitional serif for headings", defaultInstalled: false },
  { family: "Merriweather", category: "Serif", subtitle: "Readable screen serif with sturdy letterforms", defaultInstalled: false },
  { family: "Space Grotesk", category: "Display", subtitle: "Proportional geometric display sans-serif", defaultInstalled: false },
];

const WEB_SIMULATED_APT_UPDATES: AptUpdatePackage[] = [
  {
    name: "libgtk-4-1",
    currentVersion: "4.14.2+ds-1",
    newVersion: "4.14.4+ds-1",
    architecture: "amd64",
  },
  {
    name: "pipewire",
    currentVersion: "1.0.5-1",
    newVersion: "1.0.7-1",
    architecture: "amd64",
  },
  {
    name: "mesa-vulkan-drivers",
    currentVersion: "24.0.6-1",
    newVersion: "24.1.1-1",
    architecture: "amd64",
  },
];

const WEB_SIMULATED_FLATPAK_UPDATES: FlatpakUpdateEntry[] = [
  {
    appId: "org.gnome.Calendar",
    name: "Calendar",
    version: "46.1",
    branch: "stable",
  },
  {
    appId: "org.kde.kdenlive",
    name: "Kdenlive",
    version: "24.08.2",
    branch: "stable",
  },
];

interface DesktopPluginStoreData {
  id: string;
  name: string;
  description: string;
  version?: string;
  kind?: "plugin" | "theme";
  sourceType: "css" | "js" | "folder";
  enabled: boolean;
  installed: boolean;
  discovered?: DiscoveredPlugin;
}

interface FontStoreData {
  family: string;
  fontCategory: "Sans" | "Serif" | "Monospace" | "Display";
  source: "System" | "Web" | "Document";
  sampleText: string;
}

interface StoreItem {
  id: string;
  kind: "app" | "web" | "flatpak" | "extension" | "plugin" | "font";
  title: string;
  subtitle: string;
  category: AppGenreCategory;
  installed: boolean;
  removable: boolean;
  appDef?: AppDefinition;
  webApp?: InstalledWebApp;
  flatpak?: FlatpakAppEntry;
  extension?: ChromeExtensionEntry;
  plugin?: DesktopPluginStoreData;
  font?: FontStoreData;
  faviconUrl?: string;
}

interface StoreMetaState {
  fakeInstalledAppIds: string[];
  fakeRemovedAppIds: string[];
}

const STORE_META_STORAGE_KEY = "residence:app-store-state:v1";

const CORE_BUILTIN_IDS = new Set([
  "nautilus",
  "settings",
  "console",
  "text-editor",
  "terminal",
  "app-store",
]);

function loadStoreMeta(): StoreMetaState {
  try {
    const parsed = readVfsStateJson<Partial<StoreMetaState>>(
      VFS_STATE_PATHS.appStoreMeta,
      STORE_META_STORAGE_KEY,
    );
    if (parsed && typeof parsed === "object") {
      return {
        fakeInstalledAppIds: Array.isArray(parsed.fakeInstalledAppIds)
          ? parsed.fakeInstalledAppIds
          : [],
        fakeRemovedAppIds: Array.isArray(parsed.fakeRemovedAppIds)
          ? parsed.fakeRemovedAppIds
          : [],
      };
    }
  } catch {
    // ignore storage errors
  }
  return { fakeInstalledAppIds: [], fakeRemovedAppIds: [] };
}

function saveStoreMeta(meta: StoreMetaState) {
  try {
    writeVfsStateJson(VFS_STATE_PATHS.appStoreMeta, meta);
  } catch {
    // ignore storage errors
  }
}

function classifyWebAppCategory(
  app: InstalledWebApp,
): AppGenreCategory {
  const hay = `${app.title} ${app.keywords ?? ""}`.toLowerCase();
  if (
    /whiteboard|drawing|paint|photo|svg|3d|sculpt|sketch|diagram|image|vector/.test(
      hay,
    )
  ) {
    return "Graphics";
  }
  if (
    /developer|code|json|sql|css|regex|crypto|encode|docs|game engine/.test(hay)
  ) {
    return "Development";
  }
  if (/audio|music|sound|radio|midi|video|stream|webrtc/.test(hay)) {
    return "Multimedia";
  }
  if (/math|graph|geometry|calculator|weather|astronomy|globe/.test(hay)) {
    return "Science";
  }
  if (/markdown|notes|pomodoro|clock|meeting/.test(hay)) {
    return "Productivity";
  }
  return "Utilities";
}

function normalizeStoreCategory(
  raw: string | undefined,
  app: InstalledWebApp,
): AppGenreCategory {
  if (raw === "Multimedia" || raw === "Audio & Media") return "Multimedia";
  if (raw === "Science" || raw === "Science & Math") return "Science";
  if (
    raw === "Games" ||
    raw === "Graphics" ||
    raw === "Development" ||
    raw === "Productivity" ||
    raw === "Utilities"
  ) {
    return raw;
  }
  return classifyWebAppCategory(app);
}

function classifyCatalogCategory(
  cat: string,
): AppGenreCategory {
  if (cat === "Graphics") return "Graphics";
  if (cat === "Development") return "Development";
  if (cat === "Office" || cat === "Internet") return "Productivity";
  if (cat === "AudioVideo" || cat === "Media") return "Multimedia";
  return "Utilities";
}

const SIDEBAR_ITEMS: Array<{
  id: StoreCategory;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "all", label: "Explore", icon: <SparklesIcon className="size-4" /> },
  {
    id: "installed",
    label: "Installed",
    icon: <CheckCircle2Icon className="size-4" />,
  },
  {
    id: "updates",
    label: "Updates",
    icon: <ArrowUpCircleIcon className="size-4" />,
  },
];

const COLLECTION_ITEMS: Array<{
  id: "gnome-apps" | "kde-apps" | "web-apps" | "web-extensions" | "desktop-plugins" | "fonts";
  label: string;
  icon: React.ReactNode;
}> = [
  {
    id: "gnome-apps",
    label: "GNOME",
    icon: <LayersIcon className="size-4" />,
  },
  {
    id: "kde-apps",
    label: "KDE",
    icon: <Code2Icon className="size-4" />,
  },
  {
    id: "web-apps",
    label: "Web Apps",
    icon: <GlobeIcon className="size-4" />,
  },
  {
    id: "web-extensions",
    label: "Web Extensions",
    icon: <PuzzleIcon className="size-4" />,
  },
  {
    id: "desktop-plugins",
    label: "Desktop Plugins",
    icon: <BlocksIcon className="size-4" />,
  },
  {
    id: "fonts",
    label: "Fonts",
    icon: <TypeIcon className="size-4" />,
  },
];

function classifyFlatpakCategory(
  mainCategories?: string[],
): AppGenreCategory {
  const cats = (mainCategories ?? []).map((c) => c.toLowerCase());
  if (cats.includes("game")) return "Games";
  if (cats.includes("graphics")) return "Graphics";
  if (cats.includes("development")) return "Development";
  if (cats.includes("office")) return "Productivity";
  if (cats.includes("audiovideo")) return "Multimedia";
  if (cats.includes("science") || cats.includes("education")) {
    return "Science";
  }
  return "Utilities";
}

const CATEGORY_ITEMS: Array<{
  id: AppGenreCategory;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "Games", label: "Games", icon: <Gamepad2Icon className="size-4" /> },
  {
    id: "Graphics",
    label: "Graphics",
    icon: <PaletteIcon className="size-4" />,
  },
  {
    id: "Development",
    label: "Development",
    icon: <Code2Icon className="size-4" />,
  },
  {
    id: "Productivity",
    label: "Productivity",
    icon: <BriefcaseIcon className="size-4" />,
  },
  {
    id: "Multimedia",
    label: "Multimedia",
    icon: <MusicIcon className="size-4" />,
  },
  {
    id: "Science",
    label: "Science",
    icon: <FlaskConicalIcon className="size-4" />,
  },
  {
    id: "Utilities",
    label: "Utilities",
    icon: <WrenchIcon className="size-4" />,
  },
];

const WebAppFavicon: React.FC<{
  url?: string;
  title: string;
  className?: string;
}> = ({ url, title, className = "size-11" }) => {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [url]);

  if (!url || failed) {
    return (
      <GlobeIcon
        aria-label={title}
        className={cn(
          "shrink-0 text-sky-400",
          className,
        )}
      />
    );
  }

  return (
    <img
      src={url}
      alt={title}
      onError={() => setFailed(true)}
      className={cn(
        "shrink-0 object-contain",
        className,
      )}
      draggable={false}
    />
  );
};

function parsePackagePayload(
  payload: string | undefined,
): { format: "deb" | "flatpak"; path: string } | null {
  const match = payload?.match(/^install:(deb|flatpak):(.+)$/);
  return match ? { format: match[1] as "deb" | "flatpak", path: match[2] ?? "" } : null;
}

const SOURCE_TOGGLES: ReadonlyArray<{
  key: keyof SoftwareSourcesState;
  label: () => string;
}> = [
  { key: "webApps", label: () => _("Web Apps") },
  { key: "flatpak", label: () => _("Flatpak") },
  { key: "system", label: () => _("System (Debian)") },
  { key: "webExtensions", label: () => _("Web Extensions") },
  { key: "desktopPlugins", label: () => _("Desktop Plugins") },
  { key: "fonts", label: () => _("Fonts") },
];

export const AppStoreApp: React.FC<AppStoreAppProps> = ({
  isCsd = false,
  windowId,
  initialPayload,
}) => {
  const domicile = useDomicile();
  const { getAppIconUrl, refreshXdgApps } = useApps();
  const { isBrowserRuntime, settings, updateSettings } = useSettings();
  const { pushNotification } = useSystemBackends();
  const { launchApp, openWebUrl } = useWindowActions();
  const { plugins: discoveredPlugins, togglePlugin } = usePlugins();

  const [flatpakCaps, setFlatpakCaps] = React.useState<FlatpakCapabilities>({
    available: false,
    hasFlathub: false,
    hasUserFlathub: false,
  });
  const [installedFlatpaks, setInstalledFlatpaks] = React.useState<
    FlatpakAppEntry[]
  >([]);
  const [flathubEntries, setFlathubEntries] = React.useState<FlatpakAppEntry[]>(
    () => getPopularFlathubApps(),
  );
  const [featuredSlide, setFeaturedSlide] = React.useState(0);

  const [category, setCategory] = React.useState<StoreCategory>("all");
  const [query, setQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const sidebarRef = React.useRef<HTMLElement | null>(null);
  const mainRef = React.useRef<HTMLElement | null>(null);

  const [sources, setSources] = React.useState<SoftwareSourcesState>(() => {
    const saved = readVfsStateJson<Partial<SoftwareSourcesState>>(
      VFS_STATE_PATHS.appStoreSources,
      "piloti.appstore.sources.v1",
    );
    return {
      webApps: saved?.webApps ?? DEFAULT_SOFTWARE_SOURCES.webApps,
      flatpak: saved?.flatpak ?? DEFAULT_SOFTWARE_SOURCES.flatpak,
      system: saved?.system ?? DEFAULT_SOFTWARE_SOURCES.system,
      webExtensions:
        saved?.webExtensions ?? DEFAULT_SOFTWARE_SOURCES.webExtensions,
      desktopPlugins:
        saved?.desktopPlugins ?? DEFAULT_SOFTWARE_SOURCES.desktopPlugins,
      fonts: saved?.fonts ?? DEFAULT_SOFTWARE_SOURCES.fonts,
    };
  });

  const [detectedFontFamilies, setDetectedFontFamilies] = React.useState<
    Array<{ family: string; source: "Document" | "System" }>
  >([]);

  React.useEffect(() => {
    let cancelled = false;
    const found = new Map<string, "Document" | "System">();

    if (typeof document !== "undefined" && "fonts" in document) {
      try {
        for (const face of document.fonts) {
          const family = face.family.replace(/^["']|["']$/g, "").trim();
          if (family && !found.has(family.toLowerCase())) {
            found.set(family.toLowerCase(), "Document");
            // Keep original casing by storing in a second pass or array
          }
        }
      } catch {
        // ignore document.fonts errors
      }
    }

    const collectDocumentFonts = (): Array<{
      family: string;
      source: "Document" | "System";
    }> => {
      const byLower = new Map<
        string,
        { family: string; source: "Document" | "System" }
      >();
      if (typeof document !== "undefined" && "fonts" in document) {
        try {
          for (const face of document.fonts) {
            const family = face.family.replace(/^["']|["']$/g, "").trim();
            if (family && !byLower.has(family.toLowerCase())) {
              byLower.set(family.toLowerCase(), { family, source: "Document" });
            }
          }
        } catch {
          // ignore
        }
      }
      return Array.from(byLower.values());
    };

    const initial = collectDocumentFonts();
    if (!cancelled) {
      setDetectedFontFamilies(initial);
    }

    if (!isBrowserRuntime) {
      void (async () => {
        try {
          const res = await domicile.processes.run([
            "fc-list",
            ":",
            "family",
          ]);
          if (cancelled) return;
          const stdout = res.match({
            Ok: (ran) => (ran.code === 0 ? ran.stdout : ""),
            Err: () => "",
          });
          if (!stdout) return;
          const byLower = new Map<
            string,
            { family: string; source: "Document" | "System" }
          >();
          for (const item of collectDocumentFonts()) {
            byLower.set(item.family.toLowerCase(), item);
          }
          for (const line of stdout.split(/\r?\n/)) {
            for (const part of line.split(",")) {
              const family = part.trim();
              if (!family) continue;
              const key = family.toLowerCase();
              if (!byLower.has(key)) {
                byLower.set(key, { family, source: "System" });
              }
            }
          }
          if (!cancelled) {
            setDetectedFontFamilies(Array.from(byLower.values()));
          }
        } catch {
          // ignore fc-list failures
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [domicile, isBrowserRuntime]);
  const updateSources = React.useCallback(
    (patch: Partial<SoftwareSourcesState>) => {
      setSources((prev) => {
        const next = { ...prev, ...patch };
        writeVfsStateJson(
          VFS_STATE_PATHS.appStoreSources,
          next,
        );
        return next;
      });
    },
    [],
  );

  const [aptUpdates, setAptUpdates] = React.useState<AptUpdatePackage[]>(() =>
    isBrowserRuntime ? WEB_SIMULATED_APT_UPDATES : [],
  );
  const [flatpakUpdates, setFlatpakUpdates] = React.useState<
    FlatpakUpdateEntry[]
  >(() => (isBrowserRuntime ? WEB_SIMULATED_FLATPAK_UPDATES : []));
  const [systemUpdatesExpanded, setSystemUpdatesExpanded] =
    React.useState(false);
  const [reloadingUpdates, setReloadingUpdates] = React.useState(false);
  const [updatingTarget, setUpdatingTarget] = React.useState<string | null>(
    null,
  );
  const [opStatus, setOpStatus] = React.useState<{
    progress: number | null;
    statusLine?: string;
  } | null>(null);
  const viewMode: "list" | "grid" = "list";
  const [sortMode, setSortMode] = React.useState<
    "default" | "name" | "category" | "installed"
  >("default");
  const busyRef = React.useRef(false);
  const beginOp = React.useCallback((): boolean => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setXdgAppUrgent("app-store", false);
    return true;
  }, []);
  const endOp = React.useCallback(() => {
    busyRef.current = false;
  }, []);

  const totalUpdatesCount =
    (sources.system && aptUpdates.length > 0 ? 1 : 0) +
    (sources.flatpak ? flatpakUpdates.length : 0);

  React.useEffect(() => {
    setXdgAppBadgeCount("app-store", totalUpdatesCount);
  }, [totalUpdatesCount]);

  const refreshUpdates = React.useCallback(async () => {
    if (isBrowserRuntime) return;
    const [aptList, fpList] = await Promise.all([
      sources.system ? listAptUpdates(domicile) : Promise.resolve([]),
      sources.flatpak ? listFlatpakUpdates(domicile) : Promise.resolve([]),
    ]);
    setAptUpdates(aptList);
    setFlatpakUpdates(fpList);
  }, [domicile, isBrowserRuntime, sources.flatpak, sources.system]);

  React.useEffect(() => {
    void refreshUpdates();
  }, [refreshUpdates]);

  const {
    highlightedId: highlightedCategory,
    onSidebarKeyDown,
    onSidebarKeyUp,
    onContentKeyDown,
  } = useSidebarKeyboardNav({
    itemIds: [...SIDEBAR_ITEMS, ...COLLECTION_ITEMS, ...CATEGORY_ITEMS].map(
      (e) => e.id,
    ),
    activeId: category,
    onActivate: (id) => setCategory(id),
    sidebarRef,
    contentRef: mainRef,
  });
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [meta, setMeta] = React.useState<StoreMetaState>(loadStoreMeta);
  const [pendingOp, setPendingOp] = React.useState<{
    id: string;
    kind: "installing" | "removing";
    /** `null` renders an indeterminate progress bar (no `aria-valuenow`). */
    progress: number | null;
    statusLine?: string;
  } | null>(null);
  const opRafRef = React.useRef<number | null>(null);

  const isBusy =
    pendingOp !== null ||
    opStatus !== null ||
    reloadingUpdates ||
    updatingTarget !== null;

  React.useEffect(() => {
    if (pendingOp) {
      setXdgAppProgress(
        "app-store",
        pendingOp.progress === null ? null : pendingOp.progress / 100,
      );
    } else if (opStatus) {
      setXdgAppProgress(
        "app-store",
        opStatus.progress === null ? null : opStatus.progress / 100,
      );
    } else if (reloadingUpdates || updatingTarget !== null) {
      setXdgAppProgress("app-store", null);
    } else {
      setXdgAppProgress("app-store", undefined);
    }
    return () => {
      setXdgAppProgress("app-store", undefined);
    };
  }, [opStatus, pendingOp, reloadingUpdates, updatingTarget]);

  React.useEffect(() => {
    return () => {
      if (opRafRef.current !== null) {
        cancelAnimationFrame(opRafRef.current);
      }
    };
  }, []);

  const updateMeta = React.useCallback(
    (updater: (prev: StoreMetaState) => StoreMetaState) => {
      setMeta((prev) => {
        const next = updater(prev);
        saveStoreMeta(next);
        return next;
      });
    },
    [],
  );

  const installedWebUrls = React.useMemo(() => {
    const set = new Set<string>();
    for (const app of settings.installedWebApps) {
      set.add(canonicalizeWebUrl(app.url) ?? app.url);
    }
    return set;
  }, [settings.installedWebApps]);

  const [descriptionTick, setDescriptionTick] = React.useState(0);
  const [customWebUrl, setCustomWebUrl] = React.useState("");

  const handleAddCustomWebApp = (e: React.FormEvent) => {
    e.preventDefault();
    const canonical = canonicalizeWebUrl(customWebUrl);
    if (!canonical) return;
    const hostTitle = new URL(canonical).hostname.replace(/^www\./, "");
    if (!installedWebUrls.has(canonical)) {
      const initialApp: InstalledWebApp = {
        id: `web:${canonical}`,
        title: hostTitle,
        url: canonical,
        iconUrl: getWebAppFaviconUrl(canonical),
        category: "Internet",
      };
      void installWebAppDesktopEntry(domicile, isBrowserRuntime, initialApp);
      void fetchWebPageMetadata(canonical).then(({ title, iconUrl, startUrl }) => {
        if (title || iconUrl || startUrl) {
          void installWebAppDesktopEntry(domicile, isBrowserRuntime, {
            ...initialApp,
            ...(title ? { title } : {}),
            ...(iconUrl ? { iconUrl } : {}),
            ...(startUrl ? { url: startUrl } : {}),
          });
        }
        setDescriptionTick((n) => n + 1);
      });
    }
    setCustomWebUrl("");
    openWebUrl(canonical);
  };

  React.useEffect(() => {
    const missing = DEFAULT_BROWSER_WEB_APPS.filter(
      (app) => getCachedWebDescription(app.url) === undefined
    );
    if (missing.length === 0) return;

    const controller = new AbortController();
    let cancelled = false;
    Promise.allSettled(
      missing.map(async (app) => {
        const res = await fetchWebPageMetadata(app.url, controller.signal);
        if (!cancelled && res.description) {
          setDescriptionTick((n) => n + 1);
        }
      })
    );
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const installedFlatpakIds = React.useMemo(
    () => new Set(installedFlatpaks.map((f) => f.appId)),
    [installedFlatpaks],
  );

  const refreshFlatpakList = React.useCallback(async () => {
    if (isBrowserRuntime) return;
    const [caps, list] = await Promise.all([
      probeFlatpakCapabilities(domicile),
      listInstalledFlatpaks(domicile),
    ]);
    setFlatpakCaps(caps);
    setInstalledFlatpaks(list);
  }, [domicile, isBrowserRuntime]);

  React.useEffect(() => {
    void refreshFlatpakList();
  }, [refreshFlatpakList]);

  React.useEffect(() => {
    const q = query.trim();
    if (!q) {
      setFlathubEntries(getPopularFlathubApps(installedFlatpakIds));
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void searchFlatpaks(
        domicile,
        q,
        installedFlatpakIds,
        controller.signal,
      ).then((entries) => {
        if (!controller.signal.aborted) {
          setFlathubEntries(entries);
        }
      });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [domicile, installedFlatpakIds, query]);

  const flatpakItems = React.useMemo<StoreItem[]>(() => {
    const popularById = new Map(
      getPopularFlathubApps().map((entry) => [entry.appId, entry]),
    );
    const byId = new Map<string, FlatpakAppEntry>();
    for (const entry of installedFlatpaks) {
      const popular = popularById.get(entry.appId);
      byId.set(entry.appId, {
        ...popular,
        ...entry,
        description: entry.description || popular?.description,
        iconUrl: entry.iconUrl || popular?.iconUrl,
        mainCategories: entry.mainCategories ?? popular?.mainCategories,
        installed: true,
      });
    }
    for (const entry of COLLECTION_APPS) {
      const existing = byId.get(entry.appId);
      byId.set(
        entry.appId,
        existing
          ? {
              ...entry,
              ...existing,
              description: existing.description || entry.description,
              iconUrl: existing.iconUrl || entry.iconUrl,
              mainCategories: existing.mainCategories ?? entry.mainCategories,
            }
          : { ...entry, installed: installedFlatpakIds.has(entry.appId) },
      );
    }
    for (const entry of flathubEntries) {
      const existing = byId.get(entry.appId);
      byId.set(
        entry.appId,
        existing
          ? {
              ...entry,
              ...existing,
              description: existing.description || entry.description,
              iconUrl: existing.iconUrl || entry.iconUrl,
              mainCategories: existing.mainCategories ?? entry.mainCategories,
              installed: true,
            }
          : { ...entry, installed: installedFlatpakIds.has(entry.appId) },
      );
    }
    return Array.from(byId.values()).map((fp) => ({
      id: `flatpak:${fp.appId}`,
      kind: "flatpak",
      title: fp.name,
      subtitle: fp.description || fp.appId,
      category: classifyFlatpakCategory(fp.mainCategories),
      installed: fp.installed,
      removable: fp.installed,
      flatpak: fp,
      faviconUrl: fp.iconUrl || getAppIconUrl(fp.appId),
    }));
  }, [flathubEntries, getAppIconUrl, installedFlatpakIds, installedFlatpaks]);

  const installedChromeExtensions = React.useMemo<ChromeExtensionEntry[]>(() => {
    const raw = (
      settings as unknown as { chromeExtensions?: ChromeExtensionEntry[] }
    ).chromeExtensions;
    return Array.isArray(raw) ? raw : [];
  }, [settings]);

  const items = React.useMemo<StoreItem[]>(() => {
    void descriptionTick;
    const fakeInstalledSet = new Set(meta.fakeInstalledAppIds);
    const fakeRemovedSet = new Set(meta.fakeRemovedAppIds);

    const webItems: StoreItem[] = DEFAULT_BROWSER_WEB_APPS.map((webApp) => {
      const canonical = canonicalizeWebUrl(webApp.url) ?? webApp.url;
      const installed = installedWebUrls.has(canonical);
      const cachedDesc = getCachedWebDescription(webApp.url);
      return {
        id: webApp.id,
        kind: "web",
        title: webApp.title,
        subtitle:
          cachedDesc || new URL(webApp.url).hostname.replace(/^www\./, ""),
        category: normalizeStoreCategory(webApp.category, webApp),
        installed,
        removable: true,
        webApp,
        faviconUrl: getWebAppFaviconUrl(webApp.url),
      };
    });

    const appItems: StoreItem[] = APP_CATALOG.filter(
      (app) => app.id !== "app-store",
    ).map((app) => {
      const isCore = CORE_BUILTIN_IDS.has(app.id);
      const installed = isCore
        ? !fakeRemovedSet.has(app.id)
        : fakeInstalledSet.has(app.id);
      return {
        id: `app:${app.id}`,
        kind: "app",
        title: _(app.name),
        subtitle: _(app.description),
        category: classifyCatalogCategory(app.category),
        installed,
        removable: !isCore,
        appDef: app,
      };
    });

    const installedExtById = new Map(
      installedChromeExtensions.map((ext) => [ext.id, ext]),
    );
    const extMerged = new Map<string, ChromeExtensionEntry>();
    for (const curated of CURATED_WEB_EXTENSIONS) {
      extMerged.set(curated.id, curated);
    }
    for (const installed of installedChromeExtensions) {
      const existing = extMerged.get(installed.id);
      extMerged.set(
        installed.id,
        existing ? { ...existing, ...installed } : installed,
      );
    }
    const extensionItems: StoreItem[] = Array.from(extMerged.values()).map(
      (ext) => {
        const installed = installedExtById.has(ext.id);
        return {
          id: `ext:${ext.id}`,
          kind: "extension",
          title: ext.name,
          subtitle:
            ext.description ||
            _("Chrome Web Store extension") + (ext.version ? ` · v${ext.version}` : ""),
          category: ext.category ?? "Utilities",
          installed,
          removable: installed,
          extension: ext,
          faviconUrl: ext.iconUrl,
        };
      },
    );

    const discoveredById = new Map(
      discoveredPlugins.map((p) => [p.id, p]),
    );
    const pluginItems: StoreItem[] = [];
    const seenPluginIds = new Set<string>();
    for (const p of discoveredPlugins) {
      seenPluginIds.add(p.id);
      const curated = CURATED_DESKTOP_PLUGINS.find((c) => c.id === p.id);
      pluginItems.push({
        id: `plugin:${p.id}`,
        kind: "plugin",
        title: p.name,
        subtitle:
          p.description ||
          curated?.description ||
          `${p.kind === "theme" ? _("Theme") : _("Plugin")} · ${p.sourceType.toUpperCase()}`,
        category: curated?.category ?? (p.kind === "theme" ? "Graphics" : "Utilities"),
        installed: true,
        removable: false,
        plugin: {
          id: p.id,
          name: p.name,
          description: p.description || curated?.description || "",
          version: p.version,
          kind: p.kind,
          sourceType: p.sourceType,
          enabled: p.enabled,
          installed: true,
          discovered: p,
        },
      });
    }
    for (const curated of CURATED_DESKTOP_PLUGINS) {
      if (seenPluginIds.has(curated.id)) continue;
      const isInstalled =
        fakeInstalledSet.has(`plugin:${curated.id}`) &&
        !fakeRemovedSet.has(`plugin:${curated.id}`);
      const isEnabled =
        isInstalled && settings.enabledPluginIds.includes(curated.id);
      pluginItems.push({
        id: `plugin:${curated.id}`,
        kind: "plugin",
        title: curated.name,
        subtitle: curated.description,
        category: curated.category,
        installed: isInstalled,
        removable: isInstalled,
        plugin: {
          id: curated.id,
          name: curated.name,
          description: curated.description,
          version: curated.version,
          kind: curated.kind,
          sourceType: curated.sourceType,
          enabled: isEnabled,
          installed: isInstalled,
          discovered: discoveredById.get(curated.id),
        },
      });
    }

    const fontMap = new Map<string, StoreItem>();
    const detectedLower = new Map(
      detectedFontFamilies.map((f) => [f.family.toLowerCase(), f]),
    );
    for (const curated of CURATED_FONTS) {
      const key = curated.family.toLowerCase();
      const detected = detectedLower.get(key);
      const fontId = `font:${key}`;
      const installed =
        Boolean(detected) ||
        (curated.defaultInstalled
          ? !fakeRemovedSet.has(fontId)
          : fakeInstalledSet.has(fontId));
      fontMap.set(key, {
        id: fontId,
        kind: "font",
        title: curated.family,
        subtitle: curated.subtitle,
        category: "Graphics",
        installed,
        removable: !detected && !curated.defaultInstalled && installed,
        font: {
          family: curated.family,
          fontCategory: curated.category,
          source: detected ? detected.source : "Web",
          sampleText: "Aa Bb Cc 123 — The quick brown fox jumps",
        },
      });
    }
    for (const det of detectedFontFamilies) {
      const key = det.family.toLowerCase();
      if (fontMap.has(key)) continue;
      const isMono = /mono|code|courier|console|terminal|fira/i.test(det.family);
      const isSerif = /serif|garamond|georgia|times|palatino|merriweather|playfair/i.test(
        det.family,
      );
      fontMap.set(key, {
        id: `font:${key}`,
        kind: "font",
        title: det.family,
        subtitle:
          det.source === "System"
            ? _("System font (fc-list)")
            : _("Loaded document font"),
        category: "Graphics",
        installed: true,
        removable: false,
        font: {
          family: det.family,
          fontCategory: isMono ? "Monospace" : isSerif ? "Serif" : "Sans",
          source: det.source,
          sampleText: "Aa Bb Cc 123 — The quick brown fox jumps",
        },
      });
    }
    const fontItems = Array.from(fontMap.values());

    return [
      ...(sources.system ? appItems : []),
      ...(sources.webApps ? webItems : []),
      ...(sources.flatpak ? flatpakItems : []),
      ...(sources.webExtensions ? extensionItems : []),
      ...(sources.desktopPlugins ? pluginItems : []),
      ...(sources.fonts ? fontItems : []),
    ];
  }, [
    installedWebUrls,
    installedChromeExtensions,
    discoveredPlugins,
    detectedFontFamilies,
    settings.enabledPluginIds,
    meta,
    descriptionTick,
    flatpakItems,
    sources.flatpak,
    sources.system,
    sources.webApps,
    sources.webExtensions,
    sources.desktopPlugins,
    sources.fonts,
  ]);

  const matchesCategory = React.useCallback((item: StoreItem, cat: StoreCategory): boolean => {
    if (cat === "updates") return false;
    if (cat === "installed") return item.installed;
    if (cat === "all") return true;
    if (cat === "web-apps") return item.kind === "web";
    if (cat === "web-extensions") return item.kind === "extension";
    if (cat === "desktop-plugins") return item.kind === "plugin";
    if (cat === "fonts") return item.kind === "font";
    if (cat === "gnome-apps" || cat === "kde-apps") {
      const appId = item.kind === "flatpak" ? item.flatpak?.appId : undefined;
      if (!appId) return false;
      return cat === "kde-apps"
        ? COLLECTION_APP_IDS_BY_COLLECTION["kde-apps"].has(appId)
        : COLLECTION_APP_IDS_BY_COLLECTION["core-apps"].has(appId) ||
            COLLECTION_APP_IDS_BY_COLLECTION["circle-apps"].has(appId);
    }
    return item.category === cat;
  }, []);

  const matchesQuery = React.useCallback((item: StoreItem, q: string): boolean => {
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.flatpak?.appId.toLowerCase().includes(q) ?? false) ||
      (item.webApp?.keywords?.toLowerCase().includes(q) ?? false) ||
      (item.extension?.id.toLowerCase().includes(q) ?? false) ||
      (item.plugin?.id.toLowerCase().includes(q) ?? false) ||
      (item.font?.fontCategory.toLowerCase().includes(q) ?? false)
    );
  }, []);

  const filteredItems = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => matchesCategory(item, category) && matchesQuery(item, q));
  }, [items, category, query, matchesCategory, matchesQuery]);

  const sortedItems = React.useMemo(() => {
    if (sortMode === "default") return filteredItems;
    const copy = [...filteredItems];
    if (sortMode === "name") {
      copy.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortMode === "category") {
      copy.sort(
        (a, b) =>
          a.category.localeCompare(b.category) || a.title.localeCompare(b.title),
      );
    } else if (sortMode === "installed") {
      copy.sort(
        (a, b) =>
          Number(b.installed) - Number(a.installed) ||
          a.title.localeCompare(b.title),
      );
    }
    return copy;
  }, [filteredItems, sortMode]);

  const webAppsByCategory = React.useMemo(() => {
    if (category !== "web-apps") return [];
    const groups = new Map<AppGenreCategory, StoreItem[]>();
    for (const item of sortedItems) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return CATEGORY_ITEMS.map((cat) => ({
      id: cat.id,
      title: _(cat.label),
      list: groups.get(cat.id) ?? [],
    })).filter((g) => g.list.length > 0);
  }, [category, sortedItems]);

  const flatpakUpdateById = React.useMemo(
    () => new Map(flatpakUpdates.map((u) => [u.appId, u])),
    [flatpakUpdates],
  );

  const sidebarItems = React.useMemo<AdwSplitSidebarItem[]>(() => {
    // Counts follow the search; only the three top entries and the current one show one.
    const q = query.trim().toLowerCase();
    const countFor = (id: StoreCategory): number | undefined => {
      if (id === "updates") return totalUpdatesCount > 0 ? totalUpdatesCount : undefined;
      return items.filter((i) => matchesCategory(i, id) && matchesQuery(i, q)).length;
    };
    return [...SIDEBAR_ITEMS, ...COLLECTION_ITEMS, ...CATEGORY_ITEMS].map(
      (entry, idx) => ({
        id: entry.id,
        label: _(entry.label),
        icon: entry.icon,
        selected: highlightedCategory === entry.id,
        onClick: () => setCategory(entry.id),
        badge: idx < SIDEBAR_ITEMS.length || highlightedCategory === entry.id ? countFor(entry.id) : undefined,
        separatorAfter:
          idx === SIDEBAR_ITEMS.length - 1 ||
          idx === SIDEBAR_ITEMS.length + COLLECTION_ITEMS.length - 1,
      }),
    );
  }, [highlightedCategory, items, matchesCategory, matchesQuery, query, totalUpdatesCount]);

  const webAndAppItems = React.useMemo(
    () =>
      sortedItems.filter(
        (item) => item.kind === "app" || item.kind === "web",
      ),
    [sortedItems],
  );

  const flatpakStoreItems = React.useMemo(
    () => sortedItems.filter((item) => item.kind === "flatpak"),
    [sortedItems],
  );

  const extensionStoreItems = React.useMemo(
    () => sortedItems.filter((item) => item.kind === "extension"),
    [sortedItems],
  );

  const pluginStoreItems = React.useMemo(
    () => sortedItems.filter((item) => item.kind === "plugin"),
    [sortedItems],
  );

  const fontStoreItems = React.useMemo(
    () => sortedItems.filter((item) => item.kind === "font"),
    [sortedItems],
  );

  const featuredItems = React.useMemo(() => {
    const withIcons = flatpakItems.filter((item) => item.faviconUrl);
    return (withIcons.length > 0 ? withIcons : flatpakItems).slice(0, 6);
  }, [flatpakItems]);

  const activeSlideIndex =
    featuredItems.length > 0 ? featuredSlide % featuredItems.length : 0;
  const activeFeaturedItem = featuredItems[activeSlideIndex] ?? null;

  const selectedItem = React.useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  const pendingAbortRef = React.useRef<AbortController | null>(null);

  const handleCancelPendingOp = React.useCallback(() => {
    if (opRafRef.current !== null) {
      cancelAnimationFrame(opRafRef.current);
      opRafRef.current = null;
    }
    pendingAbortRef.current?.abort();
    pendingAbortRef.current = null;
    setPendingOp(null);
    endOp();
  }, [endOp]);

  const runFakeProgress = React.useCallback(
    (id: string, kind: "installing" | "removing", onComplete: () => void) => {
      if (pendingOp) return;
      const duration = 500 + Math.random() * 500;
      const start = performance.now();
      setPendingOp({ id, kind, progress: 5 });

      const step = (now: number) => {
        const elapsed = now - start;
        const pct = Math.min(100, Math.round((elapsed / duration) * 100));
        if (elapsed < duration) {
          setPendingOp({ id, kind, progress: Math.max(5, pct) });
          opRafRef.current = requestAnimationFrame(step);
        } else {
          opRafRef.current = null;
          setPendingOp(null);
          onComplete();
        }
      };

      opRafRef.current = requestAnimationFrame(step);
    },
    [pendingOp],
  );

  const commitInstall = React.useCallback(
    (item: StoreItem) => {
      if (item.kind === "web" && item.webApp) {
        const targetCanonical =
          canonicalizeWebUrl(item.webApp.url) ?? item.webApp.url;
        if (
          !settings.installedWebApps.some(
            (w) => (canonicalizeWebUrl(w.url) ?? w.url) === targetCanonical,
          )
        ) {
          void installWebAppDesktopEntry(
            domicile,
            isBrowserRuntime,
            item.webApp,
          );
        }
        return;
      }
      if (item.kind === "extension" && item.extension) {
        const ext = item.extension;
        if (!installedChromeExtensions.some((e) => e.id === ext.id)) {
          updateSettings({
            chromeExtensions: [
              ...installedChromeExtensions,
              { ...ext, enabled: true },
            ],
          } as Partial<typeof settings>);
          pushNotification({
            appName: "App Store",
            summary: _("Installed %s", ext.name),
            body: _("Web extension enabled in browser"),
          });
        }
        return;
      }
      if (item.kind === "plugin" && item.plugin) {
        const pluginId = item.plugin.id;
        updateMeta((prev) => ({
          ...prev,
          fakeInstalledAppIds: prev.fakeInstalledAppIds.includes(
            `plugin:${pluginId}`,
          )
            ? prev.fakeInstalledAppIds
            : [...prev.fakeInstalledAppIds, `plugin:${pluginId}`],
          fakeRemovedAppIds: prev.fakeRemovedAppIds.filter(
            (id) => id !== `plugin:${pluginId}`,
          ),
        }));
        if (!settings.enabledPluginIds.includes(pluginId)) {
          updateSettings({
            enabledPluginIds: [...settings.enabledPluginIds, pluginId],
          });
        }
        return;
      }
      if (item.kind === "font" && item.font) {
        const fontId = item.id;
        updateMeta((prev) => ({
          ...prev,
          fakeInstalledAppIds: prev.fakeInstalledAppIds.includes(fontId)
            ? prev.fakeInstalledAppIds
            : [...prev.fakeInstalledAppIds, fontId],
          fakeRemovedAppIds: prev.fakeRemovedAppIds.filter(
            (id) => id !== fontId,
          ),
        }));
        return;
      }
      if (item.kind === "app" && item.appDef) {
        const appId = item.appDef.id;
        updateMeta((prev) => ({
          ...prev,
          fakeInstalledAppIds: prev.fakeInstalledAppIds.includes(appId)
            ? prev.fakeInstalledAppIds
            : [...prev.fakeInstalledAppIds, appId],
          fakeRemovedAppIds: prev.fakeRemovedAppIds.filter((id) => id !== appId),
        }));
      }
    },
    [
      domicile,
      installedChromeExtensions,
      isBrowserRuntime,
      pushNotification,
      settings.enabledPluginIds,
      settings.installedWebApps,
      updateMeta,
      updateSettings,
    ],
  );

  const commitUninstall = React.useCallback(
    (item: StoreItem) => {
      if (!item.removable) return;
      if (item.kind === "web" && item.webApp) {
        void removeWebAppDesktopEntry(
          domicile,
          isBrowserRuntime,
          item.webApp,
        );
        if (settings.pinnedAppIds.includes(item.webApp.id)) {
          updateSettings({
            pinnedAppIds: settings.pinnedAppIds.filter(
              (id) => id !== item.webApp?.id,
            ),
          });
        }
        return;
      }
      if (item.kind === "extension" && item.extension) {
        const ext = item.extension;
        updateSettings({
          chromeExtensions: installedChromeExtensions.filter(
            (e) => e.id !== ext.id,
          ),
        } as Partial<typeof settings>);
        pushNotification({
          appName: "App Store",
          summary: _("Uninstalled %s", ext.name),
          body: ext.id,
        });
        return;
      }
      if (item.kind === "plugin" && item.plugin) {
        const pluginId = item.plugin.id;
        updateMeta((prev) => ({
          ...prev,
          fakeInstalledAppIds: prev.fakeInstalledAppIds.filter(
            (id) => id !== `plugin:${pluginId}`,
          ),
          fakeRemovedAppIds: prev.fakeRemovedAppIds.includes(`plugin:${pluginId}`)
            ? prev.fakeRemovedAppIds
            : [...prev.fakeRemovedAppIds, `plugin:${pluginId}`],
        }));
        if (settings.enabledPluginIds.includes(pluginId)) {
          updateSettings({
            enabledPluginIds: settings.enabledPluginIds.filter(
              (id) => id !== pluginId,
            ),
          });
        }
        return;
      }
      if (item.kind === "font" && item.font) {
        const fontId = item.id;
        updateMeta((prev) => ({
          ...prev,
          fakeInstalledAppIds: prev.fakeInstalledAppIds.filter(
            (id) => id !== fontId,
          ),
          fakeRemovedAppIds: prev.fakeRemovedAppIds.includes(fontId)
            ? prev.fakeRemovedAppIds
            : [...prev.fakeRemovedAppIds, fontId],
        }));
        return;
      }
      if (item.kind === "app" && item.appDef) {
        const appId = item.appDef.id;
        updateMeta((prev) => ({
          ...prev,
          fakeInstalledAppIds: prev.fakeInstalledAppIds.filter(
            (id) => id !== appId,
          ),
          fakeRemovedAppIds: prev.fakeRemovedAppIds.includes(appId)
            ? prev.fakeRemovedAppIds
            : [...prev.fakeRemovedAppIds, appId],
        }));
      }
    },
    [
      domicile,
      installedChromeExtensions,
      isBrowserRuntime,
      pushNotification,
      settings.enabledPluginIds,
      settings.pinnedAppIds,
      updateMeta,
      updateSettings,
    ],
  );

  const handleInstall = React.useCallback(
    (item: StoreItem) => {
      if (item.kind === "flatpak" && item.flatpak) {
        if (!beginOp()) return;
        const fp = item.flatpak;
        if (isBrowserRuntime) {
          pushNotification({
            appName: "App Store",
            summary: `Flatpak: ${fp.name}`,
            body: `Run on Domicile Linux: flatpak install --user -y flathub ${fp.appId}`,
          });
          return;
        }
        if (pendingOp) return;
        const controller = new AbortController();
        pendingAbortRef.current = controller;
        setSelectedId(item.id);
        setPendingOp({
          id: item.id,
          kind: "installing",
          progress: null,
          statusLine: `flatpak install --user -y ${fp.origin || "flathub"} ${fp.appId}`,
        });
        void (async () => {
          const targetRemote = fp.origin || "flathub";
          if (targetRemote === "flathub" && !flatpakCaps.hasUserFlathub) {
            setPendingOp({
              id: item.id,
              kind: "installing",
              progress: null,
              statusLine: "flatpak remote-add --user flathub…",
            });
            await ensureFlathubRemote(domicile);
          }
          if (controller.signal.aborted) {
            setPendingOp(null);
            return;
          }
          const res = await installFlatpakApp(
            domicile,
            fp.appId,
            targetRemote,
            ({ line, progress }) =>
              setPendingOp((prev) =>
                prev && prev.id === item.id
                  ? {
                      ...prev,
                      progress: progress !== null ? progress : prev.progress,
                      statusLine: line,
                    }
                  : prev,
              ),
            controller.signal,
          );
          if (pendingAbortRef.current === controller) {
            pendingAbortRef.current = null;
          }
          setPendingOp(null);
          if (res.canceled) {
            pushNotification({
              appName: "App Store",
              summary: _("Canceled installing %s", fp.name),
              body: fp.appId,
            });
          } else if (res.ok) {
            await refreshFlatpakList();
            await refreshXdgApps();
            pushNotification({
              appName: "App Store",
              summary: `Installed ${fp.name}`,
              body: fp.appId,
            });
          } else {
            pushNotification({
              appName: "App Store",
              summary: `Failed to install ${fp.name}`,
              body: res.error || "Flatpak install failed",
              urgency: "critical",
            });
          }
          endOp();
        })();
        return;
      }
      if (!beginOp()) return;
      runFakeProgress(item.id, "installing", () => {
        commitInstall(item);
        endOp();
      });
    },
    [
      commitInstall,
      domicile,
      flatpakCaps.hasUserFlathub,
      isBrowserRuntime,
      pendingOp,
      pushNotification,
      refreshFlatpakList,
      refreshXdgApps,
      runFakeProgress,
    ],
  );

  const handleUninstall = React.useCallback(
    (item: StoreItem) => {
      if (!item.removable) return;
      if (item.kind === "flatpak" && item.flatpak) {
        if (isBrowserRuntime || !beginOp()) return;
        if (!beginOp()) return;
        const fp = item.flatpak;
        const controller = new AbortController();
        pendingAbortRef.current = controller;
        setSelectedId(item.id);
        setPendingOp({
          id: item.id,
          kind: "removing",
          progress: null,
          statusLine: `flatpak uninstall -y ${fp.appId}`,
        });
        void (async () => {
          const res = await uninstallFlatpakApp(domicile, fp.appId, {
            installation: fp.installation,
            signal: controller.signal,
            onUpdate: ({ line, progress }) =>
              setPendingOp((prev) =>
                prev && prev.id === item.id
                  ? {
                      ...prev,
                      progress: progress !== null ? progress : prev.progress,
                      statusLine: line,
                    }
                  : prev,
              ),
          });
          if (pendingAbortRef.current === controller) {
            pendingAbortRef.current = null;
          }
          setPendingOp(null);
          if (res.canceled) {
            return;
          }
          if (res.ok) {
            await refreshFlatpakList();
            await refreshXdgApps();
            pushNotification({
              appName: "App Store",
              summary: `Uninstalled ${fp.name}`,
              body: fp.appId,
            });
          } else {
            pushNotification({
              appName: "App Store",
              summary: `Failed to uninstall ${fp.name}`,
              body: res.error || "Flatpak uninstall failed",
              urgency: "critical",
            });
          }
          endOp();
        })();
        return;
      }
      if (!beginOp()) return;
      runFakeProgress(item.id, "removing", () => {
        commitUninstall(item);
        endOp();
      });
    },
    [
      commitUninstall,
      domicile,
      isBrowserRuntime,
      pendingOp,
      pushNotification,
      refreshFlatpakList,
      refreshXdgApps,
      runFakeProgress,
    ],
  );

  const handleOpen = React.useCallback(
    (item: StoreItem) => {
      if (item.kind === "web" && item.webApp) {
        openWebUrl(item.webApp.url, { title: item.webApp.title });
        return;
      }
      if (item.kind === "flatpak" && item.flatpak) {
        if (isBrowserRuntime) {
          pushNotification({
            appName: "App Store",
            summary: `Flatpak: ${item.flatpak.name}`,
            body: `Run on Domicile Linux: flatpak run ${item.flatpak.appId}`,
          });
          return;
        }
        launchApp(item.flatpak.appId);
        return;
      }
      if (item.kind === "extension" && item.extension) {
        const url =
          item.extension.storeUrl ||
          `https://chromewebstore.google.com/detail/${item.extension.id}`;
        openWebUrl(url, { title: item.extension.name });
        return;
      }
      if (item.kind === "plugin" && item.plugin) {
        launchApp("settings", { payload: "advanced" });
        return;
      }
      if (item.kind === "font" && item.font) {
        if (item.font.fontCategory === "Monospace") {
          updateSettings({ fontMonoFamily: item.font.family });
        } else {
          updateSettings({ fontSansFamily: item.font.family });
        }
        pushNotification({
          appName: "App Store",
          summary: _("Applied font %s", item.font.family),
          body:
            item.font.fontCategory === "Monospace"
              ? _("Set as monospace font")
              : _("Set as interface sans font"),
        });
        return;
      }
      if (item.kind === "app" && item.appDef) {
        launchApp(item.appDef.id);
      }
    },
    [isBrowserRuntime, launchApp, openWebUrl, pushNotification, updateSettings],
  );

  const handleReloadUpdates = React.useCallback(async () => {
    if (!beginOp()) return;
    setReloadingUpdates(true);
    setOpStatus({ progress: null, statusLine: "apt update && flatpak update" });
    try {
      if (isBrowserRuntime) {
        await new Promise((resolve) => window.setTimeout(resolve, 650));
        setAptUpdates(WEB_SIMULATED_APT_UPDATES);
        setFlatpakUpdates(WEB_SIMULATED_FLATPAK_UPDATES);
      } else {
        await runAptUpdateAndFlatpakRefresh(domicile);
        await refreshUpdates();
      }
      pushNotification({
        appName: "App Store",
        summary: _("Software catalog refreshed"),
        body: "apt update && flatpak update",
      });
    } finally {
      setReloadingUpdates(false);
      setOpStatus(null);
      endOp();
    }
  }, [beginOp, domicile, endOp, isBrowserRuntime, pushNotification, refreshUpdates]);

  // A .deb / .flatpakref opened from Folders or the Desktop asks to be installed here.
  const [packageRequest, setPackageRequest] = React.useState<{
    format: "deb" | "flatpak";
    path: string;
  } | null>(() => parsePackagePayload(initialPayload));
  React.useEffect(() => {
    const next = parsePackagePayload(initialPayload);
    if (next) setPackageRequest(next);
  }, [initialPayload]);

  const handleInstallPackage = React.useCallback(async () => {
    const req = packageRequest;
    if (!req || !beginOp()) return;
    setPackageRequest(null);
    const label = req.path.split("/").pop() ?? req.path;
    const command =
      req.format === "deb" ? `apt install -y ${label}` : `flatpak install -y ${label}`;
    setUpdatingTarget("__package__");
    setOpStatus({ progress: null, statusLine: command });
    try {
      if (isBrowserRuntime) {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        pushNotification({
          appName: "App Store",
          summary: _("Package installed"),
          body: _("%s was installed (simulated in the browser demo).", label),
        });
      } else {
        const res =
          req.format === "deb"
            ? await installDebPackage(domicile, req.path)
            : await installFlatpakFile(domicile, req.path);
        pushNotification({
          appName: "App Store",
          summary: res.ok ? _("Package installed") : _("Installation failed"),
          body: res.ok ? label : res.error || command,
          ...(res.ok ? {} : { urgency: "critical" as const }),
        });
        if (res.ok) {
          refreshXdgApps();
          await refreshUpdates();
        }
      }
    } finally {
      setUpdatingTarget(null);
      setOpStatus(null);
      endOp();
    }
  }, [beginOp, domicile, endOp, isBrowserRuntime, packageRequest, pushNotification, refreshUpdates, refreshXdgApps]);

  // View menu (sort order, refresh) lives in the menu bar, not the toolbar.
  React.useEffect(() => {
    if (!windowId) return;
    publishWindowMenuState(windowId, {
      "app-store:sort-default": { checked: sortMode === "default" },
      "app-store:sort-name": { checked: sortMode === "name" },
      "app-store:sort-category": { checked: sortMode === "category" },
      "app-store:sort-installed": { checked: sortMode === "installed" },
      "app-store:refresh": { disabled: isBusy },
    });
  }, [isBusy, sortMode, windowId]);

  React.useEffect(() => {
    if (!windowId) return;
    const onAppAction = (e: Event) => {
      const detail = (e as CustomEvent<{ windowId?: string; actionId?: string }>).detail;
      if (!detail?.actionId) return;
      if (detail.windowId && detail.windowId !== windowId) return;
      switch (detail.actionId) {
        case "app-store:sort-default":
          setSortMode("default");
          break;
        case "app-store:sort-name":
          setSortMode("name");
          break;
        case "app-store:sort-category":
          setSortMode("category");
          break;
        case "app-store:sort-installed":
          setSortMode("installed");
          break;
        case "app-store:refresh":
          void handleReloadUpdates();
          break;
      }
    };
    window.addEventListener("piloti:app-action", onAppAction);
    return () => window.removeEventListener("piloti:app-action", onAppAction);
  }, [handleReloadUpdates, windowId]);

  const handleUpgradeSystem = React.useCallback(async () => {
    if (!beginOp()) return;
    setUpdatingTarget("__system__");
    setOpStatus({ progress: null, statusLine: "apt upgrade -y" });
    try {
      if (isBrowserRuntime) {
        await new Promise((resolve) => window.setTimeout(resolve, 800));
        setAptUpdates([]);
        pushNotification({
          appName: "App Store",
          summary: _("System upgrades installed"),
          body: "apt upgrade -y",
        });
      } else {
        const res = await runAptUpgrade(domicile);
        if (res.ok) {
          setAptUpdates([]);
          pushNotification({
            appName: "App Store",
            summary: _("System upgrades installed"),
            body: "apt upgrade -y",
          });
        } else {
          pushNotification({
            appName: "App Store",
            summary: _("System upgrade failed"),
            body: res.error || "apt upgrade -y",
            urgency: "critical",
          });
        }
        await refreshUpdates();
      }
    } finally {
      setUpdatingTarget(null);
      setOpStatus(null);
      endOp();
    }
  }, [beginOp, domicile, endOp, isBrowserRuntime, pushNotification, refreshUpdates]);

  const handleUpgradeFlatpak = React.useCallback(
    async (appId: string) => {
      if (!beginOp()) return;
      setUpdatingTarget(appId);
      setOpStatus({ progress: null, statusLine: `flatpak update -y ${appId}` });
      try {
        if (isBrowserRuntime) {
          await new Promise((resolve) => window.setTimeout(resolve, 550));
          setFlatpakUpdates((prev) => prev.filter((u) => u.appId !== appId));
        } else {
          const res = await updateFlatpakApp(domicile, appId, {
            onUpdate: ({ line, progress }) =>
              setOpStatus({ progress, statusLine: line }),
          });
          if (!res.ok) {
            pushNotification({
              appName: "App Store",
              summary: _("Failed to upgrade %s", appId),
              body: res.error || "",
              urgency: "critical",
            });
          }
          await refreshUpdates();
        }
      } finally {
        setUpdatingTarget(null);
        setOpStatus(null);
        endOp();
      }
    },
    [beginOp, domicile, endOp, isBrowserRuntime, pushNotification, refreshUpdates],
  );

  const handleUpgradeAll = React.useCallback(async () => {
    if (!beginOp()) return;
    setUpdatingTarget("__all__");
    setOpStatus({ progress: null, statusLine: _("Upgrading all packages and apps…") });
    try {
      if (isBrowserRuntime) {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        if (sources.system) setAptUpdates([]);
        if (sources.flatpak) setFlatpakUpdates([]);
        pushNotification({
          appName: "App Store",
          summary: _("All upgrades installed"),
          body: _("Your system and applications are up to date."),
        });
      } else {
        if (sources.system && aptUpdates.length > 0) {
          setOpStatus({ progress: null, statusLine: "apt upgrade -y" });
          await runAptUpgrade(domicile);
        }
        if (sources.flatpak && flatpakUpdates.length > 0) {
          await updateAllFlatpaks(domicile, {
            onUpdate: ({ line, progress }) =>
              setOpStatus({ progress, statusLine: line }),
          });
        }
        await refreshUpdates();
        pushNotification({
          appName: "App Store",
          summary: _("All upgrades installed"),
          body: _("Your system and applications are up to date."),
        });
      }
    } finally {
      setUpdatingTarget(null);
      setOpStatus(null);
      endOp();
    }
  }, [
    aptUpdates.length,
    beginOp,
    domicile,
    endOp,
    flatpakUpdates.length,
    isBrowserRuntime,
    pushNotification,
    refreshUpdates,
    sources.flatpak,
    sources.system,
  ]);

  React.useEffect(() => {
    const onWinKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          target.isContentEditable)
      ) {
        return;
      }
      if (category === "updates") return;
      const winEl = mainRef.current?.closest('[data-slot="window"]');
      const isFocusedWin =
        (winEl && !winEl.hasAttribute("data-inactive")) ||
        (mainRef.current &&
          document.activeElement &&
          winEl?.contains(document.activeElement));
      if (!isFocusedWin) return;
      if (e.key.length === 1 && /^[a-z0-9._-]$/i.test(e.key)) {
        e.preventDefault();
        setSearchOpen(true);
        setQuery((prev) => (searchOpen ? prev + e.key : e.key));
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onWinKeyDown);
    return () => window.removeEventListener("keydown", onWinKeyDown);
  }, [category, searchOpen]);

  return (
    <>
    <AdwSplitView
      title={_("App Store")}
      appId="app-store"
      windowId={windowId}
      isCsd={isCsd}
      sidebarItems={sidebarItems}
      sidebarWidthClass="w-44"
      sidebarId="app-store-sidebar"
      compactBreakpoint={580}
      sidebarRef={sidebarRef}
      onSidebarKeyDown={onSidebarKeyDown}
      onSidebarKeyUp={onSidebarKeyUp}
      onKeyDown={(e) => {
        if (
          (e.ctrlKey || e.metaKey) &&
          !e.altKey &&
          e.key.toLowerCase() === "f"
        ) {
          e.preventDefault();
          setSearchOpen(true);
          requestAnimationFrame(() => searchInputRef.current?.focus());
          return;
        }
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        ) {
          return;
        }
        if (
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          e.key.length === 1 &&
          /^[a-z0-9._-]$/i.test(e.key)
        ) {
          e.preventDefault();
          setSearchOpen(true);
          setQuery((prev) => (searchOpen ? prev + e.key : e.key));
          requestAnimationFrame(() => searchInputRef.current?.focus());
        }
      }}
      header={({ isCompact, contentScrolled }) => (
        <WindowTitlebar
          data-window-drag-region={isCsd ? "" : undefined}
          className={cn(
            "bg-adw-titlebar transition-colors",
            !isCompact && "rounded-tl-none",
            !isCsd && "rounded-t-none",
            contentScrolled
              ? "border-b border-adw-separator"
              : "border-b border-transparent",
          )}
        >
          <div className="flex min-w-0 items-center gap-1.5" data-window-no-drag>
            {!isCsd && (
              <WindowMenuButton windowId={windowId} appId="app-store" />
            )}
            <span className="truncate px-2 text-[13.5px] font-medium text-adw-label">
              {_(
                [...SIDEBAR_ITEMS, ...COLLECTION_ITEMS, ...CATEGORY_ITEMS].find(
                  (i) => i.id === category,
                )?.label ?? "Explore"
              )}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5" data-window-no-drag>
            {category !== "updates" && searchOpen && (
              <div className="relative flex items-center">
                <SearchIcon className="pointer-events-none absolute left-2 size-3.5 text-adw-label-secondary" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      if (query.length > 0) {
                        setQuery("");
                      } else {
                        setSearchOpen(false);
                      }
                    }
                  }}
                  placeholder={_("Search")}
                  aria-label={_("Search")}
                  className="h-7 w-44 rounded-adw-control border border-adw-separator bg-black/6 pr-6 pl-7 text-adw-callout text-adw-label placeholder:text-adw-label-secondary focus:border-adw-accent focus:outline-none dark:bg-white/10 [&::-webkit-search-cancel-button]:hidden"
                />
                {query && (
                  <WindowControlButton
                    aria-label={_("Clear search")}
                    onClick={() => {
                      setQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-1 size-4.5 [&_svg]:size-2.5"
                  >
                    <XIcon strokeWidth={2.25} />
                  </WindowControlButton>
                )}
              </div>
            )}
            <button
              type="button"
              aria-label={_("Search")}
              title="Search (Ctrl+F)"
              aria-pressed={searchOpen}
              onClick={() => {
                setSearchOpen((prev) => {
                  const next = !prev;
                  if (next) {
                    requestAnimationFrame(() => searchInputRef.current?.focus());
                  } else {
                    setQuery("");
                  }
                  return next;
                });
              }}
              className={cn(
                "flex size-7 items-center justify-center rounded-adw-control transition-colors",
                searchOpen
                  ? "bg-black/10 text-adw-label dark:bg-white/15"
                  : "text-adw-label-secondary hover-fill:bg-black/8 hover:text-adw-label dark:hover-fill:bg-white/10"
              )}
            >
              <SearchIcon className="size-4" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={_("Software Sources")}
                title={_("Software Sources")}
                className="flex size-7 items-center justify-center rounded-adw-control text-adw-label-secondary transition-colors outline-none hover-fill:bg-black/8 hover:text-adw-label data-popup-open:bg-black/10 data-popup-open:text-adw-label dark:hover-fill:bg-white/10 dark:data-popup-open:bg-white/15"
              >
                <SlidersHorizontalIcon className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{_("Software Sources")}</DropdownMenuLabel>
                {SOURCE_TOGGLES.map(({ key, label }) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={sources[key]}
                    closeOnClick={false}
                    onCheckedChange={(checked) =>
                      updateSources({ [key]: Boolean(checked) } as Partial<SoftwareSourcesState>)
                    }
                  >
                    {label()}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {isCsd && windowId && <WindowControls side="right" />}
          </div>
        </WindowTitlebar>
      )}
      footer={
        pendingOp || opStatus ? (
          <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-t border-adw-separator bg-adw-titlebar px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="shrink-0 text-adw-subheadline font-medium text-adw-label">
                {pendingOp
                  ? pendingOp.kind === "removing"
                    ? _("Removing…")
                    : _("Installing…")
                  : reloadingUpdates
                    ? _("Refreshing…")
                    : _("Upgrading…")}
              </span>
              {(pendingOp?.statusLine || opStatus?.statusLine) && (
                <span className="min-w-0 truncate font-mono text-adw-subheadline text-adw-label-secondary">
                  {pendingOp?.statusLine ?? opStatus?.statusLine}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              {(() => {
                const prog = pendingOp ? pendingOp.progress : (opStatus?.progress ?? null);
                const isRemoving = pendingOp?.kind === "removing";
                return (
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    {...(prog !== null ? { "aria-valuenow": prog } : {})}
                    className="relative h-1.5 w-36 overflow-hidden rounded-full bg-black/10 dark:bg-white/12"
                  >
                    {prog === null ? (
                      <div
                        className={cn(
                          "h-full w-2/5 animate-[piloti-indeterminate_1.3s_ease-in-out_infinite]",
                          isRemoving ? "bg-adw-red" : "bg-adw-accent",
                        )}
                      />
                    ) : (
                      <div
                        style={{ width: `${prog}%` }}
                        className={cn(
                          "h-full transition-[width] duration-75",
                          isRemoving ? "bg-adw-red" : "bg-adw-accent",
                        )}
                      />
                    )}
                  </div>
                );
              })()}
              {pendingOp && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={_("Cancel")}
                  title={_("Cancel")}
                  onClick={handleCancelPendingOp}
                  className="h-6 px-2 text-adw-subheadline"
                >
                  <XIcon className="mr-1 size-3" />
                  {_("Cancel")}
                </Button>
              )}
            </div>
          </div>
        ) : undefined
      }
    >
      {({ onContentScroll }) => (
        <div className="flex min-h-0 flex-1 overflow-hidden">
        <main
          ref={mainRef}
          onKeyDown={onContentKeyDown}
          onScroll={onContentScroll}
          className="flex-1 overflow-y-auto p-4"
          onClick={() => setSelectedId(null)}
        >
            {category === "updates" ? (
              <div className="mx-auto max-w-3xl space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-adw-title-3 font-bold text-adw-label">
                      {_("Available Updates")}
                    </h2>
                    <p className="text-adw-callout text-adw-label-secondary">
                      {totalUpdatesCount === 0
                        ? _("Your system and applications are up to date.")
                        : _("%d upgrades available", totalUpdatesCount)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {totalUpdatesCount > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => void handleUpgradeAll()}
                      >
                        {updatingTarget === "__all__"
                          ? _("Upgrading…")
                          : _("Upgrade All")}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={isBusy}
                      onClick={() => void handleReloadUpdates()}
                    >
                      <RefreshCwIcon
                        className={cn("mr-1.5 size-3.5", reloadingUpdates && "animate-spin")}
                      />
                      {reloadingUpdates ? _("Refreshing…") : _("Refresh")}
                    </Button>
                  </div>
                </div>

                {totalUpdatesCount === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-adw-separator bg-adw-card py-12 text-center text-adw-label-secondary">
                    <CheckCircle2Icon className="size-10 text-emerald-500 opacity-80" />
                    <p className="text-sm font-medium text-adw-label">
                      {_("Software is up to date")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sources.system && aptUpdates.length > 0 && (
                      <div className="overflow-hidden rounded-adw-group border border-adw-separator bg-adw-card">
                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setSystemUpdatesExpanded((prev) => !prev)}
                            aria-expanded={systemUpdatesExpanded}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-adw-group bg-adw-accent/15 text-adw-accent">
                              <ServerIcon className="size-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-[13.5px] font-semibold text-adw-label">
                                  {_("System Updates")}
                                </span>
                                <span className="rounded-full bg-black/6 px-2 py-0.5 text-adw-footnote font-medium text-adw-label-secondary dark:bg-white/10">
                                  {_("%d packages", aptUpdates.length)}
                                </span>
                              </div>
                              <div className="truncate text-adw-subheadline text-adw-label-secondary">
                                apt upgrade -y
                              </div>
                            </div>
                            <ChevronDownIcon
                              className={cn(
                                "size-4 shrink-0 text-adw-label-tertiary transition-transform duration-150",
                                systemUpdatesExpanded && "rotate-180",
                              )}
                            />
                          </button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={isBusy}
                            onClick={() => void handleUpgradeSystem()}
                          >
                            {updatingTarget === "__system__"
                              ? _("Upgrading…")
                              : _("Upgrade")}
                          </Button>
                        </div>

                        {systemUpdatesExpanded && (
                          <div className="divide-y divide-adw-separator/60 border-t border-adw-separator/60 bg-black/[0.02] dark:bg-white/[0.02]">
                            {aptUpdates.map((pkg) => (
                              <div
                                key={pkg.name}
                                className="flex items-center justify-between gap-3 px-4 py-2 font-mono text-adw-subheadline"
                              >
                                <span className="truncate font-medium text-adw-label">
                                  {pkg.name}
                                </span>
                                <span className="shrink-0 text-adw-label-tertiary">
                                  {pkg.currentVersion
                                    ? `${pkg.currentVersion} → ${pkg.newVersion ?? ""}`
                                    : (pkg.newVersion ?? "")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {sources.flatpak && flatpakUpdates.length > 0 && (
                      <div className="divide-y divide-adw-separator/60 overflow-hidden rounded-adw-group border border-adw-separator bg-adw-card">
                        {flatpakUpdates.map((upd) => {
                          const storeItem = items.find(
                            (i) => i.kind === "flatpak" && i.flatpak?.appId === upd.appId,
                          );
                          const isSelected = storeItem && selectedId === storeItem.id;
                          return (
                            <div
                              key={upd.appId}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                if (storeItem) setSelectedId(storeItem.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && storeItem) setSelectedId(storeItem.id);
                              }}
                              className={cn(
                                "flex cursor-default items-center justify-between gap-3 px-3.5 py-2.5 transition-colors outline-none",
                                isSelected
                                  ? "bg-adw-accent/15"
                                  : "hover-fill:bg-black/[0.03] dark:hover-fill:bg-white/[0.04]",
                              )}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <WebAppFavicon
                                  url={
                                    storeItem?.faviconUrl ??
                                    `https://dl.flathub.org/repo/appstream/x86_64/icons/128x128/${upd.appId}.png`
                                  }
                                  title={upd.name}
                                  className="size-10"
                                />
                                <div className="min-w-0">
                                  <div className="truncate text-adw-body font-semibold text-adw-label">
                                    {upd.name}
                                  </div>
                                  <div className="truncate text-adw-subheadline text-adw-label-secondary">
                                    {storeItem?.subtitle || upd.appId}
                                    {upd.version ? ` · v${upd.version}` : ""}
                                  </div>
                                </div>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={isBusy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleUpgradeFlatpak(upd.appId);
                                }}
                                className="h-7 px-3 text-adw-subheadline"
                              >
                                {updatingTarget === upd.appId
                                  ? _("Upgrading…")
                                  : _("Upgrade")}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
            <>
            {category === "all" && !query.trim() && activeFeaturedItem && (
              <section
                aria-label="Featured applications"
                onClick={(e) => e.stopPropagation()}
                className="relative mb-5 overflow-hidden rounded-2xl border border-adw-separator bg-black/5 px-5 py-8 dark:bg-white/5"
              >
                {activeFeaturedItem.faviconUrl && (
                  <>
                    <img
                      src={activeFeaturedItem.faviconUrl}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      className="pointer-events-none absolute inset-0 size-full scale-[2.2] object-cover opacity-85 blur-[64px] saturate-[2.4] contrast-110 select-none dark:opacity-75"
                    />
                    <img
                      src={activeFeaturedItem.faviconUrl}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      className="pointer-events-none absolute -top-1/2 -left-1/4 size-[960px] object-contain opacity-65 blur-[72px] saturate-[2.6] select-none dark:opacity-55"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/35 via-white/15 to-white/25 dark:from-black/25 dark:via-black/15 dark:to-black/35"
                    />
                  </>
                )}
                <div className="relative z-10 flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Previous featured app"
                    onClick={() =>
                      setFeaturedSlide(
                        (prev) =>
                          (prev - 1 + featuredItems.length) %
                          featuredItems.length,
                      )
                    }
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/5 text-adw-label-secondary transition-colors hover-fill:bg-black/10 hover:text-adw-label dark:bg-white/8 dark:hover-fill:bg-white/15"
                  >
                    <ChevronLeftIcon className="size-4" />
                  </button>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(activeFeaturedItem.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setSelectedId(activeFeaturedItem.id);
                      }
                    }}
                    className="flex min-w-0 flex-1 cursor-default flex-col items-center justify-center gap-2.5 text-center outline-none"
                  >
                    <WebAppFavicon
                      url={activeFeaturedItem.faviconUrl}
                      title={activeFeaturedItem.title}
                      className="size-16 shrink-0"
                    />
                    <div className="min-w-0 max-w-md">
                      <div className="truncate text-base font-bold text-adw-label">
                        {activeFeaturedItem.title}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-adw-callout text-adw-label-secondary">
                        {activeFeaturedItem.subtitle}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label="Next featured app"
                    onClick={() =>
                      setFeaturedSlide(
                        (prev) => (prev + 1) % featuredItems.length,
                      )
                    }
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/5 text-adw-label-secondary transition-colors hover-fill:bg-black/10 hover:text-adw-label dark:bg-white/8 dark:hover-fill:bg-white/15"
                  >
                    <ChevronRightIcon className="size-4" />
                  </button>
                </div>

                {featuredItems.length > 1 && (
                  <div className="mt-3 flex items-center justify-center gap-1.5">
                    {featuredItems.map((feat, idx) => (
                      <button
                        key={feat.id}
                        type="button"
                        aria-label={`Show ${feat.title}`}
                        onClick={() => setFeaturedSlide(idx)}
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          idx === activeSlideIndex
                            ? "w-4 bg-adw-accent"
                            : "w-1.5 bg-black/20 hover-fill:bg-black/35 dark:bg-white/25 dark:hover-fill:bg-white/45",
                        )}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {filteredItems.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-adw-label-secondary">
                <PackageIcon className="size-10 opacity-40" />
                <p className="text-sm font-medium">{_("No applications found")}</p>
              </div>
            ) : (
              <div className="space-y-5">
                {(category === "web-apps"
                  ? webAppsByCategory
                  : [
                      { id: "web", title: _("Web Apps"), list: webAndAppItems },
                      { id: "flatpak", title: _("Flatpaks"), list: flatpakStoreItems },
                      { id: "extension", title: _("Web Extensions"), list: extensionStoreItems },
                      { id: "plugin", title: _("Desktop Plugins"), list: pluginStoreItems },
                      { id: "font", title: _("Fonts"), list: fontStoreItems },
                    ]
                )
                  .filter((group) => group.list.length > 0)
                  .map((group) => (
                    <section key={group.id} className="space-y-2.5">
                      <h2 className="px-0.5 text-adw-callout font-semibold tracking-wider text-adw-label-tertiary uppercase">
                        {group.title}
                      </h2>
                      <div
                        className={cn(
                          viewMode === "list"
                            ? "divide-y divide-adw-separator/60 overflow-hidden rounded-adw-group border border-adw-separator bg-adw-card"
                            : "grid grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-2.5",
                        )}
                      >
                        {group.list.map((item) => {
                          const isSelected = selectedId === item.id;
                          const upgradable =
                            item.kind === "flatpak" && item.flatpak
                              ? flatpakUpdateById.get(item.flatpak.appId)
                              : undefined;
                          return (
                            <ContextMenu key={item.id}>
                              <ContextMenuTrigger>
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedId(item.id);
                                  }}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    if (item.installed) {
                                      handleOpen(item);
                                    } else {
                                      handleInstall(item);
                                    }
                                  }}
                                  onContextMenu={() => setSelectedId(item.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      setSelectedId(item.id);
                                    }
                                  }}
                                  className={cn(
                                    "relative flex cursor-default items-center gap-3 overflow-hidden transition-colors outline-none",
                                    viewMode === "list"
                                      ? cn(
                                          "px-3.5 py-2.5",
                                          isSelected
                                            ? "bg-adw-accent/15"
                                            : "hover-fill:bg-black/[0.03] dark:hover-fill:bg-white/[0.04]",
                                        )
                                      : cn(
                                          "rounded-adw-group p-3",
                                          isSelected
                                            ? "bg-adw-accent/15 ring-1 ring-adw-accent/60"
                                            : "bg-black/[0.03] hover-fill:bg-black/[0.06] dark:bg-white/[0.04] dark:hover-fill:bg-white/[0.07]",
                                        ),
                                  )}
                                >
                                  {item.kind === "app" && item.appDef ? (
                                    <AppSquircleIcon
                                      iconUrl={getAppIconUrl(item.appDef.id)}
                                      iconName={item.appDef.iconName}
                                      gradient={item.appDef.gradient}
                                      className="size-10"
                                    />
                                  ) : item.kind === "extension" ? (
                                    item.faviconUrl ? (
                                      <WebAppFavicon
                                        url={item.faviconUrl}
                                        title={item.title}
                                        className="size-10"
                                      />
                                    ) : (
                                      <div className="flex size-10 shrink-0 items-center justify-center rounded-adw-group bg-violet-500/12 text-violet-500">
                                        <PuzzleIcon className="size-5" />
                                      </div>
                                    )
                                  ) : item.kind === "plugin" ? (
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-adw-group bg-emerald-500/12 text-emerald-500">
                                      <BlocksIcon className="size-5" />
                                    </div>
                                  ) : item.kind === "font" && item.font ? (
                                    <div
                                      style={{
                                        fontFamily: `"${item.font.family}", ${item.font.fontCategory === "Monospace" ? "monospace" : item.font.fontCategory === "Serif" ? "serif" : "sans-serif"}`,
                                      }}
                                      className="flex size-10 shrink-0 items-center justify-center rounded-adw-group bg-amber-500/12 text-adw-title-2 font-semibold text-amber-600 dark:text-amber-400"
                                    >
                                      Aa
                                    </div>
                                  ) : (
                                    <WebAppFavicon
                                      url={item.faviconUrl}
                                      title={item.title}
                                      className="size-10"
                                    />
                                  )}

                                  <div className="min-w-0 flex-1">
                                    <div
                                      style={
                                        item.kind === "font" && item.font
                                          ? {
                                              fontFamily: `"${item.font.family}", ${item.font.fontCategory === "Monospace" ? "monospace" : item.font.fontCategory === "Serif" ? "serif" : "sans-serif"}`,
                                            }
                                          : undefined
                                      }
                                      className="truncate text-adw-body font-semibold"
                                    >
                                      {item.title}
                                    </div>
                                    <p
                                      style={
                                        item.kind === "font" && item.font
                                          ? {
                                              fontFamily: `"${item.font.family}", ${item.font.fontCategory === "Monospace" ? "monospace" : item.font.fontCategory === "Serif" ? "serif" : "sans-serif"}`,
                                            }
                                          : undefined
                                      }
                                      className="truncate text-adw-subheadline text-adw-label-secondary"
                                    >
                                      {item.kind === "font" && item.font
                                        ? item.font.sampleText
                                        : item.subtitle}
                                    </p>
                                  </div>

                                  {viewMode === "list" && (
                                    <div
                                      className="flex shrink-0 items-center gap-1.5"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {upgradable && item.flatpak && (
                                        <button
                                          type="button"
                                          title={_("Upgrade")}
                                          aria-label={_("Upgrade")}
                                          disabled={isBusy}
                                          onClick={() =>
                                            void handleUpgradeFlatpak(item.flatpak!.appId)
                                          }
                                          className="flex size-7 items-center justify-center rounded-adw-control text-adw-accent transition-colors hover:bg-adw-accent/15 disabled:opacity-40"
                                        >
                                          <RefreshCwIcon className="size-3.5" />
                                        </button>
                                      )}
                                      {item.installed ? (
                                        <>
                                          {item.kind === "plugin" && item.plugin && (
                                            <Switch
                                              checked={item.plugin.enabled}
                                              onCheckedChange={(checked) => {
                                                const p = item.plugin!;
                                                if (p.discovered) {
                                                  togglePlugin(p.id, Boolean(checked));
                                                } else {
                                                  const next = Boolean(checked)
                                                    ? settings.enabledPluginIds.includes(p.id)
                                                      ? settings.enabledPluginIds
                                                      : [...settings.enabledPluginIds, p.id]
                                                    : settings.enabledPluginIds.filter(
                                                        (id) => id !== p.id,
                                                      );
                                                  updateSettings({ enabledPluginIds: next });
                                                }
                                              }}
                                            />
                                          )}
                                          {item.removable && (
                                            <button
                                              type="button"
                                              title={_("Uninstall")}
                                              aria-label={_("Uninstall")}
                                              disabled={isBusy}
                                              onClick={() => handleUninstall(item)}
                                              className="flex size-7 items-center justify-center rounded-adw-control text-adw-label-tertiary transition-colors hover-fill:bg-rose-500/12 hover:text-rose-500 disabled:opacity-40"
                                            >
                                              <XIcon className="size-3.5" />
                                            </button>
                                          )}
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="secondary"
                                            disabled={isBusy}
                                            onClick={() => handleOpen(item)}
                                            className="h-7 px-3 text-adw-subheadline"
                                          >
                                            {item.kind === "font"
                                              ? _("Apply")
                                              : _("Open")}
                                          </Button>
                                        </>
                                      ) : (
                                        <Button
                                          type="button"
                                          size="sm"
                                          disabled={isBusy}
                                          onClick={() => handleInstall(item)}
                                          className="h-7 px-3 text-adw-subheadline"
                                        >
                                          {_("Install")}
                                        </Button>
                                      )}
                                    </div>
                                  )}

                                  {pendingOp?.id === item.id && (
                                    <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-black/10 dark:bg-white/10">
                                      {pendingOp.progress === null ? (
                                        <div
                                          className={cn(
                                            "h-full w-2/5 animate-[piloti-indeterminate_1.3s_ease-in-out_infinite]",
                                            pendingOp.kind === "removing"
                                              ? "bg-adw-red"
                                              : "bg-adw-accent",
                                          )}
                                        />
                                      ) : (
                                        <div
                                          style={{ width: `${pendingOp.progress}%` }}
                                          className={cn(
                                            "h-full transition-[width] duration-75",
                                            pendingOp.kind === "removing"
                                              ? "bg-adw-red"
                                              : "bg-adw-accent",
                                          )}
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-40">
                                {!item.installed ? (
                                  <ContextMenuItem onClick={() => handleInstall(item)}>
                                    {_("Install")}
                                  </ContextMenuItem>
                                ) : (
                                  <>
                                    <ContextMenuItem onClick={() => handleOpen(item)}>
                                      {_("Open")}
                                    </ContextMenuItem>
                                    {item.removable && (
                                      <ContextMenuItem
                                        variant="destructive"
                                        onClick={() => handleUninstall(item)}
                                      >
                                        {_("Uninstall")}
                                      </ContextMenuItem>
                                    )}
                                  </>
                                )}
                              </ContextMenuContent>
                            </ContextMenu>
                          );
                        })}
                      </div>
                    </section>
                  ))}
              </div>
            )}
            </>
            )}
          </main>

          {/* Right-side Infos Inspector Panel (AppFinder / Files style) */}
          {selectedItem && (
            <aside
              onClick={(e) => e.stopPropagation()}
              className="flex w-72 shrink-0 flex-col border-l border-adw-separator bg-adw-sidebar"
            >
              <div className="flex h-10 shrink-0 items-center gap-2 border-b border-adw-separator px-3">
                <button
                  type="button"
                  aria-label={_("Close")}
                  onClick={() => setSelectedId(null)}
                  className="flex size-6 items-center justify-center rounded-adw-control text-adw-label-secondary transition-colors hover-fill:bg-black/8 hover:text-adw-label dark:hover-fill:bg-white/10"
                >
                  <XIcon className="size-3.5" />
                </button>
                <span className="text-adw-callout font-semibold text-adw-label">
                  {_("Infos")}
                </span>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div className="flex flex-col items-center text-center">
                  {selectedItem.kind === "app" && selectedItem.appDef ? (
                    <AppSquircleIcon
                      iconUrl={getAppIconUrl(selectedItem.appDef.id)}
                      iconName={selectedItem.appDef.iconName}
                      gradient={selectedItem.appDef.gradient}
                      className="size-16"
                    />
                  ) : selectedItem.kind === "extension" ? (
                    selectedItem.faviconUrl ? (
                      <WebAppFavicon
                        url={selectedItem.faviconUrl}
                        title={selectedItem.title}
                        className="size-16"
                      />
                    ) : (
                      <div className="flex size-16 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-500">
                        <PuzzleIcon className="size-8" />
                      </div>
                    )
                  ) : selectedItem.kind === "plugin" ? (
                    <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-500">
                      <BlocksIcon className="size-8" />
                    </div>
                  ) : selectedItem.kind === "font" && selectedItem.font ? (
                    <div
                      style={{
                        fontFamily: `"${selectedItem.font.family}", ${selectedItem.font.fontCategory === "Monospace" ? "monospace" : selectedItem.font.fontCategory === "Serif" ? "serif" : "sans-serif"}`,
                      }}
                      className="flex size-16 items-center justify-center rounded-2xl bg-amber-500/12 text-adw-large-title font-semibold text-amber-600 dark:text-amber-400"
                    >
                      Aa
                    </div>
                  ) : (
                    <WebAppFavicon
                      url={selectedItem.faviconUrl}
                      title={selectedItem.title}
                      className="size-16"
                    />
                  )}
                  <h3
                    style={
                      selectedItem.kind === "font" && selectedItem.font
                        ? {
                            fontFamily: `"${selectedItem.font.family}", ${selectedItem.font.fontCategory === "Monospace" ? "monospace" : selectedItem.font.fontCategory === "Serif" ? "serif" : "sans-serif"}`,
                          }
                        : undefined
                    }
                    className="mt-3 text-adw-title-3 font-bold text-adw-label"
                  >
                    {selectedItem.title}
                  </h3>
                  <p className="mt-1 text-adw-callout leading-snug text-adw-label-secondary">
                    {selectedItem.subtitle}
                  </p>
                  {selectedItem.kind === "font" && selectedItem.font && (
                    <div
                      style={{
                        fontFamily: `"${selectedItem.font.family}", ${selectedItem.font.fontCategory === "Monospace" ? "monospace" : selectedItem.font.fontCategory === "Serif" ? "serif" : "sans-serif"}`,
                      }}
                      className="mt-3 w-full rounded-adw-group border border-adw-separator bg-adw-card p-3 text-left text-adw-body leading-relaxed text-adw-label"
                    >
                      <div className="text-[16px] font-semibold">
                        ABCDEFGHIJKLM
                      </div>
                      <div className="text-adw-body text-adw-label-secondary">
                        abcdefghijklm 0123456789
                      </div>
                      <div className="mt-1 text-adw-callout text-adw-label-secondary">
                        {_("The quick brown fox jumps over the lazy dog.")}
                      </div>
                    </div>
                  )}
                  {(() => {
                    const upd =
                      selectedItem.kind === "flatpak" && selectedItem.flatpak
                        ? flatpakUpdateById.get(selectedItem.flatpak.appId)
                        : undefined;
                    if (!upd?.version) return null;
                    return (
                      <div className="mt-1.5 text-adw-subheadline font-medium text-adw-accent">
                        {_("Upgrade available: %s", upd.version)}
                      </div>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-2">
                  {!selectedItem.installed ? (
                    <Button
                      type="button"
                      className="w-full"
                      disabled={isBusy}
                      onClick={() => handleInstall(selectedItem)}
                    >
                      {_("Install")}
                    </Button>
                  ) : (
                    <>
                      {selectedItem.kind === "flatpak" &&
                      selectedItem.flatpak &&
                      flatpakUpdateById.has(selectedItem.flatpak.appId) ? (
                        <Button
                          type="button"
                          className="flex-1"
                          disabled={isBusy}
                          onClick={() =>
                            void handleUpgradeFlatpak(selectedItem.flatpak!.appId)
                          }
                        >
                          {updatingTarget === selectedItem.flatpak.appId
                            ? _("Upgrading…")
                            : _("Upgrade")}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          className="flex-1"
                          onClick={() => handleOpen(selectedItem)}
                        >
                          {selectedItem.kind === "font" ? _("Apply") : _("Open")}
                        </Button>
                      )}
                      {selectedItem.kind === "plugin" &&
                        selectedItem.plugin && (
                          <Button
                            type="button"
                            variant={selectedItem.plugin.enabled ? "outline" : "default"}
                            className="flex-1"
                            onClick={() => {
                              const p = selectedItem.plugin!;
                              const nextEnabled = !p.enabled;
                              if (p.discovered) {
                                togglePlugin(p.id, nextEnabled);
                              } else {
                                const next = nextEnabled
                                  ? settings.enabledPluginIds.includes(p.id)
                                    ? settings.enabledPluginIds
                                    : [...settings.enabledPluginIds, p.id]
                                  : settings.enabledPluginIds.filter(
                                      (id) => id !== p.id,
                                    );
                                updateSettings({ enabledPluginIds: next });
                              }
                            }}
                          >
                            {selectedItem.plugin.enabled
                              ? _("Disable")
                              : _("Enable")}
                          </Button>
                        )}
                      {selectedItem.removable && (
                        <Button
                          type="button"
                          variant="destructive"
                          className="flex-1"
                          disabled={isBusy}
                          onClick={() => handleUninstall(selectedItem)}
                        >
                          {_("Uninstall")}
                        </Button>
                      )}
                    </>
                  )}
                </div>

                <div className="divide-y divide-adw-separator/60 overflow-hidden rounded-adw-group border border-adw-separator bg-adw-card text-adw-callout">
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-adw-label-secondary">{_("Category")}</span>
                    <span className="font-medium text-adw-label">
                      {_(selectedItem.category)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-adw-label-secondary">{_("Source")}</span>
                    <span className="font-medium text-adw-label">
                      {selectedItem.kind === "flatpak"
                        ? selectedItem.flatpak?.origin || "Flathub"
                        : selectedItem.kind === "web"
                          ? _("Web App")
                          : selectedItem.kind === "extension"
                            ? _("Web Extension")
                            : selectedItem.kind === "plugin"
                              ? _("Desktop Plugin")
                              : selectedItem.kind === "font"
                                ? selectedItem.font?.source === "System"
                                  ? _("System Font")
                                  : selectedItem.font?.source === "Document"
                                    ? _("Document Font")
                                    : _("Web Font")
                                : _("System (Debian)")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-adw-label-secondary">{_("ID")}</span>
                    <span className="max-w-[150px] truncate font-mono text-adw-subheadline text-adw-label">
                      {selectedItem.flatpak?.appId ||
                        selectedItem.appDef?.id ||
                        selectedItem.extension?.id ||
                        selectedItem.plugin?.id ||
                        selectedItem.font?.family ||
                        selectedItem.id}
                    </span>
                  </div>
                  {selectedItem.webApp?.url && (
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="text-adw-label-secondary">{_("URL")}</span>
                      <span className="max-w-[150px] truncate font-mono text-adw-subheadline text-adw-accent">
                        {selectedItem.webApp.url}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-adw-label-secondary">{_("Status")}</span>
                    <span className="font-medium text-adw-label">
                      {selectedItem.installed ? _("Installed") : _("Available")}
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
        )}
      </AdwSplitView>
        <Dialog
          open={Boolean(packageRequest)}
          onOpenChange={(open) => {
            if (!open) setPackageRequest(null);
          }}
        >
          <DialogContent showCloseButton={false} className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {packageRequest?.format === "flatpak"
                  ? _("Install Flatpak Bundle?")
                  : _("Install Debian Package?")}
              </DialogTitle>
              <DialogDescription>
                {packageRequest
                  ? _(
                      "%s will be installed on this system. Administrator permission may be requested.",
                      packageRequest.path.split("/").pop() ?? packageRequest.path,
                    )
                  : ""}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setPackageRequest(null)}
                className="rounded-adw-item bg-black/8 px-3 py-1.5 text-xs font-medium text-adw-label transition-colors hover-fill:bg-black/14 dark:bg-white/10 dark:hover-fill:bg-white/16"
              >
                {_("Cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleInstallPackage()}
                className="rounded-adw-item bg-adw-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                {_("Install")}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </>
    );
  };
