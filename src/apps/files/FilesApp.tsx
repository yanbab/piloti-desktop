import { hostFiles } from "@/lib/engine/host-files";
import { useArchiveActions } from "@/hooks/use-archive-actions";
import { ICON_SIZES } from "@/lib/files/icon-sizes";
import { HeaderSearch } from "@/components/ui/header-search";
import { PanelRightIcon } from "lucide-react";
import { infoPaneMemory, useFolderView, type FolderView } from "@/apps/files/folder-view";
import { Segmented } from "@/components/ui/segmented";
import { nextListViewSort } from "@/components/ui/list-view";
import { FolderTreeView } from "@/components/ui/folder-tree-view";
import { useFolderTree } from "@/hooks/use-folder-tree";
import { topmostItems } from "@/lib/files/folder-tree";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useVfsList, useVfsQuery, useVfsRefresh, useVfsStat, useVfsText, useVfsWatch } from "@/hooks/use-vfs";
import { vfsKeys } from "@/lib/engine/vfs-query";
import { useCapabilities } from "@/hooks/use-capabilities";
import { usePopupSurface } from "@/lib/windows/popup-layer";
import { createPortal } from "react-dom";
import { usePiloti } from "@/lib/engine/piloti";
import { useTemplatesDirPath } from "@/hooks/use-desktop-dir";
import { parentPath } from "@/lib/ports/vfs";
import { BriefcaseIcon, HeartIcon, TagIcon } from "lucide-react";
import { AlertCircleIcon, ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon, ClockIcon, DiscIcon, DownloadIcon, EjectIcon, FileTextIcon, FolderIcon, HomeIcon, ImageIcon, LayoutGridIcon, ListIcon, MonitorIcon, MusicIcon, Trash2Icon, UsbIcon, VideoIcon, XIcon } from "@/components/ui/symbols";
import { isOnDrive, useDrives } from "@/hooks/use-drives";
import { NicePathLabel } from "@/components/common/NicePathLabel";
import { InfoPane, InfoPaneToggle, useInfoPane } from "@/components/ui/info-pane";
import { HeaderBar, HeaderButton } from "@/components/elements/header-bar";
import { AppSplitView, type SidebarItem } from "@/components/elements/split-view";
import { FolderIconView } from "@/components/ui/folder-icon-view";
import { useExternalFileDrop } from "@/hooks/use-external-file-drop";
import { useFolderOps } from "@/hooks/use-folder-ops";
import { useLauncherItems } from "@/hooks/use-launcher-items";
import {
  entryVisual,
  folderEntriesToItems,
} from "@/lib/files/folder-items";
import { AppSquircleIcon } from "@/components/common/AppSymbol";
import { useSidebarKeyboardNav } from "@/hooks/use-sidebar-keyboard-nav";
import {
  FileItemContextMenu,
  type FileItemContextMenuState,
} from "@/apps/files/FileItemContextMenu";
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
} from "@/lib/files/desktop-icons";
import { _, getLocale } from "@/lib/core/i18n";
import { onShellEvent } from "@/lib/core/shell-events";
import { captureLaunchOriginFromElement } from "@/lib/windows/launch-origin";
import { APP_CATALOG } from "@/data/catalog";
import { AppMenuItems } from "@/components/common/AppMenuItems";
import { getWebAppFaviconUrl, resolveWebAppTitle } from "@/data/web-apps";
import { ThemeFolderIcon } from "@/components/ui/folder-icon";
import {
  DynamicFileIcon,
  registerOpenFolderPath,
  useOpenFolderPaths,
} from "@/data/folder-icons";
import { cn } from "@/lib/core/utils";
import { EMBLEM_META, getEmblems, subscribeEmblems, toggleEmblem, type EmblemId } from "@/lib/engine/emblems";
import { demoFiles } from "@/lib/ports/demo-files";
import { getVfsClipboard, setVfsClipboard, subscribeVfsClipboard } from "@/lib/core/vfs-clipboard";
import { isImageVfsFile, isZipVfsFile } from "@/lib/core/vfs-media";
import { normalizeVfsPath, WEB_VFS_HOME, WEB_VFS_TRASH, type WebVfsEntry, WEB_VFS_FAVORITES_URI, WEB_VFS_RECENTS_URI } from "@/lib/core/vfs-paths";
import {
  createFsFileFromTemplate,
  createFsFolder,
  createFsTextFile,
  emptyFsTrash,
  listFsFavoriteEntries,
  listFsRecentEntries,
  RECENTLY_USED_XBEL_PATH,
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
import { playSoundThemeEvent } from "@/lib/core/sound-effects";
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

const topmostPaths = (paths: readonly string[]) =>
  topmostItems(paths.map((path) => ({ path }))).map((i) => i.path);

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
  const { drives, mount: mountDrive, eject: ejectDrive } = useDrives();
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
    toggleEmblem(item.path, "favorite");
  }, []);
  const [editingLocation, setEditingLocation] = React.useState(false);
  const [draftLocation, setDraftLocation] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const locationInputRef = React.useRef<HTMLInputElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const sidebarRef = React.useRef<HTMLElement | null>(null);
  const mainViewRef = React.useRef<HTMLDivElement | null>(null);
  const openFolderPaths = useOpenFolderPaths();

  const [currentPath, setCurrentPath] = React.useState<string>(() =>
    initialPath ? normalizeVfsPath(initialPath) : WEB_VFS_HOME,
  );

  React.useEffect(() => {
    return registerOpenFolderPath(currentPath);
  }, [currentPath]);

  const infoPane = useInfoPane("files-info", infoPaneMemory);
  const { open: infoPaneOpen, setOpen: setInfoPaneOpen } = infoPane;
  // Favorites, Recents and Apps are built from everywhere; real folders are
  // VFS queries, refreshed by their watch.
  const isVirtualListing =
    currentPath === WEB_VFS_FAVORITES_URI ||
    currentPath === WEB_VFS_RECENTS_URI ||
    currentPath === WEB_VFS_APPS_URI;
  // Opened on a folder: spatial, each folder keeps its view (see `folder-view.ts`).
  const {
    view: viewMode,
    sortBy,
    sortDir,
    gridZoom: gridZoomIndex,
    listZoom: listZoomIndex,
    showHidden,
    set: setFolderView,
  } = useFolderView(initialPath && !isVirtualListing ? currentPath : null);
  type Update<K extends keyof FolderView> = React.SetStateAction<FolderView[K]>;
  const { setViewMode, setSortBy, setSortDir, setGridZoomIndex, setListZoomIndex, setShowHidden } =
    React.useMemo(
      () => ({
        setViewMode: (v: Update<"view">) => setFolderView("view", v),
        setSortBy: (v: Update<"sortBy">) => setFolderView("sortBy", v),
        setSortDir: (v: Update<"sortDir">) => setFolderView("sortDir", v),
        setGridZoomIndex: (v: Update<"gridZoom">) => setFolderView("gridZoom", v),
        setListZoomIndex: (v: Update<"listZoom">) => setFolderView("listZoom", v),
        setShowHidden: (v: Update<"showHidden">) => setFolderView("showHidden", v),
      }),
      [setFolderView],
    );
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
  const templatesDir = useTemplatesDirPath();
  const templates =
    useVfsQuery(vfsKeys.templates(templatesDir), templatesDir, () =>
      listFsTemplates(piloti, templatesDir),
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
  }, [settings.debugMode, viewMode, setViewMode]);
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
      if (!realFilesystem) setVirtualEntries(demoFiles().favorites());
      void listFsFavoriteEntries(piloti).then((entries) => setVirtualEntries(entries));
      return;
    }
    if (currentPath === WEB_VFS_RECENTS_URI) {
      if (!realFilesystem) setVirtualEntries(demoFiles().recents());
      void listFsRecentEntries(piloti).then((entries) => {
        setVirtualEntries(entries);
      });
      return;
    }
    refreshVfs(vfsKeys.list(currentPath));
  }, [currentPath, piloti, realFilesystem, refreshVfs, templatesDir]);
  const archive = useArchiveActions(reloadDir);
  // Recents also lists what other programs opened.
  useVfsWatch(isRecentsView ? RECENTLY_USED_XBEL_PATH : null, reloadDir);

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
    ejectCurrentDrive: () => void;
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
    ejectCurrentDrive: () => {},
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
        setVfsClipboard({ mode: "cut", paths: topmostPaths(selectedIds) });
      } else if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        e.key.toLowerCase() === "c" &&
        selectedIds.length > 0 &&
        !isTrashView
      ) {
        e.preventDefault();
        setVfsClipboard({ mode: "copy", paths: topmostPaths(selectedIds) });
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
        !(e.target as HTMLElement | null)?.closest('[role="grid"], [role="treegrid"]')
      ) {
        const target = shownItems.find((i) => i.id === selectedIds[0]);
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
    setShowHidden,
    setViewMode,
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

  const submitLocationEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = draftLocation.trim();
    if (raw === WEB_VFS_APPS_URI) {
      setCurrentPath(WEB_VFS_APPS_URI);
      setSelectedIds([]);
    } else if (raw) {
      const target = raw.startsWith("~")
        ? `${WEB_VFS_HOME}${raw.slice(1)}`
        : normalizeVfsPath(raw);
      setEditingLocation(false);
      if ((await piloti.vfs.stat(target).catch(() => null))?.kind === "directory") {
        setCurrentPath(target);
        setSelectedIds([]);
      }
      return;
    }
    setEditingLocation(false);
  };

  React.useEffect(() => {
    // Virtual views depend on emblems/access counts anywhere, so they listen to
    // everything. Real folders and templates are watched by their queries.
    if (!isVirtualListing) return;
    reloadDir();
    const stopEmblems = subscribeEmblems(() => reloadDir());
    // The demo's access counts and recents are on any of its files.
    const stopDemo = demoFiles().watchAll(reloadDir);
    return () => {
      stopEmblems();
      stopDemo();
    };
  }, [isVirtualListing, reloadDir]);

  // Opened on a file: show its folder. The demo also falls back to home for a
  // path that isn't there.
  React.useEffect(() => {
    if (!initialPath) return;
    const normalized = normalizeVfsPath(initialPath);
    let current = true;
    setCurrentPath(normalized);
    void piloti.vfs
      .stat(normalized)
      .catch(() => null)
      .then((stat) => {
        if (!current) return;
        if (stat?.kind === "file") setCurrentPath(parentPath(normalized));
        else if (!stat && !realFilesystem) setCurrentPath(WEB_VFS_HOME);
      });
    return () => {
      current = false;
    };
  }, [initialPath, piloti, realFilesystem]);

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

  const toItems = React.useCallback(
    (entries: readonly WebVfsEntry[], query?: string) =>
      folderEntriesToItems(entries, { showHidden, query, sortBy, sortDir, getAppIconUrl }),
    [getAppIconUrl, showHidden, sortBy, sortDir],
  );
  // The tree searches its open folders too, so it filters its own rows.
  const treeSearches = viewMode === "list" && !isVirtualView && !isTrashView;

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
    const gridItems = toItems(vfsEntries, treeSearches ? undefined : q);
    return isDesktopView ? sortDesktopItems(gridItems) : gridItems;
  }, [
    currentPath,
    getAppIconUrl,
    installedXdgApps,
    isAppsView,
    isDesktopView,
    searchQuery,
    settings.installedWebApps,
    toItems,
    treeSearches,
    vfsEntries,
  ]);
  const items = useLauncherItems(listedItems, isDesktopView);

  const treeChildren = React.useCallback(
    (entries: readonly WebVfsEntry[]) => toItems(entries),
    [toItems],
  );
  const tree = useFolderTree({
    rootPath: currentPath,
    rootItems: items,
    toItems: treeChildren,
    query: treeSearches ? searchQuery.trim().toLowerCase() : "",
    enabled: treeSearches,
  });
  /** What is on screen: in the list, items of open folders too. */
  const shownItems = viewMode === "list" ? tree.visibleItems : items;
  React.useEffect(() => {
    const candidates = shownItems.flatMap((i) => i.iconCandidates ?? []);
    if (candidates.length > 0) ensureWaylandIcons(candidates);
  }, [ensureWaylandIcons, shownItems]);

  // Leave a drive that was ejected or unplugged.
  const previousDrivesRef = React.useRef(drives);
  React.useEffect(() => {
    const gone = previousDrivesRef.current.some(
      (drive) => isOnDrive(currentPath, drive) && !drives.some((d) => isOnDrive(currentPath, d)),
    );
    previousDrivesRef.current = drives;
    if (!gone) return;
    setCurrentPath(WEB_VFS_HOME);
    setSelectedIds([]);
  }, [currentPath, drives]);

  /** The drive the window is showing, else the first one: what "Eject" means. */
  const ejectableDrive = drives.find((d) => isOnDrive(currentPath, d)) ?? drives[0];
  const openDrive = React.useCallback(
    (drive: (typeof drives)[number]) =>
      void mountDrive(drive).then((path) => {
        if (!path) return;
        setCurrentPath(path);
        setSelectedIds([]);
      }),
    [mountDrive],
  );

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
      return [
        ...base,
        // Not mounted yet: its id stands for the path until it is.
        ...drives.map((drive) => ({
          id: `drive:${drive.id}`,
          label: drive.label,
          path: drive.mountPath ?? drive.id,
          icon: drive.kind === "optical" ? <DiscIcon className="size-4" /> : <UsbIcon className="size-4" />,
        })),
      ];
    },
    [drives, xdgPlaces, bookmarks]
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
      drives.some((d) => isOnDrive(currentPath, d) && currentPath !== d.mountPath));

  const {
    onSidebarKeyDown,
    onSidebarKeyUp,
    onContentKeyDown,
  } = useSidebarKeyboardNav({
    itemIds: placesList.map((p) => p.path),
    activeId: activeSidebarPath,
    onActivate: (path) => {
      const drive = drives.find((d) => d.id === path);
      if (drive) return openDrive(drive);
      setCurrentPath(path);
      setSelectedIds([]);
    },
    sidebarRef,
    contentRef: mainViewRef,
  });

  const sidebarItems = React.useMemo<SidebarItem[]>(
    () =>
      placesList.map((place) => {
        const drive = drives.find((d) => `drive:${d.id}` === place.id);
        return {
          id: place.path,
          label: drive ? place.label : _(place.label),
          icon: place.icon,
          selected: activeSidebarPath === place.path,
          dropPath:
            place.path === WEB_VFS_FAVORITES_URI ||
            place.path === WEB_VFS_RECENTS_URI ||
            (drive && !drive.mountPath)
              ? undefined
              : place.path,
          separatorAfter:
            place.id === "favorites" || (place.id === "videos" && bookmarks.length > 0),
          pinnedBottom: Boolean(drive),
          trailingAction: place.id.startsWith("bookmark:")
            ? {
                icon: <XIcon className="size-3.5" />,
                label: _("Remove from Bookmarks"),
                onClick: () => toggleBookmark(place.path),
              }
            : drive
            ? {
                icon: <EjectIcon className="size-3.5" />,
                label: _("Eject"),
                onClick: () => ejectDrive(drive),
              }
            : undefined,
          onClick: () => {
            if (drive) return openDrive(drive);
            setCurrentPath(place.path);
            setSelectedIds([]);
          },
        };
      }),
    [activeSidebarPath, placesList, bookmarks.length, toggleBookmark, drives, openDrive, ejectDrive]
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
        setSelectedIds(shownItems.map((i) => i.id));
      }),
    [shownItems, windowId],
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
    void ops.renameItem(item, nextName).then((renamed) => {
      if (renamed) tree.rename(item.path, renamed);
    });
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
    () => shownItems.filter((i) => selectedIds.includes(i.id)),
    [shownItems, selectedIds]
  );

  latestActionsRef.current = {
    ejectCurrentDrive: () => {
      if (ejectableDrive) ejectDrive(ejectableDrive);
    },
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
        setVfsClipboard({ mode: "cut", paths: topmostItems(selectedItems).map((i) => i.path) });
      }
    },
    copySelected: () => {
      if (selectedItems.length > 0 && !isTrashView) {
        setVfsClipboard({ mode: "copy", paths: topmostItems(selectedItems).map((i) => i.path) });
      }
    },
    pasteClipboard: () => handlePasteItems(),
    duplicateSelected: () => {
      if (selectedItems.length > 0 && !isTrashView && !isVirtualView) {
        handleDuplicateItems(selectedItems);
      }
    },
    compressSelected: () => {
      if (archive.available && selectedItems.length > 0 && !isTrashView && !isVirtualView) {
        archive.compress(topmostItems(selectedItems).map((i) => i.path));
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
      "files:compress": { disabled: !hasSel || !canModifyDir || !archive.available },
      "files:rename": { disabled: !hasSingleSel || !canModifyDir },
      "files:trash": { disabled: !hasSel },
      "files:eject": { disabled: !ejectableDrive },
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
    ejectableDrive,
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
          latestActionsRef.current.ejectCurrentDrive();
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
    setShowHidden,
    setSortBy,
    setSortDir,
    setViewMode,
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
            // Hovering opened it already: a click must not close it.
            onClick={() => setBgNewSubOpen(true)}
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

  const inspectedItem =
    infoPaneOpen && selectedIds.length > 0
      ? shownItems.find((i) => i.id === selectedIds[0])
      : null;
  const statPath = inspectedItem
    ? (inspectedItem.path ?? inspectedItem.id)
    : isVirtualListing
      ? null
      : currentPath;
  const inspectedStat = useVfsStat(infoPaneOpen ? statPath : null).data;
  const inspectedChildren = useVfsList(
    inspectedItem?.kind === "directory" ? (inspectedItem.path ?? null) : null,
  ).data;

  const infoPaneNode = infoPaneOpen
    ? (() => {
        const inspectedPath =
          inspectedItem?.path ??
          (!isVirtualView && !isTrashView ? currentPath : undefined);
        const inspectedEmblems = inspectedPath
          ? getEmblems(inspectedPath)
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
            ? inspectedChildren
              ? _("%d items", inspectedChildren.filter((e) => !e.name.startsWith(".")).length)
              : "—"
            : inspectedStat?.size !== undefined
              ? _("%d bytes", inspectedStat.size)
              : "—"
          : _("%d items", shownItems.length);
        const modifiedLabel = inspectedStat?.modifiedMs
          ? new Date(inspectedStat.modifiedMs).toLocaleDateString(
              getLocale() === "fr" ? "fr-FR" : getLocale() === "es" ? "es-ES" : "en-US",
            )
          : "—";
        const emblemOrder: readonly EmblemId[] = [
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
                  <ThemeFolderIcon
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
                // Only the demo counts opens.
                Boolean(inspectedItem.accessCount) && (
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
                      const meta = EMBLEM_META[emblem];
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
                            toggleEmblem(inspectedPath, emblem);
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
            {!isAppsView && (
              <>
                <Segmented
                  iconOnly
                  value={viewMode}
                  onChange={setViewMode}
                  options={[
                    { id: "grid", label: _("Grid view"), icon: <LayoutGridIcon className="size-4" /> },
                    { id: "list", label: _("List view"), icon: <ListIcon className="size-4" /> },
                  ]}
                />
                {/* The same View menu as the menu bar. */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<HeaderButton icon={ChevronDownIcon} label={_("View")} />}
                  />
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
              </>
            )}
            <InfoPaneToggle pane={infoPane} icon={PanelRightIcon} />
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
            <span className="rounded-full bg-ui-hud-dark px-3 py-1 text-ui-body font-medium text-ui-hud-dark-label shadow-sm ring-1 ring-ui-hud-dark-border">
              {_("Drop files to copy here")}
            </span>
          </div>
        )}
        {!isVirtualListing && folderListing === undefined ? null : shownItems.length === 0 ? (
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
          <FolderTreeView
            // Another folder: new scroll position, cursor and drag state.
            key={currentPath}
            tree={tree}
            sort={sortBy === "manual" ? undefined : { by: sortBy, dir: sortDir }}
            onSort={(column) => {
              const next = nextListViewSort({ by: sortBy, dir: sortDir }, column);
              setSortBy(next.by as typeof sortBy);
              setSortDir(next.dir);
            }}
            iconSize={listIconSize}
            accentColor={settings.accentColor}
            selectedIds={selectedIds}
            onSelectIds={setSelectedIds}
            openFilePaths={openFilePaths}
            emblemsOf={(item) => getEmblems(item.path)}
            onToggleFavorite={toggleFavoriteItem}
            renamingId={renamingId}
            onCommitRename={handleCommitRename}
            onCancelRename={() => setRenamingId(null)}
            activateOnClick={settings.fileActivationMode === "single"}
            onActivateItem={(item, row) => {
              captureLaunchOriginFromElement(row);
              handleActivateItem(item);
            }}
            onContextMenuItem={(item, e) => {
              e.preventDefault();
              e.stopPropagation();
              captureLaunchOriginFromElement(e.currentTarget, 10000);
              setBgMenu(null);
              setItemMenu({ item, x: e.clientX, y: e.clientY });
            }}
            onDropItems={isTrashView || isVirtualView ? undefined : ops.dropItems}
            ariaLabel={currentTitle}
          />
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
              : shownItems.length === 1
                ? _("%d item", shownItems.length)
                : _("%d items", shownItems.length)}
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
          setVfsClipboard({ mode: "cut", paths: topmostItems(list).map((i) => i.path) })
        }
        onCopyItems={(list) =>
          setVfsClipboard({ mode: "copy", paths: topmostItems(list).map((i) => i.path) })
        }
        onDuplicate={handleDuplicateItems}
        onCompress={
          archive.available ? (list) => archive.compress(topmostItems(list).map((i) => i.path)) : undefined
        }
        onExtract={archive.available ? (target) => archive.extract(target.path) : undefined}
        onDownload={
          !realFilesystem ? (target) => demoFiles().download(target.path) : undefined
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
