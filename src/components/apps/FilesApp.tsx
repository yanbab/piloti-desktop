import * as React from "react";
import { createPortal } from "react-dom";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileTextIcon,
  FolderIcon,
  HomeIcon,
  ImageIcon,
  LayoutGridIcon,
  ListIcon,
  Maximize2Icon,
  MinusIcon,
  MonitorIcon,
  MusicIcon,
  SearchIcon,
  Trash2Icon,
  VideoIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { IconGrid } from "@/components/apps/DesktopIconsApp";
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
  getAccentFolderIconUrl,
  getAccentHtmlIconUrl,
} from "@/data/folder-icons";
import { cn } from "@/lib/utils";
import {
  buildVfsEntryWebAppUrl,
  createFsFolder,
  createFsTextFile,
  emptyFsTrash,
  getVfsEntry,
  importExternalFilesToVfs,
  isTextEditableVfsFile,
  listFsDir,
  listVfsDir,
  moveFsEntry,
  normalizeVfsPath,
  renameFsEntry,
  subscribeWebVfs,
  trashFsEntry,
  WEB_VFS_HOME,
  WEB_VFS_TRASH,
  type WebVfsEntry,
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
  { cellWidth: 80, cellHeight: 88, iconSize: 36 },
  { cellWidth: 96, cellHeight: 104, iconSize: 48 },
  { cellWidth: 116, cellHeight: 124, iconSize: 64 },
  { cellWidth: 136, cellHeight: 144, iconSize: 80 },
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
  const sidebarRef = React.useRef<HTMLElement | null>(null);
  const mainViewRef = React.useRef<HTMLDivElement | null>(null);

  const [currentPath, setCurrentPath] = React.useState<string>(() => {
    if (!initialPath) return WEB_VFS_HOME;
    const normalized = normalizeVfsPath(initialPath);
    const existing = getVfsEntry(normalized);
    if (existing?.kind === "file") {
      return existing.parentPath;
    }
    return existing?.kind === "directory" ? normalized : WEB_VFS_HOME;
  });

  const [zoomIndex, setZoomIndex] = React.useState(1);
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

  const reloadDir = React.useCallback(() => {
    if (isBrowserRuntime) {
      setVfsEntries(listVfsDir(currentPath));
      return;
    }
    void listFsDir(domicile, isBrowserRuntime, currentPath).then((entries) => {
      setVfsEntries(entries);
    });
  }, [currentPath, domicile, isBrowserRuntime]);

  React.useEffect(() => {
    if (!windowId || focusedWindowId !== windowId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
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
        setSearchOpen((prev) => {
          const next = !prev;
          if (!next) setSearchQuery("");
          return next;
        });
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

  const breadcrumbSegments = React.useMemo(() => {
    if (currentPath === WEB_VFS_TRASH) {
      return [{ label: _("Trash"), path: WEB_VFS_TRASH }];
    }
    if (currentPath === WEB_VFS_HOME) {
      return [{ label: _("Home"), path: WEB_VFS_HOME }];
    }
    if (currentPath.startsWith(`${WEB_VFS_HOME}/`)) {
      const rel = currentPath.slice(WEB_VFS_HOME.length + 1);
      const parts = rel.split("/").filter(Boolean);
      const segs = [{ label: _("Home"), path: WEB_VFS_HOME }];
      let acc = WEB_VFS_HOME;
      for (const part of parts) {
        acc = `${acc}/${part}`;
        segs.push({ label: part, path: acc });
      }
      return segs;
    }
    const parts = currentPath.split("/").filter(Boolean);
    const segs = [{ label: "/", path: "/" }];
    let acc = "";
    for (const part of parts) {
      acc = `${acc}/${part}`;
      segs.push({ label: part, path: acc });
    }
    return segs;
  }, [currentPath]);

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
    <div className="flex h-full w-full overflow-hidden bg-adw-window text-adw-label select-none">
      {/* Left Places Sidebar (Split Header like Settings) */}
      <aside
        ref={sidebarRef}
        onKeyDown={onSidebarKeyDown}
        onKeyUp={onSidebarKeyUp}
        className="flex w-44 shrink-0 flex-col border-r border-adw-separator bg-adw-sidebar sm:w-48"
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
            <span className="text-[14px] font-bold tracking-tight text-adw-label">
              {_("Files")}
            </span>
            <div className="w-7" />
          </WindowTitlebar>
        )}

        <div
          className={cn(
            "flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2",
            isCsd ? "pt-0.5" : "pt-2"
          )}
        >
          {XDG_PLACES.map((place) => {
            const selected = highlightedPlace === place.path;
            return (
              <button
                key={place.id}
                type="button"
                data-sidebar-item={place.path}
                data-vfs-drop-path={place.path}
                onClick={() => {
                  setCurrentPath(place.path);
                  setSelectedIds([]);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-left text-[13px] transition-colors outline-none",
                  selected
                    ? "bg-adw-sidebar-selection font-medium text-adw-label"
                    : "font-normal text-adw-label/85 hover:bg-black/5 dark:hover:bg-white/6"
                )}
              >
                <span className="flex size-4 shrink-0 items-center justify-center opacity-85">
                  {place.icon}
                </span>
                <span className="truncate">{_(place.label)}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Right Main Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-adw-content">
        <WindowTitlebar
          data-window-drag-region={isCsd ? "" : undefined}
          className={cn(
            "rounded-tl-none border-b border-adw-separator bg-adw-titlebar",
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
              <div
                onClick={() => {
                  setDraftLocation(currentPath);
                  setEditingLocation(true);
                }}
                title="Click or press Ctrl+L to edit location"
                className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-md px-1 py-0.5"
              >
                {breadcrumbSegments.map((seg, idx) => {
                  const isLast = idx === breadcrumbSegments.length - 1;
                  return (
                    <React.Fragment key={seg.path}>
                      {idx > 0 && (
                        <ChevronRightIcon className="size-3.5 shrink-0 text-adw-label-tertiary" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isLast) {
                            setDraftLocation(currentPath);
                            setEditingLocation(true);
                          } else {
                            setCurrentPath(seg.path);
                            setSelectedIds([]);
                          }
                        }}
                        className={cn(
                          "truncate rounded px-1.5 py-0.5 text-[13px] transition-colors hover:bg-black/6 dark:hover:bg-white/8",
                          isLast
                            ? "font-semibold text-adw-label"
                            : "font-medium text-adw-label-secondary hover:text-adw-label"
                        )}
                      >
                        {seg.label}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
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
            {searchOpen && (
              <div className="relative flex items-center">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setSearchOpen(false);
                      setSearchQuery("");
                    }
                  }}
                  placeholder={_("Filter folder…")}
                  aria-label="Filter files"
                  className="h-7 w-36 rounded-md border border-adw-separator bg-black/6 px-2 text-[12px] text-adw-label outline-none focus:border-adw-accent dark:bg-white/10"
                />
              </div>
            )}
            <button
              type="button"
              aria-label={_("Search")}
              title="Search (Ctrl+F)"
              onClick={() =>
                setSearchOpen((prev) => {
                  const next = !prev;
                  if (!next) setSearchQuery("");
                  return next;
                })
              }
              className={cn(
                "flex size-7 items-center justify-center rounded-md transition-colors",
                searchOpen
                  ? "bg-adw-accent/15 text-adw-accent"
                  : "text-adw-label-secondary hover:bg-black/8 hover:text-adw-label dark:hover:bg-white/10"
              )}
            >
              <SearchIcon className="size-4" />
            </button>
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
                        <td className="flex items-center gap-2 px-3 py-2 font-medium">
                          {item.kind === "directory" ? (
                            <img
                              src={getAccentFolderIconUrl(settings.accentColor)}
                              alt=""
                              className="size-4 shrink-0"
                            />
                          ) : /\.(html|htm)$/i.test(item.name) ? (
                            <img
                              src={getAccentHtmlIconUrl(settings.accentColor)}
                              alt=""
                              className="size-4 shrink-0"
                            />
                          ) : (
                            <FileTextIcon className="size-4 shrink-0 text-adw-label-secondary" />
                          )}
                          <span className="truncate">{item.name}</span>
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
        onEditText={(target) =>
          launchApp("text-editor", { payload: target.path })
        }
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
