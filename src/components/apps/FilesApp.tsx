import * as React from "react";
import { createPortal } from "react-dom";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  ArrowLeftIcon,
  ClockIcon,
  DownloadIcon,
  FileTextIcon,
  FolderIcon,
  HeartCrackIcon,
  HeartIcon,
  HomeIcon,
  ImageIcon,
  LayoutGridIcon,
  ListIcon,
  Maximize2Icon,
  MinusIcon,
  MonitorIcon,
  MusicIcon,
  PanelLeftIcon,
  SearchIcon,
  Trash2Icon,
  VideoIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { IconGrid } from "@/components/ui/icon-grid";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  getVfsEntry,
  importExternalFilesToVfs,
  isImageVfsFile,
  isTextEditableVfsFile,
  isVfsFavorite,
  listVfsDir,
  listVfsFavoriteEntries,
  listVfsRecentEntries,
  loadVfsFavorites,
  normalizeVfsPath,
  subscribeWebVfs,
  toggleVfsFavorite,
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
  moveFsEntry as bridgeMoveFsEntry,
  renameFsEntry,
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
    id: "home",
    label: "Home",
    path: WEB_VFS_HOME,
    icon: <HomeIcon className="size-4" />,
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
    id: "videos",
    label: "Videos",
    path: `${WEB_VFS_HOME}/Videos`,
    icon: <VideoIcon className="size-4" />,
  },
  {
    id: "trash",
    label: "Trash",
    path: WEB_VFS_TRASH,
    icon: <Trash2Icon className="size-4" />,
  },
];

const ZOOM_LEVELS = [
  { cellWidth: 168, cellHeight: 28, iconSize: 16 },
  { cellWidth: 168, cellHeight: 28, iconSize: 20 },
  { cellWidth: 76, cellHeight: 82, iconSize: 24 },
  { cellWidth: 84, cellHeight: 92, iconSize: 32 },
  { cellWidth: 108, cellHeight: 110, iconSize: 48 },
  { cellWidth: 120, cellHeight: 126, iconSize: 64 },
  { cellWidth: 148, cellHeight: 156, iconSize: 96 },
  { cellWidth: 176, cellHeight: 184, iconSize: 128 },
] as const;

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
    closeWindow,
    launchApp,
    minimizeWindow,
    openWebUrl,
    toggleMaximizeWindow,
  } = useWindowManager();

  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const [editingLocation, setEditingLocation] = React.useState(false);
  const [draftLocation, setDraftLocation] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const locationInputRef = React.useRef<HTMLInputElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const sidebarRef = React.useRef<HTMLElement | null>(null);
  const mainViewRef = React.useRef<HTMLDivElement | null>(null);
  const [isCompact, setIsCompact] = React.useState(false);
  const [compactSidebarOpen, setCompactSidebarOpen] = React.useState(false);

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const check = () => {
      const narrow = el.clientWidth < 580;
      setIsCompact(narrow);
      if (!narrow) setCompactSidebarOpen(false);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showSidebar = !isCompact || compactSidebarOpen;
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

  const [zoomIndex, setZoomIndex] = React.useState(4);
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

  const [clipboard, setClipboard] = React.useState<{
    mode: "cut" | "copy";
    path: string;
  } | null>(null);
  const [hasFavorites, setHasFavorites] = React.useState(
    () => loadVfsFavorites().length > 0,
  );
  React.useEffect(() => {
    return subscribeWebVfs(() => {
      setHasFavorites(loadVfsFavorites().length > 0);
    });
  }, []);

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

  React.useEffect(() => {
    if (!windowId || focusedWindowId !== windowId) return;
    const onKeyDown = (e: KeyboardEvent) => {
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
        selectedIds.length > 0
      ) {
        e.preventDefault();
        setClipboard({ mode: "cut", path: selectedIds[0] });
      } else if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        e.key.toLowerCase() === "c" &&
        selectedIds.length > 0
      ) {
        e.preventDefault();
        setClipboard({ mode: "copy", path: selectedIds[0] });
      } else if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        e.key.toLowerCase() === "v" &&
        clipboard
      ) {
        e.preventDefault();
        if (clipboard.mode === "cut") {
          bridgeMoveFsEntry(domicile, isBrowserRuntime, clipboard.path, currentPath);
          setClipboard(null);
        } else {
          copyVfsEntry(clipboard.path, currentPath);
        }
        reloadDir();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [focusedWindowId, windowId, currentPath]);

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

  const isTrashView = currentPath === WEB_VFS_TRASH;
  const activePlace = XDG_PLACES.find((p) => p.path === currentPath);
  const currentTitle =
    activePlace?.label ??
    (currentPath.split("/").filter(Boolean).pop() || "Files");

  const canGoUp =
    !isTrashView &&
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

  const handleGoUp = () => {
    if (!canGoUp) return;
    const idx = currentPath.lastIndexOf("/");
    const parent = idx <= 0 ? WEB_VFS_HOME : currentPath.slice(0, idx);
    setCurrentPath(parent);
    setSelectedIds([]);
  };

  const handleNewFolder = () => {
    const created = createFsFolder(domicile, isBrowserRuntime, currentPath);
    reloadDir();
    setSelectedIds([created.path]);
    setRenamingId(created.path);
  };

  const handleNewTextFile = () => {
    const created = createFsTextFile(domicile, isBrowserRuntime, currentPath);
    reloadDir();
    setSelectedIds([created.path]);
    setRenamingId(created.path);
  };

  React.useEffect(() => {
    const isThisFocused = () => !windowId || focusedWindowId === windowId;
    const onNewFolder = () => {
      if (!isTrashView && isThisFocused()) handleNewFolder();
    };
    const onNewFile = () => {
      if (!isTrashView && isThisFocused()) handleNewTextFile();
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

  const handleCommitRename = (item: IconGridItem, nextName: string) => {
    setRenamingId(null);
    const renamed = renameFsEntry(domicile, isBrowserRuntime, item.path, nextName);
    if (renamed) {
      reloadDir();
      setSelectedIds([renamed.path]);
    }
  };

  const handleTrashItem = (item: IconGridItem) => {
    trashFsEntry(domicile, isBrowserRuntime, item.path);
    reloadDir();
    setSelectedIds((prev) => prev.filter((id) => id !== item.id));
  };

  const handleDropItem = (
    item: IconGridItem,
    clientX: number,
    clientY: number
  ) => {
    if (typeof document === "undefined") return;
    const hitElements = document.elementsFromPoint(clientX, clientY);
    for (const el of hitElements) {
      const dropTarget = (el as HTMLElement).closest?.("[data-vfs-drop-path]");
      const destPath = dropTarget?.getAttribute("data-vfs-drop-path");
      if (destPath && destPath !== item.path && destPath !== currentPath) {
        moveFsEntry(domicile, isBrowserRuntime, item.path, destPath);
        reloadDir();
        return;
      }
      if ((el as HTMLElement).closest?.("[data-desktop-icons-root]")) {
        const desktopPath = `${WEB_VFS_HOME}/Desktop`;
        if (currentPath !== desktopPath) {
          moveFsEntry(domicile, isBrowserRuntime, item.path, desktopPath);
          reloadDir();
        }
        return;
      }
    }
  };

  const zoom = ZOOM_LEVELS[zoomIndex] ?? ZOOM_LEVELS[1];

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
          top: `${Math.min(window.innerHeight - 120, bgMenu.y)}px`,
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
        <div className="my-1 h-px bg-adw-separator" />
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

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full overflow-hidden bg-adw-window text-adw-label select-none"
    >
      {/* Left Places Sidebar (collapses to VS Code-style icon activity bar on small size) */}
      <aside
        ref={sidebarRef}
        onKeyDown={onSidebarKeyDown}
        onKeyUp={onSidebarKeyUp}
        className={cn(
          "flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-adw-separator bg-adw-sidebar transition-[width] duration-150",
          isCompact ? "w-[52px]" : "w-40"
        )}
      >
        {isCsd && (
          <WindowTitlebar
            data-window-drag-region
            className="border-b-0 bg-transparent"
          >
            <div className="flex items-center gap-1.5" data-window-no-drag>
              {windowId && <WindowControls side="left" />}
              <WindowMenuButton
                windowId={windowId}
                appId="nautilus"
                iconName="folder"
              />
            </div>
            {!isCompact && (
              <span className="truncate whitespace-nowrap text-[14px] font-bold tracking-tight text-adw-label">
                {_("Files")}
              </span>
            )}
            <div className="w-7" />
          </WindowTitlebar>
        )}

        <TooltipProvider delay={450}>
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2",
              isCsd ? "pt-0.5" : "pt-2"
            )}
          >
            {XDG_PLACES.map((place) => {
              const selected = highlightedPlace === place.path;
              const isFavPlace = place.id === "favorites";
              const iconNode = isFavPlace ? (
                hasFavorites ? (
                  <>
                    <HeartIcon className="size-4 fill-rose-500 text-rose-500 group-hover/place:hidden" />
                    <HeartCrackIcon className="hidden size-4 text-rose-500 group-hover/place:block" />
                  </>
                ) : (
                  <HeartIcon className="size-4 text-adw-dim opacity-60" />
                )
              ) : (
                place.icon
              );
              const btn = (
                <button
                  key={place.id}
                  type="button"
                  aria-label={_(place.label)}
                  data-sidebar-item={place.path}
                  data-vfs-drop-path={place.path}
                  onClick={() => {
                    setCurrentPath(place.path);
                    setSelectedIds([]);
                  }}
                  className={cn(
                    "group/place flex w-full shrink-0 items-center gap-2.5 rounded-[9px] px-2.5 py-1.5 text-left text-[13px] transition-colors outline-none",
                    selected
                      ? "bg-adw-sidebar-selection font-medium text-adw-label"
                      : "font-normal text-adw-label/85 hover:bg-black/5 dark:hover:bg-white/6"
                  )}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center opacity-85">
                    {iconNode}
                  </span>
                  <span
                    className={cn(
                      "truncate transition-opacity duration-150",
                      isCompact ? "opacity-0" : "opacity-100"
                    )}
                  >
                    {_(place.label)}
                  </span>
                </button>
              );

              if (!isCompact) return btn;
              return (
                <Tooltip key={place.id}>
                  <TooltipTrigger render={btn} />
                  <TooltipContent
                    side="right"
                    sideOffset={-36}
                    className={cn(
                      "pointer-events-none h-[32px] gap-2.5 rounded-[9px] border border-adw-separator px-2.5 py-1.5 text-[13px] shadow-md",
                      selected
                        ? "bg-adw-sidebar-selection font-medium text-adw-label"
                        : "bg-adw-sidebar font-normal text-adw-label"
                    )}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center opacity-85">
                      {iconNode}
                    </span>
                    <span className="whitespace-nowrap">{_(place.label)}</span>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </aside>

      {/* Right Main Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-adw-content">
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
                  disabled={zoomIndex <= 0}
                  onClick={() => setZoomIndex((z) => Math.max(0, z - 1))}
                  className="flex size-7 items-center justify-center rounded-md text-adw-label-secondary transition-colors hover:bg-black/8 hover:text-adw-label disabled:pointer-events-none disabled:opacity-35 dark:hover:bg-white/10"
                >
                  <ZoomOutIcon className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={_("Zoom in")}
                  title={_("Zoom in")}
                  disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
                  onClick={() =>
                    setZoomIndex((z) => Math.min(ZOOM_LEVELS.length - 1, z + 1))
                  }
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
                  ? "bg-adw-accent/15 text-adw-accent"
                  : "text-adw-label-secondary hover:bg-black/8 hover:text-adw-label dark:hover:bg-white/10"
              )}
            >
              <SearchIcon className="size-4" />
            </button>

            {/* CSD Window Controls */}
            {isCsd && windowId && (
              <div className="ml-1 flex items-center" data-window-no-drag>
                <WindowControls side="right" />
              </div>
            )}
          </div>
        </WindowTitlebar>

        {/* Desktop-style Icon View */}
        <div
          ref={mainViewRef}
          onKeyDown={onContentKeyDown}
          className="relative min-h-0 flex-1 overflow-auto bg-adw-content"
          onDragOver={(e) => {
            if (isTrashView || !e.dataTransfer?.types?.includes("Files")) return;
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
            if (isTrashView || !e.dataTransfer?.files?.length) return;
            e.preventDefault();
            setExternalDropActive(false);
            void importExternalFilesToVfs(currentPath, e.dataTransfer.files).then(
              () => reloadDir()
            );
          }}
          onContextMenu={(e) => {
            if (isTrashView) return;
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
                {isTrashView ? _("Trash is empty") : _("Folder is empty")}
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
                    const sizeLabel =
                      item.kind === "directory"
                        ? "Folder"
                        : `${(vfsEntry?.content ?? "").length} B`;
                    return (
                      <tr
                        key={item.id}
                        onPointerDown={(e) => {
                          if (e.button === 0) setSelectedIds([item.id]);
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
                        <td className="px-3 py-2 font-medium">
                          {item.kind === "directory" ? (
                            <details
                              onClick={(e) => e.stopPropagation()}
                              className="group/dir"
                            >
                              <summary className="flex cursor-default list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                                <span className="inline-block w-3 text-[10px] text-adw-dim transition-transform group-open/dir:rotate-90">
                                  ▸
                                </span>
                                <span
                                  style={{
                                    width: `${Math.max(16, Math.min(32, zoom.iconSize))}px`,
                                    height: `${Math.max(16, Math.min(32, zoom.iconSize))}px`,
                                  }}
                                  className="inline-flex shrink-0"
                                >
                                  <DynamicFolderIcon
                                    accentColor={settings.accentColor}
                                    opened={openFolderPaths.has(item.path)}
                                    pathOrName={item.path || item.name}
                                    className="size-full"
                                  />
                                </span>
                                <span className="truncate">{item.name}</span>
                              </summary>
                              <div className="mt-1.5 ml-6 space-y-1 border-l border-adw-separator pl-2.5 text-[11.5px] font-normal text-adw-label-secondary">
                                {(() => {
                                  const children = listVfsDir(item.path);
                                  if (children.length === 0) {
                                    return <div className="italic opacity-65">Empty</div>;
                                  }
                                  return children.map((child) => (
                                    <div
                                      key={child.id}
                                      onDoubleClick={() => {
                                        if (child.kind === "directory") {
                                          setCurrentPath(child.path);
                                        } else {
                                          handleActivateItem({
                                            id: child.id,
                                            name: child.name,
                                            kind: child.kind,
                                            path: child.path,
                                            iconName: inferFileVisual(child.name, child.kind).iconName,
                                            gradient: "",
                                          });
                                        }
                                      }}
                                      className="flex items-center gap-2 rounded px-1.5 py-0.5 hover:bg-black/4 dark:hover:bg-white/5"
                                    >
                                      {child.kind === "directory" ? (
                                        <DynamicFolderIcon
                                          accentColor={settings.accentColor}
                                          opened={false}
                                          pathOrName={child.path}
                                          className="size-4 shrink-0"
                                        />
                                      ) : (
                                        <DynamicFileIcon
                                          accentColor={settings.accentColor}
                                          name={child.name}
                                          className="size-4 shrink-0"
                                        />
                                      )}
                                      <span className="truncate">{child.name}</span>
                                    </div>
                                  ));
                                })()}
                              </div>
                            </details>
                          ) : (
                            <div className="flex items-center gap-2 pl-5">
                              <span
                                style={{
                                  width: `${Math.max(16, Math.min(32, zoom.iconSize))}px`,
                                  height: `${Math.max(16, Math.min(32, zoom.iconSize))}px`,
                                }}
                                className="inline-flex shrink-0"
                              >
                                <DynamicFileIcon
                                  accentColor={settings.accentColor}
                                  name={item.name}
                                  iconCandidates={item.iconCandidates}
                                  className="size-full"
                                />
                              </span>
                              <span className="truncate">{item.name}</span>
                            </div>
                          )}
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
              cellWidth={zoom.cellWidth}
              cellHeight={zoom.cellHeight}
              iconSize={zoom.iconSize}
              onDropItem={handleDropItem}
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
      </div>

      {/* Shared Icon Right-Click Menu */}
      <FileItemContextMenu
        menu={itemMenu}
        isTrash={isTrashView}
        onClose={() => setItemMenu(null)}
        onOpen={handleActivateItem}
        onOpenInTerminal={(target) =>
          launchApp("terminal", { payload: target.path, forceNew: true })
        }
        onCut={(target) => setClipboard({ mode: "cut", path: target.path })}
        onCopy={(target) => setClipboard({ mode: "copy", path: target.path })}
        canPaste={Boolean(clipboard)}
        onPaste={() => {
          if (!clipboard) return;
          if (clipboard.mode === "cut") {
            bridgeMoveFsEntry(domicile, isBrowserRuntime, clipboard.path, currentPath);
            setClipboard(null);
          } else {
            copyVfsEntry(clipboard.path, currentPath);
          }
          reloadDir();
        }}
        isFavorite={Boolean(itemMenu && isVfsFavorite(itemMenu.item.path))}
        onToggleFavorite={(target) => {
          toggleVfsFavorite(target.path);
          reloadDir();
        }}
        onRename={(target) => setRenamingId(target.id)}
        onTrash={handleTrashItem}
      />

      {/* Empty Space Context Menu */}
      {bgMenuPortal &&
        (typeof document !== "undefined"
          ? createPortal(bgMenuPortal, document.body)
          : bgMenuPortal)}
    </div>
  );
}
