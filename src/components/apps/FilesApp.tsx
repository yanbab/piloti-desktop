import * as React from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeftIcon,
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
import { useApps, useWindowManager } from "@/context/DesktopStateContext";
import {
  type IconGridItem,
  inferFileVisual,
  sortDesktopItems,
} from "@/lib/desktop-icons";
import { _ } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  buildVfsEntryWebAppUrl,
  createVfsFolder,
  createVfsTextFile,
  emptyVfsTrash,
  getVfsEntry,
  importExternalFilesToVfs,
  isTextEditableVfsFile,
  listVfsDir,
  moveVfsEntry,
  normalizeVfsPath,
  renameVfsEntry,
  subscribeWebVfs,
  trashVfsEntry,
  WEB_VFS_HOME,
  WEB_VFS_TRASH,
  type WebVfsEntry,
} from "@/lib/web-vfs";

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
  const { getAppIconUrl, ensureWaylandIcons } = useApps();
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
  const locationInputRef = React.useRef<HTMLInputElement | null>(null);
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
    setVfsEntries(listVfsDir(currentPath));
  }, [currentPath]);

  React.useEffect(() => {
    if (!windowId || focusedWindowId !== windowId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setDraftLocation(currentPath);
        setEditingLocation(true);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [focusedWindowId, windowId, currentPath]);

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

  const items = React.useMemo(
    () =>
      sortDesktopItems(
        vfsEntries.map((entry) => vfsEntryToGridItem(entry, getAppIconUrl))
      ),
    [getAppIconUrl, vfsEntries]
  );

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
    const created = createVfsFolder(currentPath);
    reloadDir();
    setSelectedIds([created.path]);
    setRenamingId(created.path);
  };

  const handleNewTextFile = () => {
    const created = createVfsTextFile(currentPath);
    reloadDir();
    setSelectedIds([created.path]);
    setRenamingId(created.path);
  };

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
    const renamed = renameVfsEntry(item.path, nextName);
    if (renamed) {
      reloadDir();
      setSelectedIds([renamed.path]);
    }
  };

  const handleTrashItem = (item: IconGridItem) => {
    trashVfsEntry(item.path);
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
        moveVfsEntry(item.path, destPath);
        reloadDir();
        return;
      }
      if ((el as HTMLElement).closest?.("[data-desktop-icons-root]")) {
        const desktopPath = `${WEB_VFS_HOME}/Desktop`;
        if (currentPath !== desktopPath) {
          moveVfsEntry(item.path, desktopPath);
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
      </div>
    </div>
  ) : null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-adw-window text-adw-label select-none">
      {/* Full-width movable CSD Header Bar */}
      <WindowTitlebar
        data-window-drag-region={isCsd ? "" : undefined}
        className={cn(
          "border-b border-adw-separator bg-adw-titlebar",
          !isCsd && "rounded-t-none"
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5" data-window-no-drag>
          {isCsd && windowId && <WindowControls side="left" />}
          <WindowMenuButton
            windowId={windowId}
            appId="nautilus"
            iconName="folder"
          />
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
          <FolderIcon className="size-4 shrink-0 text-adw-label-secondary" />
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
                setDraftLocation(currentPath);
                setEditingLocation(true);
              }}
              className="truncate rounded px-1.5 py-0.5 text-[13.5px] font-semibold hover:bg-black/6 dark:hover:bg-white/8"
            >
              {_(currentTitle)}
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1" data-window-no-drag>
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
          {isTrashView && (
            <Button
              size="sm"
              variant="secondary"
              disabled={items.length === 0}
              onClick={() => {
                emptyVfsTrash();
                reloadDir();
              }}
            >
              {_("Empty Trash")}
            </Button>
          )}

          {/* Zoom Out / Zoom In Icon Buttons (same style as Back) */}
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

      {/* Body: Sidebar + Main Icon View */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Standard Adwaita XDG Places Sidebar */}
        <aside
          ref={sidebarRef}
          onKeyDown={onSidebarKeyDown}
          onKeyUp={onSidebarKeyUp}
          className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-adw-separator bg-adw-sidebar p-2 sm:w-48"
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
        </aside>

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
                        onDoubleClick={() => handleActivateItem(item)}
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
                            <FolderIcon className="size-4 shrink-0 text-blue-400" />
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
              className="[&_button_span]:text-adw-label [&_button_span]:drop-shadow-none"
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
        onEditText={(target) =>
          launchApp("text-editor", { payload: target.path })
        }
        onRename={(target) => setRenamingId(target.id)}
        onNewFolder={isTrashView ? undefined : handleNewFolder}
        onNewTextFile={isTrashView ? undefined : handleNewTextFile}
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
