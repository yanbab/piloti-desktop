import { hostFiles } from "@/lib/engine/host-files";
import { useArchiveActions } from "@/hooks/use-archive-actions";
import { ICON_SIZES } from "@/lib/shell/icon-sizes";
import { HeaderSearch } from "@/components/ui/header-search";
import {
  ListView,
  ListViewHeader,
  ListViewRow,
  nextListViewSort,
} from "@/components/ui/list-view";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useVfsList, useVfsQuery, useVfsRefresh, useVfsText } from "@/hooks/use-vfs";
import { vfsKeys } from "@/lib/engine/vfs-query";
import { useCapabilities } from "@/hooks/use-capabilities";
import { usePopupSurface } from "@/lib/shell/popup-layer";
import { createPortal } from "react-dom";
import { usePiloti } from "@/lib/engine/piloti";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  BriefcaseIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  EjectIcon,
  FileTextIcon,
  FolderIcon,
  HeartIcon,
  HomeIcon,
  ImageIcon,
  InfoIcon,
  LayoutGridIcon,
  ListIcon,
  MonitorIcon,
  MusicIcon,
  SearchIcon,
  TagIcon,
  Trash2Icon,
  UsbIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";
import {
  isSimulatedUsbPath,
  SIMULATED_USB_LABEL,
  SIMULATED_USB_PATH,
  unmountSimulatedUsb,
  useSimulatedUsbMounted,
} from "@/lib/engine-web/usb-drive";
import { NicePathLabel } from "@/components/shell/NicePathLabel";
import { InfoPane, InfoPaneToggle, useInfoPane } from "@/components/ui/info-pane";
import { HeaderBar, HeaderButton } from "@/components/elements/header-bar";
import { AppSplitView, type SidebarItem } from "@/components/elements/split-view";
import { FolderIconView } from "@/components/ui/folder-icon-view";
import { useExternalFileDrop } from "@/hooks/use-external-file-drop";
import { useFolderOps } from "@/hooks/use-folder-ops";
import { useLauncherItems } from "@/hooks/use-launcher-items";
import {
  entryVisual,
  hiddenNamesOf,
  vfsEntryToGridItem,
} from "@/lib/shell/folder-items";
import { AppSquircleIcon } from "@/components/shell/AppSymbol";
import { useSidebarKeyboardNav } from "@/hooks/use-sidebar-keyboard-nav";
import {
  FileItemContextMenu,
  type FileItemContextMenuState,
} from "@/components/apps/FileItemContextMenu";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MENU_ITEM_CLASS,
  MENU_POPUP_CLASS,
  MENU_SEPARATOR_CLASS,
  MENU_SUB_TRIGGER_CLASS,
} from "@/components/ui/menu-styles";
import {
  useApps,
  useWindowActions,
  useWindowManagerSelector,
  useDesktopSettings,
} from "@/context/DesktopStateContext";
import { publishWindowMenuState, useWindowMenuState } from "@/lib/engine/app-bridge";
import {
  type AppSymbolName,
  type IconGridItem,
  sortDesktopItems,
} from "@/lib/shell/desktop-icons";
import { _ } from "@/lib/core/i18n";
import { onShellEvent } from "@/lib/shell/shell-events";
import { captureLaunchOriginFromElement } from "@/lib/shell/launch-origin";
import { APP_CATALOG } from "@/data/catalog";
import { AppMenuItems } from "@/components/shell/AppMenuItems";
import { getWebAppFaviconUrl, resolveWebAppTitle } from "@/data/web-apps";
import {
  DynamicFileIcon,
  DynamicFolderIcon,
  registerOpenFolderPath,
  useOpenFolderPaths,
} from "@/data/folder-icons";
import { cn } from "@/lib/core/utils";
import {
  buildVfsEntryWebAppUrl,
  downloadVfsFile,
  duplicateVfsEntry,
  getVfsEmblems,
  getVfsEntry,
  incrementVfsAccessCount,
  isTextEditableVfsFile,
  listVfsDir,
  listVfsFavoriteEntries,
  listVfsRecentEntries,
  listVfsTemplates,
  subscribeWebVfs,
  toggleVfsEmblem,
  VFS_EMBLEM_META,
  type VfsEmblemId,
  WEB_VFS_FAVORITES_URI,
  WEB_VFS_RECENTS_URI,
  resolveVfsTemplatesDir,
} from "@/lib/engine-web/web-vfs";
import { getVfsClipboard, setVfsClipboard, subscribeVfsClipboard } from "@/lib/core/vfs-clipboard";
import { isImageVfsFile, isZipVfsFile } from "@/lib/core/vfs-media";
import { normalizeVfsPath, WEB_VFS_HOME, WEB_VFS_TRASH, type WebVfsEntry } from "@/lib/core/vfs-paths";
import {
  createFsFileFromTemplate,
  createFsFolder,
  createFsTextFile,
  emptyFsTrash,
  listFsFavoriteEntries,
  listFsRecentEntries,
  listFsTemplates,
  moveFsEntry,
  recordFsRecentFile,
  writeFsTextFile,
  renameFsEntry,
  restoreFsEntry,
  trashFsEntry,
} from "@/lib/engine/fs-bridge";
import {
  onFileUndoApplied,
  recordCreated,
  redoFileOperation,
  restoreWithUndo,
  undoFileOperation,
  useFileUndoState,
} from "@/lib/engine/fs-undo";
import { playSoundThemeEvent } from "@/lib/shell/sound-effects";
import { inferMimeType } from "@/lib/xdg/xdg-mimeapps";
import { resolveUserDirPath } from "@/lib/xdg/xdg-user-dirs";
import {
  addGtkBookmark,
  GTK_BOOKMARKS_RELATIVE_PATH,
  parseGtkBookmarks,
  removeGtkBookmark,
  serializeGtkBookmarks,
  type GtkBookmark,
} from "@/lib/xdg/xdg-bookmarks";
import { useOpenPath } from "@/hooks/use-open-path";

interface XdgPlaceItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
}

const WEB_VFS_APPS_URI = "piloti://apps";

function buildXdgPlaces(
  dirPath: (key: "DESKTOP" | "DOCUMENTS" | "DOWNLOAD" | "MUSIC" | "PICTURES" | "VIDEOS") => string
): XdgPlaceItem[] {
  return [
  {
    id: "home",
    label: "Home",
    path: WEB_VFS_HOME,
    icon: <HomeIcon className="size-4" />,
  },
  {
    id: "applications",
    label: "Applications",
    path: WEB_VFS_APPS_URI,
    icon: <LayoutGridIcon className="size-4" />,
  },
  {
    id: "recents",
    label: "Recents",
    path: WEB_VFS_RECENTS_URI,
    icon: <ClockIcon className="size-4" />,
  },
  {
    id: "favorites",
    label: "Favorites",
    path: WEB_VFS_FAVORITES_URI,
    icon: <HeartIcon className="size-4" />,
  },
  {
    id: "desktop",
    label: "Desktop",
    path: dirPath("DESKTOP"),
    icon: <MonitorIcon className="size-4" />,
  },
  {
    id: "documents",
    label: "Documents",
    path: dirPath("DOCUMENTS"),
    icon: <FileTextIcon className="size-4" />,
  },
  {
    id: "downloads",
    label: "Downloads",
    path: dirPath("DOWNLOAD"),
    icon: <DownloadIcon className="size-4" />,
  },
  {
    id: "music",
    label: "Music",
    path: dirPath("MUSIC"),
    icon: <MusicIcon className="size-4" />,
  },
  {
    id: "pictures",
    label: "Pictures",
    path: dirPath("PICTURES"),
    icon: <ImageIcon className="size-4" />,
  },
  {
    id: "trash",
    label: "Trash",
    path: WEB_VFS_TRASH,
    icon: <Trash2Icon className="size-4" />,
  },
  {
    id: "videos",
    label: "Videos",
    path: dirPath("VIDEOS"),
    icon: <VideoIcon className="size-4" />,
  },
  ];
}

const ICON_ZOOM_LEVELS = [
  { cellWidth: 148, cellHeight: 24, iconSize: 16 },
  { cellWidth: 158, cellHeight: 30, iconSize: 24 },
  // Icon views: tight like Finder (64px icons ≈ 112×112 cells).
  { cellWidth: 80, cellHeight: 84, iconSize: 32 },
  { cellWidth: 100, cellHeight: 100, iconSize: 48 },
  { cellWidth: 104, cellHeight: 104, iconSize: 56 },
  { cellWidth: 112, cellHeight: 112, iconSize: 64 },
  { cellWidth: 144, cellHeight: 150, iconSize: 96 },
  { cellWidth: 176, cellHeight: 184, iconSize: 128 },
  { cellWidth: 248, cellHeight: 260, iconSize: 192 },
  { cellWidth: 312, cellHeight: 324, iconSize: 256 },
  { cellWidth: 376, cellHeight: 388, iconSize: 320 },
  { cellWidth: 440, cellHeight: 452, iconSize: 384 },
] as const;

// List rows step through the shared icon size scale.
const LIST_ZOOM_LEVELS = ICON_SIZES;

/** A folder shows its opening this long before Folders navigates into it. */
const FOLDER_OPEN_DELAY_MS = 180;

const NO_ENTRIES: WebVfsEntry[] = [];

/** The Folders View menu, shared with the menu bar (catalog). */
const filesViewMenuItems = () =>
  APP_CATALOG.find((app) => app.id === "nautilus")?.menus.find(
    (section) => section.title === "View"
  )?.items ?? [];

export function FilesApp({
  initialPath,
  windowId,
}: {
  initialPath?: string;
  windowId?: string;
}) {
  const piloti = usePiloti();
  const settings = useDesktopSettings(["accentColor", "computerModel", "debugMode", "fileActivationMode", "installedWebApps", "muted", "volume"]);
  const { realFilesystem } = useCapabilities();
  const { installedXdgApps, getAppIconUrl, ensureWaylandIcons, xdgUserDirs } = useApps();
  const usbMounted = useSimulatedUsbMounted();
  const { windows, focusedWindowId } = useWindowManagerSelector((wm) => ({
    windows: wm.windows.map((w) => ({ appId: w.appId, payload: w.payload })),
    focusedWindowId: wm.focusedWindowId,
  }));
  const { launchApp, launchXdgApp, openWebUrl } = useWindowActions();
  const { openPath, openPathWith } = useOpenPath();

  const viewMenuState = useWindowMenuState(windowId ?? null);
  // Direct manipulation: the heart on an icon or list row (de)favorites it.
  const toggleFavoriteItem = React.useCallback((item: IconGridItem) => {
    if (!item.path || item.kind === "desktop-entry") return;
    toggleVfsEmblem(item.path, "favorite");
  }, []);
  const [viewMode, setViewMode] = React.useState<"grid" | "list" | "desktop">("grid");
  // "manual": free placement like the desktop (Sort Manually).
  const [sortBy, setSortBy] = React.useState<"manual" | "name" | "kind" | "modified" | "size">("name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [editingLocation, setEditingLocation] = React.useState(false);
  const [draftLocation, setDraftLocation] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const locationInputRef = React.useRef<HTMLInputElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const sidebarRef = React.useRef<HTMLElement | null>(null);
  const mainViewRef = React.useRef<HTMLDivElement | null>(null);
  const openFolderPaths = useOpenFolderPaths();

  const [currentPath, setCurrentPath] = React.useState<string>(() => {
    if (!initialPath) return WEB_VFS_HOME;
    const normalized = normalizeVfsPath(initialPath);
    const existing = getVfsEntry(normalized);
    if (existing?.kind === "file") {
      return existing.parentPath;
    }
    // On disk, a folder the cache hasn't listed yet (a link, a deep path) exists.
    return existing?.kind === "directory" || realFilesystem ? normalized : WEB_VFS_HOME;
  });

  React.useEffect(() => {
    return registerOpenFolderPath(currentPath);
  }, [currentPath]);

  const [gridZoomIndex, setGridZoomIndex] = React.useState(5);
  const [listZoomIndex, setListZoomIndex] = React.useState(0);
  const infoPane = useInfoPane("files-info");
  const { open: infoPaneOpen, setOpen: setInfoPaneOpen } = infoPane;
  const [showHidden, setShowHidden] = React.useState(false);
  // Favorites, Recents and Apps are built from everywhere; real folders are
  // VFS queries, refreshed by their watch.
  const isVirtualListing =
    currentPath === WEB_VFS_FAVORITES_URI ||
    currentPath === WEB_VFS_RECENTS_URI ||
    currentPath === WEB_VFS_APPS_URI;
  const [virtualEntries, setVirtualEntries] = React.useState<WebVfsEntry[]>([]);
  const folderListing = useVfsList(isVirtualListing ? null : currentPath).data;
  const vfsEntries = isVirtualListing ? virtualEntries : (folderListing ?? NO_ENTRIES);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
    const [itemMenu, setItemMenu] =
    React.useState<FileItemContextMenuState | null>(null);
  const [bgMenu, setBgMenu] = React.useState<{ x: number; y: number } | null>(
    null
  );
  const [bgNewSubOpen, setBgNewSubOpen] = React.useState(false);
  usePopupSurface(Boolean(bgMenu), () => setBgMenu(null));
  const templatesDir = resolveVfsTemplatesDir();
  const templates =
    useVfsQuery(vfsKeys.templates(templatesDir), templatesDir, () =>
      realFilesystem ? listFsTemplates(piloti) : Promise.resolve(listVfsTemplates()),
    ).data ?? NO_ENTRIES;
  const refreshVfs = useVfsRefresh();

  React.useEffect(() => {
    if (!bgMenu) setBgNewSubOpen(false);
  }, [bgMenu]);

  const [clipboard, setLocalClipboard] = React.useState(() =>
    getVfsClipboard()
  );
  React.useEffect(() => {
    return subscribeVfsClipboard(() => {
      setLocalClipboard(getVfsClipboard());
    });
  }, []);

  const isTrashView = currentPath === WEB_VFS_TRASH;
  const isFavoritesView = currentPath === WEB_VFS_FAVORITES_URI;
  const isRecentsView = currentPath === WEB_VFS_RECENTS_URI;
  const isAppsView = currentPath === WEB_VFS_APPS_URI;
  const isVirtualView = isFavoritesView || isRecentsView || isAppsView;
  React.useEffect(() => {
    if (!settings.debugMode && viewMode === "desktop") setViewMode("grid");
  }, [settings.debugMode, viewMode]);
  // "As Desktop" places icons as the desktop does, whatever the sort order.
  const isDesktopView = viewMode === "desktop" && !isVirtualView && !isTrashView;
  const arrangement = isDesktopView
    ? "desktop"
    : sortBy === "manual" && viewMode === "grid" && !isAppsView
      ? "manual"
      : "flow";

  const openFilePaths = React.useMemo(() => {
    const set = new Set<string>();
    for (const w of windows) {
      if (w.payload && w.payload.startsWith("/")) {
        set.add(w.payload.replace(/\/+$/, "") || "/");
      }
      if (w.appId.startsWith("file:")) {
        set.add(w.appId.slice("file:".length).replace(/\/+$/, "") || "/");
      }
    }
    return set;
  }, [windows]);

  const reloadDir = React.useCallback(() => {
    refreshVfs(vfsKeys.templates(templatesDir));
    if (currentPath === WEB_VFS_APPS_URI) {
      setVirtualEntries([]);
      return;
    }
    if (currentPath === WEB_VFS_FAVORITES_URI) {
      setVirtualEntries(listVfsFavoriteEntries());
      if (realFilesystem) {
        void listFsFavoriteEntries(piloti).then((entries) => setVirtualEntries(entries));
      }
      return;
    }
    if (currentPath === WEB_VFS_RECENTS_URI) {
      setVirtualEntries(listVfsRecentEntries());
      void listFsRecentEntries(piloti).then((entries) => {
        setVirtualEntries(entries);
      });
      return;
    }
    refreshVfs(vfsKeys.list(currentPath));
  }, [currentPath, piloti, realFilesystem, refreshVfs, templatesDir]);
  const archive = useArchiveActions(reloadDir);

  React.useEffect(() => onFileUndoApplied(reloadDir), [reloadDir]);

  const undoCtx = React.useMemo(() => ({ piloti }), [piloti, realFilesystem]);
  const { undoLabel, redoLabel } = useFileUndoState();

  const ops = useFolderOps({
    dirPath: currentPath,
    reload: reloadDir,
    setSelectedIds,
    isTrash: isTrashView,
    readOnly: isTrashView || isVirtualView,
  });
  const {
    pasteClipboard: handlePasteItems,
    duplicateItems: handleDuplicateItems,
    trashItems: handleTrashItems,
  } = ops;
  const externalDrop = useExternalFileDrop(
    currentPath,
    !isTrashView && !isVirtualView,
    reloadDir,
  );

  const handleRestoreItems = React.useCallback(
    (list: readonly { path: string; id: string }[]) => {
      const restoredIds = new Set<string>();
      void restoreWithUndo(undoCtx, list.map((t) => t.path)).then(reloadDir);
      for (const target of list) restoredIds.add(target.id);
      setSelectedIds((prev) => prev.filter((id) => !restoredIds.has(id)));
    },
    [reloadDir, undoCtx]
  );

  const latestActionsRef = React.useRef<{
    canGoUp: boolean;
    handleGoUp: () => void;
    handleNewFolder: () => void;
    handleNewTextFile: () => void;
    stepZoom: (delta: number) => void;
    openSelected: () => void;
    cutSelected: () => void;
    copySelected: () => void;
    pasteClipboard: () => void;
    duplicateSelected: () => void;
    compressSelected: () => void;
    renameSelected: () => void;
    trashSelected: () => void;
  }>({
    canGoUp: false,
    handleGoUp: () => {},
    handleNewFolder: () => {},
    handleNewTextFile: () => {},
    stepZoom: () => {},
    openSelected: () => {},
    cutSelected: () => {},
    copySelected: () => {},
    pasteClipboard: () => {},
    duplicateSelected: () => {},
    compressSelected: () => {},
    renameSelected: () => {},
    trashSelected: () => {},
  });

  React.useEffect(() => {
    if (!windowId || focusedWindowId !== windowId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        editingLocation ||
        renamingId ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "l") {
          e.preventDefault();
          locationInputRef.current?.select();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setSearchOpen(false);
        setSearchQuery("");
        setDraftLocation(currentPath);
        setEditingLocation(true);
      } else if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        e.key.toLowerCase() === "h"
      ) {
        e.preventDefault();
        setShowHidden((prev) => !prev);
      } else if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        e.key.toLowerCase() === "f"
      ) {
        e.preventDefault();
        setEditingLocation(false);
        setSearchOpen((prev) => {
          const next = !prev;
          if (!next) setSearchQuery("");
          return next;
        });
      } else if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        e.key.toLowerCase() === "x" &&
        selectedIds.length > 0 &&
        !isTrashView &&
        !isVirtualView
      ) {
        e.preventDefault();
        setVfsClipboard({ mode: "cut", paths: selectedIds });
      } else if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        e.key.toLowerCase() === "c" &&
        selectedIds.length > 0 &&
        !isTrashView
      ) {
        e.preventDefault();
        setVfsClipboard({ mode: "copy", paths: selectedIds });
      } else if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y") &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        if (e.key.toLowerCase() === "y" || e.shiftKey) void redoFileOperation();
        else void undoFileOperation();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        e.key.toLowerCase() === "v" &&
        clipboard
      ) {
        e.preventDefault();
        handlePasteItems();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        e.key.toLowerCase() === "d" &&
        selectedIds.length > 0 &&
        !isTrashView &&
        !isVirtualView
      ) {
        e.preventDefault();
        handleDuplicateItems(selectedIds.map((p) => ({ id: p, path: p })));
      } else if (
        ((e.ctrlKey && !e.altKey && !e.shiftKey && e.key === "Enter") ||
          e.key === "F2") &&
        selectedIds.length === 1 &&
        !isTrashView &&
        !isVirtualView
      ) {
        e.preventDefault();
        setRenamingId(selectedIds[0]);
      } else if (
        e.key === "Enter" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.shiftKey &&
        selectedIds.length === 1 &&
        !(e.target as HTMLElement | null)?.closest('[role="grid"]')
      ) {
        const target = items.find((i) => i.id === selectedIds[0]);
        if (target) {
          e.preventDefault();
          handleActivateItem(target);
        }
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIds.length > 0
      ) {
        e.preventDefault();
        handleTrashItems(selectedIds.map((p) => ({ id: p, path: p })));
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === "n" &&
        !isTrashView &&
        !isVirtualView
      ) {
        e.preventDefault();
        latestActionsRef.current.handleNewFolder();
      } else if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        (e.key === "ArrowLeft" || e.key === "ArrowUp") &&
        latestActionsRef.current.canGoUp
      ) {
        e.preventDefault();
        latestActionsRef.current.handleGoUp();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !e.shiftKey &&
        e.key === "1"
      ) {
        e.preventDefault();
        setViewMode("grid");
      } else if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !e.shiftKey &&
        e.key === "2"
      ) {
        e.preventDefault();
        setViewMode("list");
      } else if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        (e.key === "=" || e.key === "+")
      ) {
        e.preventDefault();
        latestActionsRef.current.stepZoom(1);
      } else if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        e.key === "-"
      ) {
        e.preventDefault();
        latestActionsRef.current.stepZoom(-1);
      } else if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !e.shiftKey &&
        e.key.toLowerCase() === "i"
      ) {
        e.preventDefault();
        setInfoPaneOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    clipboard,
    currentPath,
    editingLocation,
    focusedWindowId,
    handleDuplicateItems,
    handlePasteItems,
    handleTrashItems,
    isTrashView,
    isVirtualView,
    renamingId,
    selectedIds,
    windowId,
  ]);

  React.useEffect(() => {
    if (!searchOpen) return;
    const frame = requestAnimationFrame(() => {
      const el = searchInputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [searchOpen]);

  React.useEffect(() => {
    if (!editingLocation) return;
    const frame = requestAnimationFrame(() => {
      locationInputRef.current?.focus();
      locationInputRef.current?.select();
    });
    const onPointerDown = (e: PointerEvent) => {
      if (locationInputRef.current?.contains(e.target as Node)) return;
      setEditingLocation(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [editingLocation]);

  const submitLocationEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = draftLocation.trim();
    if (raw === WEB_VFS_APPS_URI) {
      setCurrentPath(WEB_VFS_APPS_URI);
      setSelectedIds([]);
    } else if (raw) {
      const target = raw.startsWith("~")
        ? `${WEB_VFS_HOME}${raw.slice(1)}`
        : normalizeVfsPath(raw);
      const entry = getVfsEntry(target);
      if (entry?.kind === "directory") {
        setCurrentPath(entry.path);
        setSelectedIds([]);
      }
    }
    setEditingLocation(false);
  };

  React.useEffect(() => {
    // Virtual views depend on emblems/access counts anywhere, so they listen to
    // everything. Real folders and templates are watched by their queries.
    if (!isVirtualListing) return;
    reloadDir();
    return subscribeWebVfs(() => reloadDir());
  }, [isVirtualListing, reloadDir]);

  React.useEffect(() => {
    if (!initialPath) return;
    const normalized = normalizeVfsPath(initialPath);
    const existing = getVfsEntry(normalized);
    if (existing?.kind === "file") {
      setCurrentPath(existing.parentPath);
    } else if (existing?.kind === "directory" || realFilesystem) {
      setCurrentPath(normalized);
    }
  }, [initialPath, realFilesystem]);

  React.useEffect(() => {
    const candidates = new Set<string>();
    for (const entry of vfsEntries) {
      for (const candidate of entryVisual(entry).iconCandidates) {
        candidates.add(candidate);
      }
    }
    if (candidates.size > 0) {
      ensureWaylandIcons(Array.from(candidates));
    }
  }, [ensureWaylandIcons, vfsEntries]);

  const listedItems = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (isAppsView) {
      const builtins = APP_CATALOG.filter((app) => Boolean(app.builtinComponent));
      const seenKeys = new Set<string>();
      const appItems: IconGridItem[] = [];
      for (const app of builtins) {
        seenKeys.add(app.id.toLowerCase());
        seenKeys.add(app.name.toLowerCase());
        appItems.push({
          id: `app:builtin:${app.id}`,
          name: _(app.name),
          kind: "desktop-entry",
          path: `${WEB_VFS_APPS_URI}/${app.id}`,
          iconName: (app.iconName === "file-text"
            ? "notes"
            : app.iconName) as AppSymbolName,
          iconUrl: getAppIconUrl(app.id),
          gradient: app.gradient,
        });
      }
      for (const entry of installedXdgApps) {
        if (
          entry.desktopId.startsWith("piloti-webapp-") ||
          entry.exec?.startsWith("piloti-webapp ")
        ) {
          continue;
        }
        const idKey = entry.appId.toLowerCase();
        const desktopKey = entry.desktopId.toLowerCase();
        const nameKey = entry.name.toLowerCase();
        if (
          seenKeys.has(idKey) ||
          seenKeys.has(desktopKey) ||
          seenKeys.has(nameKey)
        ) {
          continue;
        }
        seenKeys.add(desktopKey);
        seenKeys.add(nameKey);
        appItems.push({
          id: `app:xdg:${entry.desktopId}`,
          name: entry.name,
          kind: "desktop-entry",
          path: `${WEB_VFS_APPS_URI}/${entry.desktopId}`,
          iconName: "sparkles",
          iconUrl:
            entry.iconUrl ??
            getAppIconUrl(entry.desktopId) ??
            (entry.icon && /^https?:\/\//i.test(entry.icon)
              ? entry.icon
              : undefined),
          desktopEntry: entry,
        });
      }
      for (const webApp of settings.installedWebApps) {
        const webKey = `web:${webApp.url.toLowerCase()}`;
        if (seenKeys.has(webKey) || seenKeys.has(webApp.id.toLowerCase())) {
          continue;
        }
        seenKeys.add(webKey);
        seenKeys.add(webApp.id.toLowerCase());
        const resolvedIcon =
          (webApp.iconUrl && /^(https?:|data:|blob:|\/)/i.test(webApp.iconUrl)
            ? webApp.iconUrl
            : undefined) ||
          getWebAppFaviconUrl(webApp.url) ||
          getAppIconUrl("browser") ||
          getAppIconUrl("web-browser");
        appItems.push({
          id: `app:web:${webApp.id}`,
          name: resolveWebAppTitle({
            rawUrl: webApp.url,
            hostTitle: webApp.title,
            installedApps: settings.installedWebApps,
          }),
          kind: "desktop-entry",
          path: webApp.url,
          iconName: "globe",
          iconUrl: resolvedIcon,
        });
      }
      const filtered = q
        ? appItems.filter((item) => item.name.toLowerCase().includes(q))
        : appItems;
      return filtered.sort((a, b) => a.name.localeCompare(b.name));
    }
    const hiddenNames = hiddenNamesOf(vfsEntries, currentPath);
    const visible = showHidden
      ? vfsEntries
      : vfsEntries.filter(
          (entry) => !entry.name.startsWith(".") && !hiddenNames.has(entry.name)
        );
    const searched = q
      ? visible.filter((entry) => entry.name.toLowerCase().includes(q))
      : visible;
    const dirFactor = sortDir === "asc" ? 1 : -1;
    const sorted = [...searched].sort((a, b) => {
      const rankA = a.kind === "directory" ? 0 : 1;
      const rankB = b.kind === "directory" ? 0 : 1;
      if (rankA !== rankB) return rankA - rankB;
      if (sortBy === "modified") {
        const diff = a.updatedAt - b.updatedAt;
        if (diff !== 0) return diff * dirFactor;
      } else if (sortBy === "size") {
        const sizeA = a.size ?? a.content?.length ?? 0;
        const sizeB = b.size ?? b.content?.length ?? 0;
        if (sizeA !== sizeB) return (sizeA - sizeB) * dirFactor;
      } else if (sortBy === "kind") {
        const extA = a.kind === "directory" ? "" : a.name.split(".").pop()?.toLowerCase() ?? "";
        const extB = b.kind === "directory" ? "" : b.name.split(".").pop()?.toLowerCase() ?? "";
        const extCmp = extA.localeCompare(extB);
        if (extCmp !== 0) return extCmp * dirFactor;
      }
      return (
        a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
          numeric: true,
        }) * dirFactor
      );
    });
    const gridItems = sorted.map((entry) =>
      vfsEntryToGridItem(
        entry,
        getAppIconUrl,
        entry.name.startsWith(".") || hiddenNames.has(entry.name)
      )
    );
    return isDesktopView ? sortDesktopItems(gridItems) : gridItems;
  }, [
    currentPath,
    getAppIconUrl,
    installedXdgApps,
    isAppsView,
    isDesktopView,
    searchQuery,
    settings.installedWebApps,
    showHidden,
    sortBy,
    sortDir,
    vfsEntries,
  ]);
  const items = useLauncherItems(listedItems, isDesktopView);

  React.useEffect(() => {
    if (!usbMounted && isSimulatedUsbPath(currentPath)) {
      setCurrentPath(WEB_VFS_HOME);
      setSelectedIds([]);
    }
  }, [currentPath, usbMounted]);

  const xdgPlaces = React.useMemo(
    () =>
      buildXdgPlaces((key) =>
        !realFilesystem
          ? resolveUserDirPath(key, [], WEB_VFS_HOME)
          : resolveUserDirPath(key, xdgUserDirs, WEB_VFS_HOME)
      ),
    [realFilesystem, xdgUserDirs]
  );

  // Sidebar bookmarks: the same GTK file Nautilus and file choosers use.
  const bookmarksFile = `${WEB_VFS_HOME}/${GTK_BOOKMARKS_RELATIVE_PATH}`;
  const bookmarksText = useVfsText(bookmarksFile).data;
  const bookmarks = React.useMemo(
    () => parseGtkBookmarks(bookmarksText ?? ""),
    [bookmarksText],
  );
  const queryClient = useQueryClient();
  const saveBookmarks = React.useCallback(
    async (next: GtkBookmark[]) => {
      const text = serializeGtkBookmarks(next);
      // Shown at once; the watch confirms once the file is written.
      queryClient.setQueryData(vfsKeys.text(bookmarksFile), text);
      if (realFilesystem) await hostFiles(piloti).createDir(".config/gtk-3.0").catch(() => undefined);
      void writeFsTextFile(piloti, bookmarksFile, text);
    },
    [bookmarksFile, piloti, queryClient, realFilesystem],
  );
  const bookmarkedPaths = React.useMemo(() => new Set(bookmarks.map((b) => b.path)), [bookmarks]);
  const toggleBookmark = React.useCallback(
    (path: string) =>
      void saveBookmarks(
        bookmarkedPaths.has(path) ? removeGtkBookmark(bookmarks, path) : addGtkBookmark(bookmarks, path),
      ),
    [bookmarkedPaths, bookmarks, saveBookmarks],
  );

  const placesList = React.useMemo<XdgPlaceItem[]>(
    () => {
      const base = [
        // A folder that is the home itself (XDG_DOWNLOAD_DIR="$HOME/") would select twice.
        ...xdgPlaces.filter((p) => p.id === "home" || p.path !== WEB_VFS_HOME),
        ...bookmarks.map((b) => ({
          id: `bookmark:${b.path}`,
          label: b.label ?? (b.path.slice(b.path.lastIndexOf("/") + 1) || "/"),
          path: b.path,
          icon: <FolderIcon className="size-4" />,
        })),
      ];
      return usbMounted
        ? [
            ...base,
            {
              id: "usb-drive",
              label: SIMULATED_USB_LABEL,
              path: SIMULATED_USB_PATH,
              icon: <UsbIcon className="size-4" />,
            },
          ]
        : base;
    },
    [usbMounted, xdgPlaces, bookmarks]
  );

  const activePlace = placesList.find((p) => p.path === currentPath);
  // Only the folder itself lights up its sidebar row, not its subfolders.
  const activeSidebarPath = activePlace?.path ?? "";
  const currentTitle =
    activePlace?.label ??
    (currentPath.split("/").filter(Boolean).pop() || _("Folders"));

  const canGoUp =
    !isTrashView &&
    !isVirtualView &&
    ((currentPath !== WEB_VFS_HOME &&
      currentPath.startsWith(`${WEB_VFS_HOME}/`)) ||
      currentPath.startsWith(`${SIMULATED_USB_PATH}/`));

  const {
    onSidebarKeyDown,
    onSidebarKeyUp,
    onContentKeyDown,
  } = useSidebarKeyboardNav({
    itemIds: placesList.map((p) => p.path),
    activeId: activeSidebarPath,
    onActivate: (path) => {
      setCurrentPath(path);
      setSelectedIds([]);
    },
    sidebarRef,
    contentRef: mainViewRef,
  });

  const sidebarItems = React.useMemo<SidebarItem[]>(
    () =>
      placesList.map((place) => {
        const isUsb = place.id === "usb-drive";
        return {
          id: place.path,
          label: isUsb ? SIMULATED_USB_LABEL : _(place.label),
          icon: place.icon,
          selected: activeSidebarPath === place.path,
          dropPath:
            place.path === WEB_VFS_FAVORITES_URI ||
            place.path === WEB_VFS_RECENTS_URI
              ? undefined
              : place.path,
          separatorAfter:
            place.id === "favorites" || (place.id === "videos" && bookmarks.length > 0),
          pinnedBottom: isUsb,
          trailingAction: place.id.startsWith("bookmark:")
            ? {
                icon: <XIcon className="size-3.5" />,
                label: _("Remove from Bookmarks"),
                onClick: () => toggleBookmark(place.path),
              }
            : isUsb
            ? {
                icon: <EjectIcon className="size-3.5" />,
                label: _("Eject USB Drive"),
                onClick: unmountSimulatedUsb,
              }
            : undefined,
          onClick: () => {
            setCurrentPath(place.path);
            setSelectedIds([]);
          },
        };
      }),
    [activeSidebarPath, placesList, bookmarks.length, toggleBookmark]
  );

  const handleGoUp = () => {
    if (!canGoUp) return;
    const idx = currentPath.lastIndexOf("/");
    const parent = idx <= 0 ? WEB_VFS_HOME : currentPath.slice(0, idx);
    setCurrentPath(parent);
    setSelectedIds([]);
  };

  const handleNewFolder = async () => {
    if (isTrashView || isVirtualView) return;
    const created = await createFsFolder(piloti, currentPath);
    recordCreated(undoCtx, [created.path], "New Folder");
    reloadDir();
    setSelectedIds([created.path]);
    setRenamingId(created.path);
  };

  const handleNewTextFile = async () => {
    if (isTrashView || isVirtualView) return;
    const created = await createFsTextFile(piloti, currentPath);
    recordCreated(undoCtx, [created.path], "New Text File");
    reloadDir();
    setSelectedIds([created.path]);
    setRenamingId(created.path);
  };

  const handleNewFromTemplate = (template: WebVfsEntry) => {
    if (isTrashView || isVirtualView) return;
    void createFsFileFromTemplate(piloti, currentPath,
      template
    ).then((created) => {
      reloadDir();
      setSelectedIds([created.path]);
      setRenamingId(created.path);
    });
  };

  const newItemActionsRef = React.useRef({
    focusedWindowId,
    isTrashView,
    isVirtualView,
    handleNewFolder,
    handleNewTextFile,
  });
  newItemActionsRef.current = {
    focusedWindowId,
    isTrashView,
    isVirtualView,
    handleNewFolder,
    handleNewTextFile,
  };

  React.useEffect(() => {
    const onNewFolder = () => {
      const s = newItemActionsRef.current;
      const focused = !windowId || s.focusedWindowId === windowId;
      if (!s.isTrashView && !s.isVirtualView && focused) s.handleNewFolder();
    };
    const onNewFile = () => {
      const s = newItemActionsRef.current;
      const focused = !windowId || s.focusedWindowId === windowId;
      if (!s.isTrashView && !s.isVirtualView && focused) s.handleNewTextFile();
    };
    window.addEventListener("piloti:files-new-folder", onNewFolder);
    window.addEventListener("piloti:files-new-file", onNewFile);
    return () => {
      window.removeEventListener("piloti:files-new-folder", onNewFolder);
      window.removeEventListener("piloti:files-new-file", onNewFile);
    };
  }, [windowId]);

  React.useEffect(
    () =>
      onShellEvent("piloti:select-all", (detail, event) => {
        if (detail.windowId !== (windowId ?? null)) return;
        event.preventDefault();
        setSelectedIds(items.map((i) => i.id));
      }),
    [items, windowId],
  );

  const handleActivateItem = (item: IconGridItem) => {
    if (item.kind === "desktop-entry") {
      if (item.desktopEntry) {
        launchXdgApp(item.desktopEntry);
        return;
      }
      if (item.id.startsWith("app:builtin:")) {
        launchApp(item.id.slice("app:builtin:".length));
        return;
      }
      if (item.id.startsWith("app:web:")) {
        openWebUrl(item.path);
        return;
      }
      return;
    }
    if (item.kind === "directory") {
      setCurrentPath(item.path);
      setSelectedIds([]);
      return;
    }
    void openPath(item.path, {
      kind: "file",
      name: item.name,
      onExtracted: () => reloadDir(),
    });
  };

  const handleOpenContainingFolder = (item: IconGridItem) => {
    const idx = item.path.lastIndexOf("/");
    const parent = idx <= 0 ? WEB_VFS_HOME : item.path.slice(0, idx);
    setCurrentPath(parent);
    setSelectedIds([item.path]);
  };

  const handleCommitRename = (item: IconGridItem, nextName: string) => {
    setRenamingId(null);
    ops.renameItem(item, nextName);
  };

  const handleTrashItem = (item: IconGridItem) => {
    handleTrashItems([item]);
  };

  const zoom = ICON_ZOOM_LEVELS[gridZoomIndex] ?? ICON_ZOOM_LEVELS[5];
  const listIconSize = LIST_ZOOM_LEVELS[listZoomIndex] ?? LIST_ZOOM_LEVELS[0];
  const activeZoomIndex = viewMode === "list" ? listZoomIndex : gridZoomIndex;
  const maxZoomIndex =
    viewMode === "list"
      ? LIST_ZOOM_LEVELS.length - 1
      : ICON_ZOOM_LEVELS.length - 1;
  const stepZoom = (delta: number) => {
    if (viewMode === "list") {
      setListZoomIndex((z) =>
        Math.max(0, Math.min(LIST_ZOOM_LEVELS.length - 1, z + delta)),
      );
    } else {
      setGridZoomIndex((z) =>
        Math.max(0, Math.min(ICON_ZOOM_LEVELS.length - 1, z + delta)),
      );
    }
  };

  const selectedItems = React.useMemo(
    () => items.filter((i) => selectedIds.includes(i.id)),
    [items, selectedIds]
  );

  latestActionsRef.current = {
    canGoUp,
    handleGoUp,
    handleNewFolder,
    handleNewTextFile,
    stepZoom,
    openSelected: () => {
      if (selectedItems.length === 1) {
        handleActivateItem(selectedItems[0]);
      }
    },
    cutSelected: () => {
      if (selectedItems.length > 0 && !isTrashView && !isVirtualView) {
        setVfsClipboard({ mode: "cut", paths: selectedItems.map((i) => i.path) });
      }
    },
    copySelected: () => {
      if (selectedItems.length > 0 && !isTrashView) {
        setVfsClipboard({ mode: "copy", paths: selectedItems.map((i) => i.path) });
      }
    },
    pasteClipboard: () => handlePasteItems(),
    duplicateSelected: () => {
      if (selectedItems.length > 0 && !isTrashView && !isVirtualView) {
        handleDuplicateItems(selectedItems);
      }
    },
    compressSelected: () => {
      if (selectedItems.length > 0 && !isTrashView && !isVirtualView) {
        archive.compress(selectedItems.map((i) => i.path));
      }
    },
    renameSelected: () => {
      if (selectedItems.length === 1 && !isTrashView && !isVirtualView) {
        setRenamingId(selectedItems[0].id);
      }
    },
    trashSelected: () => {
      if (selectedItems.length > 0) {
        handleTrashItems(selectedItems);
      }
    },
  };

  React.useEffect(() => {
    if (!windowId) return;
    const hasSel = selectedItems.length > 0;
    const hasSingleSel = selectedItems.length === 1;
    const canModifyDir = !isTrashView && !isVirtualView;
    const hasClip = Boolean(clipboard && clipboard.paths.length > 0);
    publishWindowMenuState(windowId, {
      "files:new-folder": { disabled: !canModifyDir },
      "files:new-text-file": { disabled: !canModifyDir },
      "files:open": { disabled: !hasSingleSel },
      "files:undo": { disabled: !undoLabel },
      "files:redo": { disabled: !redoLabel },
      "files:cut": { disabled: !hasSel || !canModifyDir },
      "files:copy": { disabled: !hasSel || isTrashView },
      "files:paste": { disabled: !hasClip || !canModifyDir },
      "files:duplicate": { disabled: !hasSel || !canModifyDir },
      "files:compress": { disabled: !hasSel || !canModifyDir },
      "files:rename": { disabled: !hasSingleSel || !canModifyDir },
      "files:trash": { disabled: !hasSel },
      "files:eject": { disabled: !usbMounted },
      "files:go-up": { disabled: !canGoUp },
      "files:empty-trash": { disabled: !isTrashView || items.length === 0 },
      "files:view-grid": { checked: viewMode === "grid" },
      "files:view-list": { checked: viewMode === "list" },
      "files:view-desktop": {
        checked: viewMode === "desktop",
        disabled: isTrashView || isVirtualView,
        hidden: !settings.debugMode,
      },
      "files:sort-manual": { checked: sortBy === "manual", disabled: isAppsView || isDesktopView },
      "files:sort-name": { checked: sortBy === "name", disabled: isAppsView || isDesktopView },
      "files:sort-kind": { checked: sortBy === "kind", disabled: isAppsView || isDesktopView },
      "files:sort-modified": { checked: sortBy === "modified", disabled: isAppsView || isDesktopView },
      "files:sort-size": { checked: sortBy === "size", disabled: isAppsView || isDesktopView },
      "files:sort-asc": { checked: sortDir === "asc", disabled: isAppsView || isDesktopView },
      "files:sort-desc": { checked: sortDir === "desc", disabled: isAppsView || isDesktopView },
      "files:zoom-in": { disabled: isDesktopView || activeZoomIndex >= maxZoomIndex },
      "files:zoom-out": { disabled: isDesktopView || activeZoomIndex <= 0 },
      "files:toggle-hidden": { checked: showHidden },
      "files:toggle-info": { checked: infoPaneOpen },
    });
  }, [
    activeZoomIndex,
    canGoUp,
    clipboard,
    infoPaneOpen,
    realFilesystem,
    isTrashView,
    isVirtualView,
    items.length,
    maxZoomIndex,
    selectedItems.length,
    showHidden,
    undoLabel,
    redoLabel,
    sortBy,
    sortDir,
    isAppsView,
    isDesktopView,
    usbMounted,
    viewMode,
    windowId,
    settings.debugMode,
  ]);

  React.useEffect(() => {
    if (!windowId) return;
    const onAppAction = (e: Event) => {
      const detail = (
        e as CustomEvent<{ windowId?: string; actionId?: string }>
      ).detail;
      if (!detail?.actionId) return;
      if (detail.windowId && detail.windowId !== windowId) return;
      switch (detail.actionId) {
        case "files:new-folder":
          latestActionsRef.current.handleNewFolder();
          break;
        case "files:new-text-file":
          latestActionsRef.current.handleNewTextFile();
          break;
        case "files:open":
          latestActionsRef.current.openSelected();
          break;
        case "files:cut":
          latestActionsRef.current.cutSelected();
          break;
        case "files:copy":
          latestActionsRef.current.copySelected();
          break;
        case "files:paste":
          latestActionsRef.current.pasteClipboard();
          break;
        case "files:duplicate":
          latestActionsRef.current.duplicateSelected();
          break;
        case "files:compress":
          latestActionsRef.current.compressSelected();
          break;
        case "files:rename":
          latestActionsRef.current.renameSelected();
          break;
        case "files:eject":
          unmountSimulatedUsb();
          break;
        case "files:trash":
          latestActionsRef.current.trashSelected();
          break;
        case "files:undo":
          void undoFileOperation();
          break;
        case "files:redo":
          void redoFileOperation();
          break;
        case "files:go-up":
          if (latestActionsRef.current.canGoUp) {
            latestActionsRef.current.handleGoUp();
          }
          break;
        case "files:edit-location":
          setSearchOpen(false);
          setSearchQuery("");
          setDraftLocation(currentPath);
          setEditingLocation(true);
          break;
        case "files:find":
          setEditingLocation(false);
          setSearchOpen((prev) => {
            const next = !prev;
            if (!next) setSearchQuery("");
            return next;
          });
          break;
        case "files:empty-trash":
          if (isTrashView && items.length > 0) {
            void emptyFsTrash(piloti).then(() =>
              reloadDir(),
            );
          }
          break;
        case "files:view-grid":
          setViewMode("grid");
          break;
        case "files:view-list":
          setViewMode("list");
          break;
        case "files:view-desktop":
          setViewMode("desktop");
          break;
        case "files:sort-manual":
          setSortBy("manual");
          setViewMode("grid");
          break;
        case "files:sort-name":
          setSortBy("name");
          break;
        case "files:sort-kind":
          setSortBy("kind");
          break;
        case "files:sort-modified":
          setSortBy("modified");
          break;
        case "files:sort-size":
          setSortBy("size");
          break;
        case "files:sort-asc":
          setSortDir("asc");
          break;
        case "files:sort-desc":
          setSortDir("desc");
          break;
        case "files:zoom-in":
          latestActionsRef.current.stepZoom(1);
          break;
        case "files:zoom-out":
          latestActionsRef.current.stepZoom(-1);
          break;
        case "files:toggle-hidden":
          setShowHidden((v) => !v);
          break;
        case "files:toggle-info":
          setInfoPaneOpen((v) => !v);
          break;
      }
    };
    window.addEventListener("piloti:app-action", onAppAction);
    return () => window.removeEventListener("piloti:app-action", onAppAction);
  }, [
    currentPath,
    piloti,
    realFilesystem,
    isTrashView,
    items.length,
    reloadDir,
    windowId,
  ]);

  const bgMenuPortal = bgMenu ? (
    <div
      data-popup-backdrop=""
      className="fixed inset-0 z-[500]"
      onClick={() => setBgMenu(null)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setBgMenu(null);
      }}
    >
      <div
        role="menu"
        style={{
          left: `${Math.min(window.innerWidth - 196, bgMenu.x)}px`,
          top: `${Math.min(window.innerHeight - 160, bgMenu.y)}px`,
        }}
        onClick={(e) => e.stopPropagation()}
        className={cn(MENU_POPUP_CLASS, "fixed min-w-44 overflow-visible")}
      >
        <button
          type="button"
          role="menuitem"
          onPointerEnter={() => setBgNewSubOpen(false)}
          onClick={() => {
            setBgMenu(null);
            handleNewFolder();
          }}
          className={cn(
            MENU_ITEM_CLASS,
            "w-full text-left hover:bg-ui-menu-highlight"
          )}
        >
          {_("New Folder")}
        </button>
        <div
          className="relative"
          onPointerEnter={() => setBgNewSubOpen(true)}
          onPointerLeave={() => setBgNewSubOpen(false)}
        >
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={bgNewSubOpen}
            onClick={() => setBgNewSubOpen((v) => !v)}
            className={cn(
              MENU_SUB_TRIGGER_CLASS,
              "w-full text-left hover:bg-ui-menu-highlight",
              bgNewSubOpen && "bg-ui-menu-highlight"
            )}
          >
            <span>{_("New…")}</span>
            <ChevronRightIcon className="ml-auto size-3.5" strokeWidth={2.25} />
          </button>
          {bgNewSubOpen && (
            <div
              role="menu"
              className={cn(
                MENU_POPUP_CLASS,
                "absolute top-0 z-10 min-w-44",
                bgMenu.x + 380 > window.innerWidth
                  ? "right-full mr-1"
                  : "left-full ml-1"
              )}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setBgMenu(null);
                  handleNewTextFile();
                }}
                className={cn(
                  MENU_ITEM_CLASS,
                  "w-full text-left hover:bg-ui-menu-highlight"
                )}
              >
                {_("New Text File")}
              </button>
              {templates.length > 0 && (
                <>
                  <div className={MENU_SEPARATOR_CLASS} />
                  {templates.map((tmpl) => {
                    const label = tmpl.name.replace(/\.[a-z0-9]+$/i, "") || tmpl.name;
                    return (
                      <button
                        key={tmpl.path}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setBgMenu(null);
                          handleNewFromTemplate(tmpl);
                        }}
                        className={cn(
                          MENU_ITEM_CLASS,
                          "w-full text-left hover:bg-ui-menu-highlight"
                        )}
                      >
                        <span className="truncate">{_(label)}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
        {clipboard && clipboard.paths.length > 0 ? (
          <button
            type="button"
            role="menuitem"
            onPointerEnter={() => setBgNewSubOpen(false)}
            onClick={() => {
              setBgMenu(null);
              handlePasteItems();
            }}
            className={cn(
              MENU_ITEM_CLASS,
              "w-full text-left hover:bg-ui-menu-highlight"
            )}
          >
            {_("Paste")}
          </button>
        ) : (
          <button
            type="button"
            role="menuitem"
            disabled
            className={cn(
              MENU_ITEM_CLASS,
              "w-full text-left disabled:pointer-events-none disabled:opacity-40"
            )}
          >
            {_("Paste")}
          </button>
        )}
        <div className={MENU_SEPARATOR_CLASS} />
        <button
          type="button"
          role="menuitem"
          onPointerEnter={() => setBgNewSubOpen(false)}
          onClick={() => {
            setBgMenu(null);
            launchApp("terminal", { payload: currentPath, forceNew: true });
          }}
          className={cn(
            MENU_ITEM_CLASS,
            "w-full text-left hover:bg-ui-menu-highlight"
          )}
        >
          {_("Open in Terminal")}
        </button>
      </div>
    </div>
  ) : null;

  const infoPaneNode = infoPaneOpen
    ? (() => {
        const inspectedItem =
          selectedIds.length > 0
            ? items.find((i) => i.id === selectedIds[0])
            : null;
        const inspectedVfs = inspectedItem
          ? getVfsEntry(inspectedItem.path ?? inspectedItem.id)
          : getVfsEntry(currentPath);
        const inspectedPath =
          inspectedItem?.path ??
          (!isVirtualView && !isTrashView ? currentPath : undefined);
        const inspectedEmblems = inspectedPath
          ? getVfsEmblems(inspectedPath)
          : [];
        const displayName = inspectedItem?.name ?? _(currentTitle);
        const displayKind = inspectedItem
          ? inspectedItem.kind === "directory"
            ? _("Folder")
            : inspectedItem.name.includes(".")
              ? _("%s File", inspectedItem.name.split(".").pop()?.toUpperCase() ?? "")
              : _("File")
          : _("Folder");
        const displaySize = inspectedItem
          ? inspectedItem.kind === "directory"
            ? _("%d items", listVfsDir(inspectedItem.path).length)
            : _("%d bytes", (inspectedVfs?.content ?? "").length)
          : _("%d items", items.length);
        const modifiedLabel = inspectedVfs?.updatedAt
          ? new Date(inspectedVfs.updatedAt).toLocaleDateString()
          : "—";
        const emblemOrder: readonly VfsEmblemId[] = [
          "favorite",
          "important",
          "work",
          "personal",
        ];
        return (
          <InfoPane pane={infoPane}>
            <div className="flex flex-col items-center gap-2 border-b border-ui-separator pb-3 text-center">
              <div className="size-16 shrink-0">
                {!inspectedItem || inspectedItem.kind === "directory" ? (
                  <DynamicFolderIcon
                    accentColor={settings.accentColor}
                    opened={false}
                    pathOrName={inspectedItem?.path ?? currentPath}
                    className="size-full"
                  />
                ) : (
                  <DynamicFileIcon
                    accentColor={settings.accentColor}
                    name={inspectedItem.name}
                    iconCandidates={inspectedItem.iconCandidates}
                    isEmpty={inspectedItem.isEmpty}
                    className="size-full"
                  />
                )}
              </div>
              <div className="w-full truncate text-ui-body font-semibold">
                {displayName}
              </div>
              <div className="text-ui-small text-ui-label-secondary">
                {displayKind}
              </div>
            </div>
            <dl className="space-y-2 text-ui-small">
              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0">
                  <dt className="text-ui-dim">{_("Size")}</dt>
                  <dd className="truncate font-medium">{displaySize}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-ui-dim">{_("Modified")}</dt>
                  <dd className="truncate font-medium">{modifiedLabel}</dd>
                </div>
              </div>
              <div>
                <dt className="text-ui-dim">{_("Where")}</dt>
                <dd className="flex min-w-0 text-ui-small text-ui-label-secondary">
                  <NicePathLabel path={inspectedItem?.path ?? currentPath} />
                </dd>
              </div>
              {inspectedItem?.kind === "file" &&
                inspectedItem.accessCount !== undefined && (
                  <div>
                    <dt className="text-ui-dim">{_("Opens")}</dt>
                    <dd className="font-medium">{inspectedItem.accessCount}</dd>
                  </div>
                )}
              {inspectedPath && !isTrashView && (
                <div>
                  <dt className="mb-1 text-ui-dim">{_("Tags")}</dt>
                  <dd className="flex flex-wrap gap-1">
                    {emblemOrder.map((emblem) => {
                      const meta = VFS_EMBLEM_META[emblem];
                      const active = inspectedEmblems.includes(emblem);
                      const Icon =
                        emblem === "favorite"
                          ? HeartIcon
                          : emblem === "important"
                            ? AlertCircleIcon
                            : emblem === "work"
                              ? BriefcaseIcon
                              : TagIcon;
                      return (
                        <button
                          key={emblem}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            toggleVfsEmblem(inspectedPath, emblem);
                            reloadDir();
                          }}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-ui-caption font-medium transition-colors active:bg-[color-mix(in_srgb,currentColor_22%,transparent)]",
                            meta.colorClass,
                            active
                              ? "border-current/45 bg-[color-mix(in_srgb,currentColor_14%,transparent)] hover-fill:bg-[color-mix(in_srgb,currentColor_22%,transparent)]"
                              : "border-ui-separator opacity-75 hover:opacity-100 hover-fill:bg-[color-mix(in_srgb,currentColor_12%,transparent)]"
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-2.5",
                              emblem === "favorite" && active && "fill-current"
                            )}
                          />
                          {_(meta.label)}
                        </button>
                      );
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </InfoPane>
        );
      })()
    : null;

  return (
    <AppSplitView
      title={_("Folders")}
      iconName="folder"
      sidebarItems={sidebarItems}
      sidebarWidthClass="w-40"
      sidebarId="files-sidebar"
      sidebarDefaultWidth={160}
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
          setEditingLocation(false);
          setSearchOpen(true);
          requestAnimationFrame(() => searchInputRef.current?.focus());
          return;
        }
        if (
          editingLocation ||
          renamingId ||
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
          setSearchQuery((prev) => (searchOpen ? prev + e.key : e.key));
          requestAnimationFrame(() => searchInputRef.current?.focus());
        }
      }}
      header={
        <HeaderBar>
          <HeaderBar.Start>
            <HeaderButton
              icon={ArrowLeftIcon}
              label={_("Back")}
              disabled={!canGoUp}
              onClick={handleGoUp}
            />
            {editingLocation ? (
              <form onSubmit={submitLocationEdit} className="min-w-0 flex-1">
                <input
                  ref={locationInputRef}
                  type="text"
                  value={draftLocation}
                  onChange={(e) => setDraftLocation(e.target.value)}
                  onBlur={() => setEditingLocation(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setEditingLocation(false);
                    }
                  }}
                  aria-label="Folder path"
                  className="h-7 w-64 max-w-full rounded-ui-control border border-ui-accent/70 bg-black/8 px-2 font-mono text-ui-body text-ui-label outline-none dark:bg-white/12"
                />
              </form>
            ) : (
              <button
                type="button"
                title="Click or press Ctrl+L to edit location"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery("");
                  setDraftLocation(currentPath);
                  setEditingLocation(true);
                }}
                className="flex h-7 items-center truncate rounded-ui-control px-2 text-ui-body font-semibold text-ui-label transition-colors hover-fill:bg-black/8 dark:hover-fill:bg-white/10"
              >
                {_(currentTitle)}
              </button>
            )}
          </HeaderBar.Start>
          <HeaderBar.End>
            {isTrashView && (
              <Button
                size="sm"
                variant="secondary"
                disabled={items.length === 0}
                onClick={() => {
                  void emptyFsTrash(piloti).then(() => {
                    void playSoundThemeEvent(
                      "trash-empty",
                      settings.volume,
                      settings.muted
                    );
                    reloadDir();
                  });
                }}
              >
                {_("Empty Trash")}
              </Button>
            )}
            {/* View split button (as in Nautilus): toggle grid/list, and the
                same View menu as the menu bar. */}
            {!isAppsView && (
              <div
                data-slot="files-view-split-button"
                className="flex h-7 items-center rounded-ui-control text-ui-label-secondary"
              >
                <button
                  type="button"
                  aria-label={viewMode === "grid" ? _("List view") : _("Grid view")}
                  title={viewMode === "grid" ? _("List view") : _("Grid view")}
                  onClick={() => setViewMode((m) => (m === "grid" ? "list" : "grid"))}
                  className="flex h-7 w-7 items-center justify-center rounded-l-ui-control transition-colors hover-fill:bg-black/8 hover-fill:text-ui-label active:bg-black/12 dark:hover-fill:bg-white/10 dark:active:bg-white/14"
                >
                  {viewMode === "grid" ? <ListIcon className="size-4" /> : <LayoutGridIcon className="size-4" />}
                </button>
                <span aria-hidden className="h-4 w-px bg-ui-separator" />
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={_("View")}
                    title={_("View")}
                    className="flex h-7 w-5 items-center justify-center rounded-r-ui-control transition-colors outline-none hover-fill:bg-black/8 hover-fill:text-ui-label active:bg-black/12 data-popup-open:bg-black/10 data-popup-open:text-ui-label dark:hover-fill:bg-white/10 dark:active:bg-white/14 dark:data-popup-open:bg-white/14"
                  >
                    <ChevronDownIcon className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-56">
                    <AppMenuItems
                      items={filesViewMenuItems()}
                      menuState={viewMenuState}
                      onAction={(actionId) => {
                        if (!windowId) return;
                        window.dispatchEvent(
                          new CustomEvent("piloti:app-action", {
                            detail: { windowId, actionId },
                          })
                        );
                      }}
                      computerModel={settings.computerModel}
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            <HeaderSearch
              open={searchOpen}
              onOpenChange={(open) => {
                setEditingLocation(false);
                setSearchOpen(open);
              }}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              placeholder={_("Filter files")}
              inputRef={searchInputRef}
            />

            <InfoPaneToggle pane={infoPane} />
          </HeaderBar.End>
        </HeaderBar>
      }
      rightPane={infoPaneNode}
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-ui-window">
        <div
          ref={mainViewRef}
          data-vfs-drop-path={isVirtualView ? undefined : currentPath}
          onKeyDown={onContentKeyDown}
          className="relative min-h-0 flex-1 overflow-auto bg-ui-window"
        {...externalDrop.handlers}
        onContextMenu={(e) => {
          if (isTrashView || isVirtualView) return;
          e.preventDefault();
          e.stopPropagation();
          setItemMenu(null);
          setBgMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {externalDrop.active && (
          <div className="pointer-events-none absolute inset-2 z-20 flex items-end justify-center rounded-ui-box border-2 border-dashed border-ui-accent/70 bg-ui-accent/10 pb-3">
            <span className="rounded-full bg-zinc-900/90 px-3 py-1 text-ui-body font-medium text-white shadow-sm ring-1 ring-white/10">
              {_("Drop files to copy here")}
            </span>
          </div>
        )}
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center text-ui-label-tertiary">
            <FolderIcon className="size-9 opacity-35" />
            <span className="text-ui-body">
              {isTrashView
                ? _("Trash is empty")
                : isFavoritesView
                  ? _("No favorites yet")
                  : _("Folder is empty")}
            </span>
          </div>
        ) : viewMode === "list" ? (
          <div className="p-2">
            <ListView>
              <ListViewHeader
                columns={[
                  { id: "name", label: _("Name") },
                  { id: "kind", label: _("Kind") },
                  { id: "size", label: _("Size"), align: "right" },
                  { id: "favorite", label: "", ariaLabel: _("Favorites"), width: "32px", sortable: false },
                ]}
                sort={
                  sortBy === "name" || sortBy === "kind" || sortBy === "size"
                    ? { by: sortBy, dir: sortDir }
                    : undefined
                }
                onSort={(column) => {
                  if (column !== "name" && column !== "kind" && column !== "size") return;
                  const next = nextListViewSort(
                    { by: sortBy, dir: sortDir },
                    column
                  );
                  setSortBy(next.by as typeof sortBy);
                  setSortDir(next.dir);
                }}
              />
              <tbody>
                {items.map((item) => {
                  const vfsEntry =
                    item.kind === "desktop-entry" ? undefined : getVfsEntry(item.path ?? item.id);
                  const isSelected = selectedIds.includes(item.id);
                  const isOpenedFile =
                    item.kind === "file" &&
                    Boolean(item.path) &&
                    openFilePaths.has(item.path.replace(/\/+$/, "") || "/");
                  const allRowEmblems =
                    item.kind === "desktop-entry" ? [] : getVfsEmblems(item.path);
                  const isFavorite = allRowEmblems.includes("favorite");
                  // The favorite heart has its own toggle column.
                  const rowEmblems = allRowEmblems.filter((id) => id !== "favorite");
                  const sizeLabel =
                    item.kind === "desktop-entry"
                      ? _("Application")
                      : item.kind === "directory"
                        ? _("Folder")
                        : `${(vfsEntry?.content ?? "").length} B`;
                  return (
                    <ListViewRow
                      key={item.id}
                      selected={isSelected}
                      data-vfs-drop-path={
                        item.kind === "directory" ? item.path : undefined
                      }
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        if (e.metaKey || e.ctrlKey) {
                          setSelectedIds((prev) =>
                            prev.includes(item.id)
                              ? prev.filter((id) => id !== item.id)
                              : [...prev, item.id]
                          );
                        } else if (e.shiftKey) {
                          setSelectedIds((prev) =>
                            prev.includes(item.id) ? prev : [...prev, item.id]
                          );
                        } else {
                          setSelectedIds([item.id]);
                        }
                      }}
                      onClick={(e) => {
                        if (
                          settings.fileActivationMode === "single" ||
                          item.kind === "desktop-entry"
                        ) {
                          captureLaunchOriginFromElement(e.currentTarget);
                          handleActivateItem(item);
                        }
                      }}
                      onDoubleClick={(e) => {
                        if (
                          settings.fileActivationMode === "double" &&
                          item.kind !== "desktop-entry"
                        ) {
                          captureLaunchOriginFromElement(e.currentTarget);
                          handleActivateItem(item);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        captureLaunchOriginFromElement(e.currentTarget, 10000);
                        if (!selectedIds.includes(item.id)) {
                          setSelectedIds([item.id]);
                        }
                        setBgMenu(null);
                        setItemMenu({ item, x: e.clientX, y: e.clientY });
                      }}
                      style={{
                        opacity:
                          item.isHidden || item.name.startsWith(".")
                            ? 0.55
                            : undefined,
                      }}
                    >
                      <td className="px-3 py-1.5 font-medium">
                        <div className="flex items-center gap-2.5">
                          <span
                            style={{
                              width: `${listIconSize}px`,
                              height: `${listIconSize}px`,
                            }}
                            className={cn(
                              "inline-flex shrink-0",
                              isOpenedFile &&
                                "opacity-55 grayscale-[0.45] brightness-90"
                            )}
                          >
                            {item.kind === "desktop-entry" ? (
                              <AppSquircleIcon
                                iconName={item.iconName}
                                iconUrl={item.iconUrl}
                                gradient={item.gradient}
                                squircle={item.id.startsWith("app:web:")}
                                className="size-full"
                              />
                            ) : item.kind === "directory" ? (
                              <DynamicFolderIcon
                                accentColor={settings.accentColor}
                                opened={openFolderPaths.has(item.path)}
                                pathOrName={item.path || item.name}
                                className="size-full"
                              />
                            ) : (
                              <DynamicFileIcon
                                accentColor={settings.accentColor}
                                name={item.name}
                                iconCandidates={item.iconCandidates}
                                isEmpty={item.isEmpty}
                                className="size-full"
                              />
                            )}
                          </span>
                          {renamingId === item.id ? (
                            <input
                              type="text"
                              defaultValue={item.name}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleCommitRename(item, e.currentTarget.value);
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  setRenamingId(null);
                                }
                              }}
                              onBlur={(e) =>
                                handleCommitRename(item, e.currentTarget.value)
                              }
                              className="min-w-28 rounded bg-zinc-900/95 px-1.5 py-0.5 text-ui-body font-medium text-white ring-1 ring-ui-accent outline-none"
                            />
                          ) : (
                            <span className="truncate">{item.name}</span>
                          )}
                          {rowEmblems.length > 0 && (
                            <span className="inline-flex shrink-0 items-center gap-1">
                              {rowEmblems.map((emblemId) => {
                                const meta = VFS_EMBLEM_META[emblemId];
                                const Icon =
                                  emblemId === "important"
                                    ? AlertCircleIcon
                                    : emblemId === "work"
                                      ? BriefcaseIcon
                                      : TagIcon;
                                return (
                                  <Icon
                                    key={emblemId}
                                    className={cn("size-3", meta.colorClass)}
                                  />
                                );
                              })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-ui-label-secondary">
                        {item.kind === "directory" ? _("Directory") : _("File")}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-ui-small text-ui-label-secondary">
                        {sizeLabel}
                      </td>
                      <td className="w-8 px-1 py-0 text-center">
                        {item.kind !== "desktop-entry" && (
                          <button
                            type="button"
                            data-slot="list-favorite-toggle"
                            aria-pressed={isFavorite}
                            aria-label={isFavorite ? _("Remove from Favorites") : _("Add to Favorites")}
                            title={isFavorite ? _("Remove from Favorites") : _("Add to Favorites")}
                            onPointerDown={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavoriteItem(item);
                            }}
                            className={cn(
                              "inline-flex size-6 items-center justify-center rounded-ui-control transition-opacity duration-150",
                              isFavorite
                                ? "text-red-500 opacity-100"
                                : "text-ui-label-secondary opacity-0 group-hover:opacity-60 hover:!opacity-100 focus-visible:opacity-100"
                            )}
                          >
                            <HeartIcon className={cn("size-3.5", isFavorite && "fill-current")} />
                          </button>
                        )}
                      </td>
                    </ListViewRow>
                  );
                })}
              </tbody>
            </ListView>
          </div>
        ) : (
          <FolderIconView
            items={items}
            dirPath={isVirtualView ? undefined : currentPath}
            arrangement={arrangement}
            folderOpenDelayMs={FOLDER_OPEN_DELAY_MS}
            cellWidth={zoom.cellWidth}
            cellHeight={zoom.cellHeight}
            iconSize={zoom.iconSize}
            onDropItems={ops.dropItems}
            onActivateItem={handleActivateItem}
            onContextMenuItem={(item, e) => {
              e.preventDefault();
              e.stopPropagation();
              setBgMenu(null);
              setItemMenu({ item, x: e.clientX, y: e.clientY });
            }}
            onToggleFavorite={toggleFavoriteItem}
            renamingId={renamingId}
            onCommitRename={handleCommitRename}
            onCancelRename={() => setRenamingId(null)}
            selectedIds={selectedIds}
            onSelectIds={setSelectedIds}
            ariaLabel={currentTitle}
            className="[&_button[aria-selected=false]_span]:text-ui-label [&_button_span]:drop-shadow-none"
          />
        )}
        </div>
        {/* Bottom bar: item count and zoom (28px controls max, Piloti) */}
        <div
          data-slot="files-bottom-bar"
          data-window-no-drag
          className="flex h-[26px] shrink-0 items-center justify-between gap-3 border-t border-ui-separator bg-black/[0.03] px-2.5 dark:bg-white/[0.04]"
        >
          <span
            data-testid="files-status-pill"
            className="min-w-0 truncate text-ui-small text-ui-label-secondary"
          >
            {selectedIds.length > 0
              ? _("%d selected", selectedIds.length)
              : items.length === 1
                ? _("%d item", items.length)
                : _("%d items", items.length)}
          </span>
          <div className="w-[96px] shrink-0">
            <Slider
              aria-label={_("Zoom")}
              disabled={isDesktopView}
              size="sm"
              min={0}
              max={maxZoomIndex}
              step={1}
              value={[activeZoomIndex]}
              onValueChange={(val) => {
                const next = Array.isArray(val) ? val[0] : val;
                if (typeof next !== "number") return;
                if (viewMode === "list") {
                  setListZoomIndex(Math.max(0, Math.min(maxZoomIndex, next)));
                } else {
                  setGridZoomIndex(Math.max(0, Math.min(maxZoomIndex, next)));
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Shared Icon Right-Click Menu */}
      <FileItemContextMenu
        menu={itemMenu}
        context={
          isTrashView
            ? "trash"
            : isFavoritesView
              ? "favorites"
              : isRecentsView
                ? "recents"
                : "normal"
        }
        selectedItems={selectedItems}
        onClose={() => setItemMenu(null)}
        onOpen={handleActivateItem}
        onOpenWithApp={(target, app) => {
          void openPathWith(target.path, app, { kind: target.kind === "directory" ? "directory" : "file" });
        }}
        bookmarkedPaths={bookmarkedPaths}
        onToggleBookmark={(target) => toggleBookmark(target.path)}
        onMakeLink={ops.makeLinks}
        onOpenInNewWindow={(target) =>
          launchApp("nautilus", { payload: target.path, forceNew: true })
        }
        onOpenContainingFolder={handleOpenContainingFolder}
        onShowOriginal={(target) => {
          const dest = target.symlinkTarget;
          if (!dest) return;
          const parent = dest.replace(/\/[^/]*$/, "") || "/";
          launchApp("nautilus", { payload: parent, forceNew: true });
        }}
        onRestoreItems={handleRestoreItems}
        onOpenInTerminal={(target) =>
          launchApp("terminal", { payload: target.path, forceNew: true })
        }
        onCutItems={(list) =>
          setVfsClipboard({ mode: "cut", paths: list.map((i) => i.path) })
        }
        onCopyItems={(list) =>
          setVfsClipboard({ mode: "copy", paths: list.map((i) => i.path) })
        }
        onDuplicate={handleDuplicateItems}
        onCompress={(list) => archive.compress(list.map((i) => i.path))}
        onExtract={(target) => archive.extract(target.path)}
        onDownload={
          !realFilesystem ? (target) => downloadVfsFile(target.path) : undefined
        }
        canPaste={Boolean(clipboard && clipboard.paths.length > 0)}
        onPaste={handlePasteItems}
        onRename={(target) => setRenamingId(target.id)}
        onTrash={handleTrashItem}
        onTrashItems={handleTrashItems}
      />

      {/* Empty Space Context Menu */}
      {bgMenuPortal &&
        (typeof document !== "undefined"
          ? createPortal(bgMenuPortal, document.body)
          : bgMenuPortal)}
    </AppSplitView>
  );
}
