import * as React from "react";
import { createPortal } from "react-dom";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  BriefcaseIcon,
  ClockIcon,
  DownloadIcon,
  FileTextIcon,
  FolderIcon,
  HeartIcon,
  HomeIcon,
  ImageIcon,
  LayoutGridIcon,
  ListIcon,
  MonitorIcon,
  MusicIcon,
  PanelRightIcon,
  SearchIcon,
  TagIcon,
  Trash2Icon,
  VideoIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { AdwSplitView, type AdwSplitSidebarItem } from "@/components/ui/adw-split-view";
import { IconGrid } from "@/components/ui/icon-grid";
import { WindowMenuButton } from "@/components/shell/WindowMenuButton";
import { WindowControls, WindowTitlebar } from "@/components/ui/window";
import { useSidebarKeyboardNav } from "@/hooks/use-sidebar-keyboard-nav";
import {
  FileItemContextMenu,
  type FileItemContextMenuState,
} from "@/components/apps/FileItemContextMenu";
import { Button } from "@/components/ui/button";
import {
  MENU_ITEM_CLASS,
  MENU_POPUP_CLASS,
  MENU_SEPARATOR_CLASS,
} from "@/components/ui/menu-styles";
import { useApps, useSettings, useWindowManager } from "@/context/DesktopStateContext";
import {
  type IconGridItem,
  inferFileVisual,
  sortDesktopItems,
} from "@/lib/desktop-icons";
import { _ } from "@/lib/i18n";
import {
  DynamicFileIcon,
  DynamicFolderIcon,
  registerOpenFolderPath,
  useOpenFolderPaths,
} from "@/data/folder-icons";
import { cn } from "@/lib/utils";
import {
  buildVfsEntryWebAppUrl,
  copyVfsEntry,
  duplicateVfsEntry,
  getVfsClipboard,
  getVfsEmblems,
  getVfsEntry,
  importExternalFilesToVfs,
  isImageVfsFile,
  isTextEditableVfsFile,
  listVfsDir,
  listVfsFavoriteEntries,
  listVfsRecentEntries,
  normalizeVfsPath,
  setVfsClipboard,
  subscribeVfsClipboard,
  subscribeWebVfs,
  toggleVfsEmblem,
  VFS_EMBLEM_META,
  type VfsEmblemId,
  WEB_VFS_FAVORITES_URI,
  WEB_VFS_HOME,
  WEB_VFS_RECENTS_URI,
  WEB_VFS_TRASH,
  type WebVfsEntry,
} from "@/lib/web-vfs";
import {
  createFsFolder,
  createFsTextFile,
  emptyFsTrash,
  listFsDir as bridgeListFsDir,
  moveFsEntry,
  renameFsEntry,
  restoreFsEntry,
  trashFsEntry,
} from "@/lib/fs-bridge";

interface XdgPlaceItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
}

const XDG_PLACES: readonly XdgPlaceItem[] = [
  {
    id: "home",
    label: "Home",
    path: WEB_VFS_HOME,
    icon: <HomeIcon className="size-4" />,
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
    path: `${WEB_VFS_HOME}/Desktop`,
    icon: <MonitorIcon className="size-4" />,
  },
  {
    id: "documents",
    label: "Documents",
    path: `${WEB_VFS_HOME}/Documents`,
    icon: <FileTextIcon className="size-4" />,
  },
  {
    id: "downloads",
    label: "Downloads",
    path: `${WEB_VFS_HOME}/Downloads`,
    icon: <DownloadIcon className="size-4" />,
  },
  {
    id: "music",
    label: "Music",
    path: `${WEB_VFS_HOME}/Music`,
    icon: <MusicIcon className="size-4" />,
  },
  {
    id: "pictures",
    label: "Pictures",
    path: `${WEB_VFS_HOME}/Pictures`,
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
    path: `${WEB_VFS_HOME}/Videos`,
    icon: <VideoIcon className="size-4" />,
  },
];

const ICON_ZOOM_LEVELS = [
  { cellWidth: 148, cellHeight: 24, iconSize: 16 },
  { cellWidth: 158, cellHeight: 30, iconSize: 24 },
  { cellWidth: 84, cellHeight: 92, iconSize: 32 },
  { cellWidth: 108, cellHeight: 110, iconSize: 48 },
  { cellWidth: 120, cellHeight: 126, iconSize: 64 },
  { cellWidth: 132, cellHeight: 138, iconSize: 72 },
  { cellWidth: 156, cellHeight: 164, iconSize: 96 },
  { cellWidth: 184, cellHeight: 196, iconSize: 128 },
  { cellWidth: 248, cellHeight: 260, iconSize: 192 },
  { cellWidth: 312, cellHeight: 324, iconSize: 256 },
] as const;

const LIST_ZOOM_LEVELS = [16, 24, 32, 48] as const;

function vfsEntryToGridItem(
  entry: WebVfsEntry,
  getAppIconUrl: (id?: string) => string | undefined
): IconGridItem {
  const visual = inferFileVisual(entry.name, entry.kind);
  return {
    id: entry.path,
    name: entry.name,
    kind: entry.kind,
    path: entry.path,
    iconName: visual.iconName,
    iconCandidates: visual.iconCandidates,
    gradient: visual.gradient,
    iconUrl: visual.iconCandidates.map((c) => getAppIconUrl(c)).find(Boolean),
  };
}

export function FilesApp({
  initialPath,
  isCsd = false,
  windowId,
}: {
  initialPath?: string;
  isCsd?: boolean;
  windowId?: string;
}) {
  const domicile = useDomicile();
  const { getAppIconUrl, ensureWaylandIcons } = useApps();
  const { isBrowserRuntime, settings } = useSettings();
  const {
    focusedWindowId,
    launchApp,
    openWebUrl,
  } = useWindowManager();

  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
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
    return existing?.kind === "directory" ? normalized : WEB_VFS_HOME;
  });

  React.useEffect(() => {
    return registerOpenFolderPath(currentPath);
  }, [currentPath]);

  const [gridZoomIndex, setGridZoomIndex] = React.useState(3);
  const [listZoomIndex, setListZoomIndex] = React.useState(1);
  const [infoPaneOpen, setInfoPaneOpen] = React.useState(false);
  const [showHidden, setShowHidden] = React.useState(false);
  const [vfsEntries, setVfsEntries] = React.useState<WebVfsEntry[]>(() =>
    listVfsDir(currentPath)
  );
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [externalDropActive, setExternalDropActive] = React.useState(false);
  const [itemMenu, setItemMenu] =
    React.useState<FileItemContextMenuState | null>(null);
  const [bgMenu, setBgMenu] = React.useState<{ x: number; y: number } | null>(
    null
  );

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
  const isVirtualView = isFavoritesView || isRecentsView;

  const reloadDir = React.useCallback(() => {
    if (currentPath === WEB_VFS_FAVORITES_URI) {
      setVfsEntries(listVfsFavoriteEntries());
      return;
    }
    if (currentPath === WEB_VFS_RECENTS_URI) {
      setVfsEntries(listVfsRecentEntries());
      return;
    }
    if (isBrowserRuntime) {
      setVfsEntries(listVfsDir(currentPath, { includeHidden: showHidden }));
      return;
    }
    void bridgeListFsDir(domicile, isBrowserRuntime, currentPath).then((entries) => {
      setVfsEntries(entries);
    });
  }, [currentPath, domicile, isBrowserRuntime, showHidden]);

  const handlePasteItems = React.useCallback(() => {
    const clip = getVfsClipboard();
    if (!clip || clip.paths.length === 0 || isTrashView || isVirtualView) return;
    for (const srcPath of clip.paths) {
      if (clip.mode === "cut") {
        moveFsEntry(domicile, isBrowserRuntime, srcPath, currentPath);
      } else {
        copyVfsEntry(srcPath, currentPath);
      }
    }
    if (clip.mode === "cut") {
      setVfsClipboard(null);
    }
    reloadDir();
  }, [currentPath, domicile, isBrowserRuntime, isTrashView, isVirtualView, reloadDir]);

  const handleDuplicateItems = React.useCallback(
    (list: readonly { path: string; id: string }[]) => {
      if (isTrashView || isVirtualView) return;
      const createdIds: string[] = [];
      for (const target of list) {
        const dup = duplicateVfsEntry(target.path);
        if (dup) createdIds.push(dup.path);
      }
      reloadDir();
      if (createdIds.length > 0) {
        setSelectedIds(createdIds);
      }
    },
    [isTrashView, isVirtualView, reloadDir]
  );

  const handleTrashItems = React.useCallback(
    (list: readonly { path: string; id: string }[]) => {
      const removedIds = new Set<string>();
      for (const target of list) {
        trashFsEntry(domicile, isBrowserRuntime, target.path);
        removedIds.add(target.id);
      }
      reloadDir();
      setSelectedIds((prev) => prev.filter((id) => !removedIds.has(id)));
    },
    [domicile, isBrowserRuntime, reloadDir]
  );

  const handleRestoreItems = React.useCallback(
    (list: readonly { path: string; id: string }[]) => {
      const restoredIds = new Set<string>();
      for (const target of list) {
        restoreFsEntry(domicile, isBrowserRuntime, target.path);
        restoredIds.add(target.id);
      }
      reloadDir();
      setSelectedIds((prev) => prev.filter((id) => !restoredIds.has(id)));
    },
    [domicile, isBrowserRuntime, reloadDir]
  );

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
        e.key === "F2" &&
        selectedIds.length === 1 &&
        !isTrashView &&
        !isVirtualView
      ) {
        e.preventDefault();
        setRenamingId(selectedIds[0]);
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIds.length > 0
      ) {
        e.preventDefault();
        handleTrashItems(selectedIds.map((p) => ({ id: p, path: p })));
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
      searchInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [searchOpen]);

  React.useEffect(() => {
    if (!editingLocation) return;
    const frame = requestAnimationFrame(() => {
      locationInputRef.current?.focus();
      locationInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [editingLocation]);

  const submitLocationEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = draftLocation.trim();
    if (raw) {
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
    reloadDir();
    return subscribeWebVfs(reloadDir);
  }, [reloadDir]);

  React.useEffect(() => {
    if (!initialPath) return;
    const normalized = normalizeVfsPath(initialPath);
    const existing = getVfsEntry(normalized);
    if (existing?.kind === "file") {
      setCurrentPath(existing.parentPath);
    } else if (existing?.kind === "directory") {
      setCurrentPath(normalized);
    }
  }, [initialPath]);

  React.useEffect(() => {
    const candidates = new Set<string>();
    for (const entry of vfsEntries) {
      const visual = inferFileVisual(entry.name, entry.kind);
      for (const candidate of visual.iconCandidates) {
        candidates.add(candidate);
      }
    }
    if (candidates.size > 0) {
      ensureWaylandIcons(Array.from(candidates));
    }
  }, [ensureWaylandIcons, vfsEntries]);

  const items = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const visible = showHidden
      ? vfsEntries
      : vfsEntries.filter((entry) => !entry.name.startsWith("."));
    const filtered = q
      ? visible.filter((entry) => entry.name.toLowerCase().includes(q))
      : visible;
    return sortDesktopItems(
      filtered.map((entry) => vfsEntryToGridItem(entry, getAppIconUrl))
    );
  }, [getAppIconUrl, searchQuery, showHidden, vfsEntries]);

  const activePlace = XDG_PLACES.find((p) => p.path === currentPath);
  const currentTitle =
    activePlace?.label ??
    (currentPath.split("/").filter(Boolean).pop() || "Files");

  const canGoUp =
    !isTrashView &&
    !isVirtualView &&
    currentPath !== WEB_VFS_HOME &&
    currentPath.startsWith(`${WEB_VFS_HOME}/`);

  const {
    highlightedId: highlightedPlace,
    onSidebarKeyDown,
    onSidebarKeyUp,
    onContentKeyDown,
  } = useSidebarKeyboardNav({
    itemIds: XDG_PLACES.map((p) => p.path),
    activeId: currentPath,
    onActivate: (path) => {
      setCurrentPath(path);
      setSelectedIds([]);
    },
    sidebarRef,
    contentRef: mainViewRef,
  });

  const sidebarItems = React.useMemo<AdwSplitSidebarItem[]>(
    () =>
      XDG_PLACES.map((place) => ({
        id: place.path,
        label: _(place.label),
        icon: place.icon,
        selected: highlightedPlace === place.path,
        dropPath:
          place.path === WEB_VFS_FAVORITES_URI ||
          place.path === WEB_VFS_RECENTS_URI
            ? undefined
            : place.path,
        separatorAfter: place.id === "favorites",
        onClick: () => {
          setCurrentPath(place.path);
          setSelectedIds([]);
        },
      })),
    [highlightedPlace]
  );

  const handleGoUp = () => {
    if (!canGoUp) return;
    const idx = currentPath.lastIndexOf("/");
    const parent = idx <= 0 ? WEB_VFS_HOME : currentPath.slice(0, idx);
    setCurrentPath(parent);
    setSelectedIds([]);
  };

  const handleNewFolder = () => {
    if (isTrashView || isVirtualView) return;
    const created = createFsFolder(domicile, isBrowserRuntime, currentPath);
    reloadDir();
    setSelectedIds([created.path]);
    setRenamingId(created.path);
  };

  const handleNewTextFile = () => {
    if (isTrashView || isVirtualView) return;
    const created = createFsTextFile(domicile, isBrowserRuntime, currentPath);
    reloadDir();
    setSelectedIds([created.path]);
    setRenamingId(created.path);
  };

  React.useEffect(() => {
    const isThisFocused = () => !windowId || focusedWindowId === windowId;
    const onNewFolder = () => {
      if (!isTrashView && !isVirtualView && isThisFocused()) handleNewFolder();
    };
    const onNewFile = () => {
      if (!isTrashView && !isVirtualView && isThisFocused()) handleNewTextFile();
    };
    window.addEventListener("piloti:files-new-folder", onNewFolder);
    window.addEventListener("piloti:files-new-file", onNewFile);
    return () => {
      window.removeEventListener("piloti:files-new-folder", onNewFolder);
      window.removeEventListener("piloti:files-new-file", onNewFile);
    };
  });

  const handleActivateItem = (item: IconGridItem) => {
    if (item.kind === "directory") {
      setCurrentPath(item.path);
      setSelectedIds([]);
      return;
    }
    const entry = getVfsEntry(item.path);
    if (entry && entry.kind === "file") {
      if (isImageVfsFile(entry.name, entry.content)) {
        launchApp("image-viewer", { payload: entry.path });
        return;
      }
      if (isTextEditableVfsFile(entry.name)) {
        launchApp("text-editor", { payload: entry.path });
        return;
      }
      openWebUrl(buildVfsEntryWebAppUrl(entry), {
        asApp: true,
        appId: `file:${entry.path}`,
        title: entry.name,
      });
    }
  };

  const handleOpenContainingFolder = (item: IconGridItem) => {
    const idx = item.path.lastIndexOf("/");
    const parent = idx <= 0 ? WEB_VFS_HOME : item.path.slice(0, idx);
    setCurrentPath(parent);
    setSelectedIds([item.path]);
  };

  const handleCommitRename = (item: IconGridItem, nextName: string) => {
    setRenamingId(null);
    const renamed = renameFsEntry(domicile, isBrowserRuntime, item.path, nextName);
    if (renamed) {
      reloadDir();
      setSelectedIds([renamed.path]);
    }
  };

  const handleTrashItem = (item: IconGridItem) => {
    handleTrashItems([item]);
  };

  const handleDropItems = (droppedItems: IconGridItem[], destPath: string) => {
    if (destPath === WEB_VFS_TRASH) {
      handleTrashItems(droppedItems);
      return;
    }
    const movedIds = new Set<string>();
    for (const item of droppedItems) {
      if (item.path === destPath || destPath.startsWith(`${item.path}/`)) {
        continue;
      }
      moveFsEntry(domicile, isBrowserRuntime, item.path, destPath);
      movedIds.add(item.id);
    }
    if (movedIds.size > 0) {
      reloadDir();
      setSelectedIds((prev) => prev.filter((id) => !movedIds.has(id)));
    }
  };

  const zoom = ICON_ZOOM_LEVELS[gridZoomIndex] ?? ICON_ZOOM_LEVELS[3];
  const listIconSize = LIST_ZOOM_LEVELS[listZoomIndex] ?? LIST_ZOOM_LEVELS[1];
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

  const selectedItems = items.filter((i) => selectedIds.includes(i.id));

  const bgMenuPortal = bgMenu ? (
    <div
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
        className={cn(MENU_POPUP_CLASS, "fixed min-w-44")}
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setBgMenu(null);
            handleNewFolder();
          }}
          className={cn(
            MENU_ITEM_CLASS,
            "w-full text-left hover:bg-adw-menu-highlight"
          )}
        >
          {_("New Folder")}
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setBgMenu(null);
            handleNewTextFile();
          }}
          className={cn(
            MENU_ITEM_CLASS,
            "w-full text-left hover:bg-adw-menu-highlight"
          )}
        >
          {_("New Text File")}
        </button>
        {clipboard && clipboard.paths.length > 0 && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setBgMenu(null);
              handlePasteItems();
            }}
            className={cn(
              MENU_ITEM_CLASS,
              "w-full text-left hover:bg-adw-menu-highlight"
            )}
          >
            {_("Paste")}
          </button>
        )}
        <div className={MENU_SEPARATOR_CLASS} />
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setBgMenu(null);
            launchApp("terminal", { payload: currentPath, forceNew: true });
          }}
          className={cn(
            MENU_ITEM_CLASS,
            "w-full text-left hover:bg-adw-menu-highlight"
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
            ? "Folder"
            : inspectedItem.name.includes(".")
              ? `${inspectedItem.name.split(".").pop()?.toUpperCase()} File`
              : "File"
          : "Folder";
        const displaySize = inspectedItem
          ? inspectedItem.kind === "directory"
            ? `${listVfsDir(inspectedItem.path).length} items`
            : `${(inspectedVfs?.content ?? "").length} bytes`
          : `${items.length} items`;
        const modifiedLabel = inspectedVfs?.updatedAt
          ? new Date(inspectedVfs.updatedAt).toLocaleString()
          : "—";
        const emblemOrder: readonly VfsEmblemId[] = [
          "favorite",
          "important",
          "work",
          "personal",
        ];
        return (
          <aside
            aria-label="Info Pane"
            className="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto border-l border-adw-separator bg-adw-sidebar/70 p-3 text-adw-label"
          >
            <div className="flex flex-col items-center gap-2 border-b border-adw-separator pb-3 text-center">
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
                    className="size-full"
                  />
                )}
              </div>
              <div className="w-full truncate text-adw-body font-semibold">
                {displayName}
              </div>
              <div className="text-[11px] text-adw-label-secondary">
                {displayKind}
              </div>
            </div>
            <dl className="space-y-2 text-[11.5px]">
              <div>
                <dt className="text-adw-dim">Size</dt>
                <dd className="font-medium">{displaySize}</dd>
              </div>
              <div>
                <dt className="text-adw-dim">Modified</dt>
                <dd className="font-medium">{modifiedLabel}</dd>
              </div>
              <div>
                <dt className="text-adw-dim">Where</dt>
                <dd className="truncate font-mono text-[11px] text-adw-label-secondary">
                  {inspectedItem?.path ?? currentPath}
                </dd>
              </div>
              {inspectedPath && !isTrashView && (
                <div>
                  <dt className="mb-1 text-adw-dim">Emblems</dt>
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
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-colors",
                            active
                              ? cn(
                                  "border-current bg-black/10 dark:bg-white/12",
                                  meta.colorClass
                                )
                              : "border-adw-separator text-adw-label-secondary hover:bg-black/5 dark:hover:bg-white/8"
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-2.5",
                              emblem === "favorite" && active && "fill-current"
                            )}
                          />
                          {meta.label}
                        </button>
                      );
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </aside>
        );
      })()
    : null;

  return (
    <AdwSplitView
      title={_("Files")}
      appId="nautilus"
      iconName="folder"
      windowId={windowId}
      isCsd={isCsd}
      sidebarItems={sidebarItems}
      sidebarWidthClass="w-40"
      compactBreakpoint={580}
      sidebarRef={sidebarRef}
      onSidebarKeyDown={onSidebarKeyDown}
      onSidebarKeyUp={onSidebarKeyUp}
      onKeyDown={(e) => {
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
      header={({ isCompact }) => (
        <WindowTitlebar
          data-window-drag-region={isCsd ? "" : undefined}
          className={cn(
            "border-b border-adw-separator bg-adw-titlebar",
            !isCompact && "rounded-tl-none",
            !isCsd && "rounded-t-none"
          )}
        >
          <div className="flex min-w-0 items-center gap-1.5" data-window-no-drag>
            {!isCsd && (
              <WindowMenuButton
                windowId={windowId}
                appId="nautilus"
                iconName="folder"
              />
            )}
            <button
              type="button"
              aria-label={_("Back")}
              title={_("Back")}
              disabled={!canGoUp}
              onClick={handleGoUp}
              className="flex size-7 items-center justify-center rounded-md text-adw-label-secondary transition-colors hover:bg-black/8 hover:text-adw-label disabled:pointer-events-none disabled:opacity-35 dark:hover:bg-white/10"
            >
              <ArrowLeftIcon className="size-4" />
            </button>
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
                  className="h-7 w-64 max-w-full rounded-md border border-adw-accent/70 bg-black/8 px-2 font-mono text-[12px] text-adw-label outline-none dark:bg-white/12"
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
                className="flex h-7 items-center truncate rounded-md px-2 text-[13.5px] font-semibold text-adw-label transition-colors hover:bg-black/8 dark:hover:bg-white/10"
              >
                {_(currentTitle)}
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1" data-window-no-drag>
            {isTrashView && (
              <Button
                size="sm"
                variant="secondary"
                disabled={items.length === 0}
                onClick={() => {
                  void emptyFsTrash(domicile, isBrowserRuntime).then(() =>
                    reloadDir()
                  );
                }}
              >
                {_("Empty Trash")}
              </Button>
            )}
            {searchOpen ? (
              <div className="relative flex items-center">
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setSearchOpen(false);
                      setSearchQuery("");
                    }
                  }}
                  aria-label="Filter files"
                  className="h-7 w-44 rounded-md border border-adw-separator bg-black/6 px-2 text-[12px] text-adw-label outline-none focus:border-adw-accent dark:bg-white/10"
                />
              </div>
            ) : (
              <>
                <button
                  type="button"
                  aria-label={viewMode === "grid" ? "List view" : "Grid view"}
                  title={viewMode === "grid" ? "List view" : "Grid view"}
                  onClick={() => setViewMode((m) => (m === "grid" ? "list" : "grid"))}
                  className="flex size-7 items-center justify-center rounded-md text-adw-label-secondary transition-colors hover:bg-black/8 hover:text-adw-label dark:hover:bg-white/10"
                >
                  {viewMode === "grid" ? (
                    <ListIcon className="size-4" />
                  ) : (
                    <LayoutGridIcon className="size-4" />
                  )}
                </button>

                {/* Zoom Out / Zoom In Icon Buttons */}
                <button
                  type="button"
                  aria-label={_("Zoom out")}
                  title={_("Zoom out")}
                  disabled={activeZoomIndex <= 0}
                  onClick={() => stepZoom(-1)}
                  className="flex size-7 items-center justify-center rounded-md text-adw-label-secondary transition-colors hover:bg-black/8 hover:text-adw-label disabled:pointer-events-none disabled:opacity-35 dark:hover:bg-white/10"
                >
                  <ZoomOutIcon className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={_("Zoom in")}
                  title={_("Zoom in")}
                  disabled={activeZoomIndex >= maxZoomIndex}
                  onClick={() => stepZoom(1)}
                  className="flex size-7 items-center justify-center rounded-md text-adw-label-secondary transition-colors hover:bg-black/8 hover:text-adw-label disabled:pointer-events-none disabled:opacity-35 dark:hover:bg-white/10"
                >
                  <ZoomInIcon className="size-4" />
                </button>
              </>
            )}

            <button
              type="button"
              aria-label={_("Search")}
              title="Search (Ctrl+F)"
              onClick={() => {
                setEditingLocation(false);
                setSearchOpen((prev) => {
                  const next = !prev;
                  if (!next) setSearchQuery("");
                  return next;
                });
              }}
              className={cn(
                "flex size-7 items-center justify-center rounded-md transition-colors",
                searchOpen
                  ? "bg-black/10 text-adw-label dark:bg-white/15"
                  : "text-adw-label-secondary hover:bg-black/8 hover:text-adw-label dark:hover:bg-white/10"
              )}
            >
              <SearchIcon className="size-4" />
            </button>

            <button
              type="button"
              aria-label="Toggle Info Pane"
              title="Get Info"
              onClick={() => setInfoPaneOpen((v) => !v)}
              className={cn(
                "flex size-7 items-center justify-center rounded-md transition-colors",
                infoPaneOpen
                  ? "bg-black/10 text-adw-label dark:bg-white/15"
                  : "text-adw-label-secondary hover:bg-black/8 hover:text-adw-label dark:hover:bg-white/10"
              )}
            >
              <PanelRightIcon className="size-4" />
            </button>

            {/* CSD Window Controls */}
            {isCsd && windowId && (
              <div className="ml-1 flex items-center" data-window-no-drag>
                <WindowControls side="right" />
              </div>
            )}
          </div>
        </WindowTitlebar>
      )}
      rightPane={infoPaneNode}
    >
      <div
        ref={mainViewRef}
        data-vfs-drop-path={isVirtualView ? undefined : currentPath}
        onKeyDown={onContentKeyDown}
        className="relative min-h-0 flex-1 overflow-auto bg-adw-content"
        onDragOver={(e) => {
          if (isTrashView || isVirtualView || !e.dataTransfer?.types?.includes("Files")) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          if (!externalDropActive) setExternalDropActive(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setExternalDropActive(false);
          }
        }}
        onDrop={(e) => {
          if (isTrashView || isVirtualView || !e.dataTransfer?.files?.length) return;
          e.preventDefault();
          setExternalDropActive(false);
          void importExternalFilesToVfs(currentPath, e.dataTransfer.files).then(
            () => reloadDir()
          );
        }}
        onContextMenu={(e) => {
          if (isTrashView || isVirtualView) return;
          e.preventDefault();
          e.stopPropagation();
          setItemMenu(null);
          setBgMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {externalDropActive && (
          <div className="pointer-events-none absolute inset-2 z-20 flex items-end justify-center rounded-xl border-2 border-dashed border-adw-accent/70 bg-adw-accent/10 pb-3">
            <span className="rounded-full bg-zinc-900/90 px-3 py-1 text-xs font-medium text-white shadow-sm ring-1 ring-white/10">
              {_("Drop files to copy here")}
            </span>
          </div>
        )}
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center text-adw-label-tertiary">
            <FolderIcon className="size-9 opacity-35" />
            <span className="text-[12.5px]">
              {isTrashView
                ? _("Trash is empty")
                : isFavoritesView
                  ? _("No favorites yet")
                  : _("Folder is empty")}
            </span>
          </div>
        ) : viewMode === "list" ? (
          <div className="p-2">
            <table className="w-full border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-adw-separator text-[11px] font-semibold text-adw-label-secondary uppercase">
                  <th className="px-3 py-1.5">Name</th>
                  <th className="px-3 py-1.5">Kind</th>
                  <th className="px-3 py-1.5 text-right">Size</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const vfsEntry = getVfsEntry(item.path ?? item.id);
                  const isSelected = selectedIds.includes(item.id);
                  const rowEmblems = getVfsEmblems(item.path);
                  const sizeLabel =
                    item.kind === "directory"
                      ? "Folder"
                      : `${(vfsEntry?.content ?? "").length} B`;
                  return (
                    <tr
                      key={item.id}
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
                      onClick={() => {
                        if (settings.fileActivationMode === "single") {
                          handleActivateItem(item);
                        }
                      }}
                      onDoubleClick={() => {
                        if (settings.fileActivationMode === "double") {
                          handleActivateItem(item);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!selectedIds.includes(item.id)) {
                          setSelectedIds([item.id]);
                        }
                        setBgMenu(null);
                        setItemMenu({ item, x: e.clientX, y: e.clientY });
                      }}
                      className={cn(
                        "cursor-default border-b border-adw-separator/40 transition-colors",
                        isSelected
                          ? "bg-adw-accent/20 text-adw-label"
                          : "hover:bg-black/4 dark:hover:bg-white/5"
                      )}
                    >
                      <td className="px-3 py-1.5 font-medium">
                        <div className="flex items-center gap-2.5">
                          <span
                            style={{
                              width: `${listIconSize}px`,
                              height: `${listIconSize}px`,
                            }}
                            className="inline-flex shrink-0"
                          >
                            {item.kind === "directory" ? (
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
                                className="size-full"
                              />
                            )}
                          </span>
                          <span className="truncate">{item.name}</span>
                          {rowEmblems.length > 0 && (
                            <span className="inline-flex shrink-0 items-center gap-1">
                              {rowEmblems.map((emblemId) => {
                                const meta = VFS_EMBLEM_META[emblemId];
                                const Icon =
                                  emblemId === "favorite"
                                    ? HeartIcon
                                    : emblemId === "important"
                                      ? AlertCircleIcon
                                      : emblemId === "work"
                                        ? BriefcaseIcon
                                        : TagIcon;
                                return (
                                  <Icon
                                    key={emblemId}
                                    className={cn(
                                      "size-3",
                                      meta.colorClass,
                                      emblemId === "favorite" && "fill-current"
                                    )}
                                  />
                                );
                              })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-adw-label-secondary">
                        {item.kind === "directory" ? "Directory" : "File"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11.5px] text-adw-label-secondary">
                        {sizeLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <IconGrid
            items={items}
            mode="flow"
            currentDirPath={isVirtualView ? undefined : currentPath}
            cellWidth={zoom.cellWidth}
            cellHeight={zoom.cellHeight}
            iconSize={zoom.iconSize}
            onDropItems={handleDropItems}
            onActivateItem={handleActivateItem}
            onContextMenuItem={(item, e) => {
              e.preventDefault();
              e.stopPropagation();
              setBgMenu(null);
              setItemMenu({ item, x: e.clientX, y: e.clientY });
            }}
            renamingId={renamingId}
            onCommitRename={handleCommitRename}
            onCancelRename={() => setRenamingId(null)}
            selectedIds={selectedIds}
            onSelectIds={setSelectedIds}
            ariaLabel={currentTitle}
            className="[&_button[aria-selected=false]_span]:text-adw-label [&_button_span]:drop-shadow-none"
          />
        )}
        <div
          data-testid="files-status-pill"
          className="pointer-events-none absolute right-2.5 bottom-2 z-10 rounded-full border border-adw-border/60 bg-adw-card/90 px-2.5 py-0.5 text-[11px] font-medium text-adw-dim shadow-xs backdrop-blur-md"
        >
          {selectedIds.length > 0
            ? `${selectedIds.length} selected`
            : `${items.length} ${items.length === 1 ? "item" : "items"}`}
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
        onOpenInNewWindow={(target) =>
          launchApp("nautilus", { payload: target.path, forceNew: true })
        }
        onOpenContainingFolder={handleOpenContainingFolder}
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
        canPaste={Boolean(clipboard && clipboard.paths.length > 0)}
        onPaste={handlePasteItems}
        activeEmblems={itemMenu ? getVfsEmblems(itemMenu.item.path) : []}
        onToggleEmblem={(list, emblem) => {
          for (const target of list) {
            toggleVfsEmblem(target.path, emblem);
          }
          reloadDir();
        }}
        onRename={(target) => setRenamingId(target.id)}
        onGetInfo={(target) => {
          setSelectedIds([target.id]);
          setInfoPaneOpen(true);
        }}
        onNewFolder={!isTrashView && !isVirtualView ? handleNewFolder : undefined}
        onNewTextFile={
          !isTrashView && !isVirtualView ? handleNewTextFile : undefined
        }
        onTrash={handleTrashItem}
        onTrashItems={handleTrashItems}
      />

      {/* Empty Space Context Menu */}
      {bgMenuPortal &&
        (typeof document !== "undefined"
          ? createPortal(bgMenuPortal, document.body)
          : bgMenuPortal)}
    </AdwSplitView>
  );
}
