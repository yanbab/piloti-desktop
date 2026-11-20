import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { FileType } from "@domicile-desktop/sdk/system";
import {
  FileItemContextMenu,
  type FileItemContextMenuState,
} from "@/components/apps/FileItemContextMenu";
import {
  useApps,
  useSettings,
  useSystemBackends,
  useWindowManager,
} from "@/context/DesktopStateContext";
import {
  assignGridPositions,
  clientPointToGridCell,
  computeGridMetrics,
  coordKey,
  findClosestFreeCell,
  type GridCoord,
  type GridMetrics,
  type IconGridItem,
  inferFileVisual,
  moveItemsToCells,
  sortDesktopItems,
} from "@/lib/desktop-icons";
import { launchDesktopCommand } from "@/lib/gnome-bridge";
import { _ } from "@/lib/i18n";
import { startBootPhase } from "@/lib/perf-log";
import { parseDesktopEntry } from "@/lib/xdg-desktop-entry";
import {
  buildVfsEntryWebAppUrl,
  copyVfsEntry,
  createVfsFolder,
  createVfsTextFile,
  duplicateVfsEntry,
  getVfsClipboard,
  getVfsEmblems,
  getVfsEntry,
  importExternalFilesToVfs,
  isImageVfsFile,
  isTextEditableVfsFile,
  listVfsDir,
  moveVfsEntry,
  renameVfsEntry,
  setVfsClipboard,
  subscribeVfsClipboard,
  subscribeWebVfs,
  toggleVfsEmblem,
  trashVfsEntry,
  WEB_VFS_HOME,
  WEB_VFS_TRASH,
} from "@/lib/web-vfs";

import { IconGrid, type IconGridProps } from "@/components/ui/icon-grid";
export { IconGrid, type IconGridProps };

/**
 * Transparent Desktop Icons app mounted over the desktop wallpaper (below windows).
 * Reads the user's XDG Desktop folder (`$HOME/Desktop`) and persists grid coordinates.
 */
export function DesktopIconsApp({
  bottomInset = 0,
}: {
  bottomInset?: number;
}) {
  const domicile = useDomicile();
  const { isBrowserRuntime, settings, updateSettings } = useSettings();
  const { locked } = useSystemBackends();
  const {
    xdgUserDirs,
    installedXdgApps,
    dockIconsReady,
    getAppIconUrl,
    ensureWaylandIcons,
    launchXdgEntry,
  } = useApps();
  const { launchApp, openWebUrl } = useWindowManager();

  const [items, setItems] = React.useState<IconGridItem[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [externalDropActive, setExternalDropActive] = React.useState(false);
  const [clipboard, setLocalClipboard] = React.useState(() =>
    getVfsClipboard()
  );
  const [contextMenu, setContextMenu] =
    React.useState<FileItemContextMenuState | null>(null);
  const initialDesktopLoadLoggedRef = React.useRef(false);

  React.useEffect(() => {
    return subscribeVfsClipboard(() => {
      setLocalClipboard(getVfsClipboard());
    });
  }, []);

  const desktopDirPath = React.useMemo(() => {
    if (isBrowserRuntime) return `${WEB_VFS_HOME}/Desktop`;
    const dir = xdgUserDirs.find((d) => d.key === "DESKTOP");
    return dir?.absolutePath ?? dir?.relativeHomePath ?? "Desktop";
  }, [isBrowserRuntime, xdgUserDirs]);

  const loadDesktopFolder = React.useCallback(async () => {
    if (!settings.desktopIconsEnabled) return;
    const finishDesktopIcons = !initialDesktopLoadLoggedRef.current
      ? startBootPhase("desktop icons")
      : null;
    try {
      if (isBrowserRuntime) {
        const vfsEntries = listVfsDir(desktopDirPath);
        const iconCandidatesToEnsure = new Set<string>();
        const built: IconGridItem[] = vfsEntries.map((entry) => {
          const visual = inferFileVisual(entry.name, entry.kind);
          for (const candidate of visual.iconCandidates) {
            iconCandidatesToEnsure.add(candidate);
          }
          return {
            id: entry.name,
            name: entry.name,
            kind: entry.kind,
            path: entry.path,
            iconName: visual.iconName,
            iconCandidates: visual.iconCandidates,
            gradient: visual.gradient,
            iconUrl: visual.iconCandidates
              .map((c) => getAppIconUrl(c))
              .find(Boolean),
          };
        });
        if (iconCandidatesToEnsure.size > 0) {
          ensureWaylandIcons(Array.from(iconCandidatesToEnsure));
        }
        setItems(sortDesktopItems(built));
        if (finishDesktopIcons) {
          initialDesktopLoadLoggedRef.current = true;
          finishDesktopIcons(`${built.length} items`);
        }
        return;
      }

      const res = await domicile.files.readDir(desktopDirPath);
      const entries = res.match({
        Ok: (list) => list,
        Err: () => [],
      });

      const visible = entries.filter(
        (entry) => entry.name && !entry.name.startsWith(".")
      );

      const iconCandidatesToEnsure = new Set<string>();
      const built: IconGridItem[] = await Promise.all(
        visible.map(async (entry): Promise<IconGridItem> => {
          const fullPath = `${desktopDirPath.replace(/\/+$/, "")}/${entry.name}`;
          const entryFileType: "file" | "directory" =
            entry.fileType === FileType.Directory ? "directory" : "file";

          if (entryFileType === "file" && entry.name.endsWith(".desktop")) {
            try {
              const textRes = await domicile.files.readText(fullPath);
              const content = textRes.match({
                Ok: (t) => t,
                Err: () => "",
              });
              if (content) {
                const parsed = parseDesktopEntry(content, {
                  filePath: fullPath,
                  baseDir: desktopDirPath,
                });
                if (parsed) {
                  if (parsed.icon) iconCandidatesToEnsure.add(parsed.icon);
                  const matchedXdg = installedXdgApps.find(
                    (app) =>
                      app.desktopId === parsed.desktopId ||
                      app.appId === parsed.appId
                  );
                  return {
                    id: entry.name,
                    name: parsed.name,
                    kind: "desktop-entry",
                    path: fullPath,
                    iconName: "sparkles",
                    iconCandidates: parsed.icon ? [parsed.icon] : undefined,
                    iconUrl:
                      matchedXdg?.iconUrl ??
                      getAppIconUrl(parsed.icon) ??
                      getAppIconUrl(parsed.desktopId) ??
                      getAppIconUrl(parsed.appId),
                    desktopEntry: parsed,
                  };
                }
              }
            } catch {
              // fallback to generic file entry below
            }
          }

          const visual = inferFileVisual(entry.name, entryFileType);
          for (const candidate of visual.iconCandidates) {
            iconCandidatesToEnsure.add(candidate);
          }

          return {
            id: entry.name,
            name: entry.name,
            kind: entryFileType === "directory" ? "directory" : "file",
            path: fullPath,
            iconName: visual.iconName,
            iconCandidates: visual.iconCandidates,
            gradient: visual.gradient,
            iconUrl: visual.iconCandidates
              .map((c) => getAppIconUrl(c))
              .find(Boolean),
          };
        })
      );

      if (iconCandidatesToEnsure.size > 0) {
        ensureWaylandIcons(Array.from(iconCandidatesToEnsure));
      }

      setItems(sortDesktopItems(built));
      if (finishDesktopIcons) {
        initialDesktopLoadLoggedRef.current = true;
        finishDesktopIcons(`${built.length} items`);
      }
    } catch {
      setItems([]);
      if (finishDesktopIcons) {
        initialDesktopLoadLoggedRef.current = true;
        finishDesktopIcons("0 items");
      }
    }
  }, [
    desktopDirPath,
    domicile.files,
    ensureWaylandIcons,
    getAppIconUrl,
    installedXdgApps,
    isBrowserRuntime,
    settings.desktopIconsEnabled,
  ]);

  React.useEffect(() => {
    if (!settings.desktopIconsEnabled || !dockIconsReady) return;
    void loadDesktopFolder();
    if (isBrowserRuntime) {
      return subscribeWebVfs(() => {
        void loadDesktopFolder();
      });
    }
    const timer = window.setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      if (!locked) {
        void loadDesktopFolder();
      }
    }, 6000);
    const onFocus = () => {
      void loadDesktopFolder();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [
    dockIconsReady,
    isBrowserRuntime,
    loadDesktopFolder,
    locked,
    settings.desktopIconsEnabled,
  ]);

  const createDesktopFolder = React.useCallback(async () => {
    if (isBrowserRuntime) {
      const created = createVfsFolder(desktopDirPath);
      await loadDesktopFolder();
      setSelectedIds([created.name]);
      setRenamingId(created.name);
      return;
    }
    const existingNames = new Set(items.map((i) => i.name));
    let folderName = "Untitled Folder";
    let n = 2;
    while (existingNames.has(folderName)) {
      folderName = `Untitled Folder ${n++}`;
    }
    const fullPath = `${desktopDirPath.replace(/\/+$/, "")}/${folderName}`;
    await domicile.files.createDir(fullPath).catch(() => undefined);
    await loadDesktopFolder();
    setSelectedIds([folderName]);
    setRenamingId(folderName);
  }, [desktopDirPath, domicile.files, isBrowserRuntime, items, loadDesktopFolder]);

  const createDesktopTextFile = React.useCallback(async () => {
    if (isBrowserRuntime) {
      const created = createVfsTextFile(desktopDirPath);
      await loadDesktopFolder();
      setSelectedIds([created.name]);
      setRenamingId(created.name);
      return;
    }
    const existingNames = new Set(items.map((i) => i.name));
    let fileName = "Untitled.txt";
    let n = 2;
    while (existingNames.has(fileName)) {
      fileName = `Untitled ${n++}.txt`;
    }
    const fullPath = `${desktopDirPath.replace(/\/+$/, "")}/${fileName}`;
    await domicile.files.write(fullPath, "").catch(() => undefined);
    await loadDesktopFolder();
    setSelectedIds([fileName]);
    setRenamingId(fileName);
  }, [desktopDirPath, domicile.files, isBrowserRuntime, items, loadDesktopFolder]);

  // Listen for "New Folder", "New Text File", and "Arrange Icons" triggered from Desktop menus
  React.useEffect(() => {
    const onNewFolder = () => void createDesktopFolder();
    const onNewFile = () => void createDesktopTextFile();
    const onAlignIcons = () => updateSettings({ desktopIconPositions: {} });
    window.addEventListener("piloti:desktop-new-folder", onNewFolder);
    window.addEventListener("piloti:desktop-new-file", onNewFile);
    window.addEventListener("piloti:desktop-align-icons", onAlignIcons);
    return () => {
      window.removeEventListener("piloti:desktop-new-folder", onNewFolder);
      window.removeEventListener("piloti:desktop-new-file", onNewFile);
      window.removeEventListener("piloti:desktop-align-icons", onAlignIcons);
    };
  }, [createDesktopFolder, createDesktopTextFile, updateSettings]);

  const handleCommitRename = React.useCallback(
    async (item: IconGridItem, rawNextName: string) => {
      setRenamingId(null);
      const nextName = rawNextName.trim().replace(/[/\\]/g, "");
      if (!nextName || nextName === item.name) return;

      const nextPath = `${desktopDirPath.replace(/\/+$/, "")}/${nextName}`;
      if (!isBrowserRuntime) {
        await domicile.processes
          .run(["mv", "-n", "--", item.path, nextPath])
          .catch(() => undefined);
        await loadDesktopFolder();
      } else {
        const renamed = renameVfsEntry(item.path, nextName);
        if (!renamed) return;
        await loadDesktopFolder();
      }

      if (settings.desktopIconPositions[item.id]) {
        const nextPositions = { ...settings.desktopIconPositions };
        nextPositions[nextName] = nextPositions[item.id];
        delete nextPositions[item.id];
        updateSettings({ desktopIconPositions: nextPositions });
      }
      setSelectedIds([nextName]);
    },
    [
      desktopDirPath,
      domicile.processes,
      isBrowserRuntime,
      loadDesktopFolder,
      settings.desktopIconPositions,
      updateSettings,
    ]
  );

  const handleMoveToTrash = React.useCallback(
    async (item: IconGridItem) => {
      setContextMenu(null);
      if (!isBrowserRuntime) {
        await domicile.processes
          .run([
            "sh",
            "-c",
            'if command -v gio >/dev/null 2>&1; then gio trash "$1"; else mkdir -p "$HOME/.local/share/Trash/files" "$HOME/.local/share/Trash/info" && base=$(basename "$1") && mv -f "$1" "$HOME/.local/share/Trash/files/$base"; fi',
            "sh",
            item.path,
          ])
          .catch(() => undefined);
        await loadDesktopFolder();
      } else {
        trashVfsEntry(item.path);
        await loadDesktopFolder();
      }
      setSelectedIds((prev) => prev.filter((id) => id !== item.id));
    },
    [domicile.processes, isBrowserRuntime, loadDesktopFolder]
  );

  // Re-attach resolved XDG icon URLs once asynchronous icon loading completes
  const enrichedItems = React.useMemo(
    () =>
      items.map((item) => {
        if (item.iconUrl || !item.iconCandidates) return item;
        const resolved = item.iconCandidates
          .map((c) => getAppIconUrl(c))
          .find(Boolean);
        return resolved ? { ...item, iconUrl: resolved } : item;
      }),
    [getAppIconUrl, items]
  );

  const rootRef = React.useRef<HTMLDivElement | null>(null);

  const assignDroppedNamesNearCursor = React.useCallback(
    (names: readonly string[], clientX: number, clientY: number) => {
      const rootEl = rootRef.current;
      if (!rootEl || names.length === 0) return;
      const rect = rootEl.getBoundingClientRect();
      const metrics = computeGridMetrics(rect.width, rect.height);
      const targetCell = clientPointToGridCell(
        clientX - rect.left,
        clientY - rect.top,
        metrics
      );
      const currentAssigned = assignGridPositions(
        enrichedItems,
        settings.desktopIconPositions,
        metrics.cols,
        metrics.rows,
        settings.desktopIconAlign ?? "left"
      );
      const occupied = new Set<string>();
      for (const pos of Object.values(currentAssigned)) {
        if (pos) occupied.add(coordKey(pos));
      }
      const nextPositions: Record<string, GridCoord> = {
        ...settings.desktopIconPositions,
      };
      for (const name of names) {
        const dropId = `${desktopDirPath}/${name}`;
        const cell = findClosestFreeCell(
          occupied,
          targetCell,
          metrics.cols,
          metrics.rows
        );
        nextPositions[dropId] = cell;
        occupied.add(coordKey(cell));
      }
      updateSettings({ desktopIconPositions: nextPositions });
    },
    [
      desktopDirPath,
      enrichedItems,
      settings.desktopIconAlign,
      settings.desktopIconPositions,
      updateSettings,
    ]
  );

  React.useEffect(() => {
    const onDesktopDropPosition = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          destPath?: string;
          names?: string[];
          clientX?: number;
          clientY?: number;
        }>
      ).detail;
      if (
        !detail ||
        detail.destPath !== desktopDirPath ||
        !detail.names?.length ||
        typeof detail.clientX !== "number" ||
        typeof detail.clientY !== "number"
      ) {
        return;
      }
      assignDroppedNamesNearCursor(
        detail.names,
        detail.clientX,
        detail.clientY
      );
    };
    window.addEventListener(
      "residence:desktop-drop-position",
      onDesktopDropPosition
    );
    return () =>
      window.removeEventListener(
        "residence:desktop-drop-position",
        onDesktopDropPosition
      );
  }, [assignDroppedNamesNearCursor, desktopDirPath]);

  const handleMoveItems = React.useCallback(
    (
      itemIds: string[],
      primaryId: string,
      cell: GridCoord,
      metrics: GridMetrics
    ) => {
      const currentAssigned = assignGridPositions(
        enrichedItems,
        settings.desktopIconPositions,
        metrics.cols,
        metrics.rows,
        settings.desktopIconAlign ?? "left"
      );
      const nextPositions = moveItemsToCells(
        currentAssigned,
        itemIds,
        primaryId,
        cell,
        metrics.cols,
        metrics.rows
      );
      updateSettings({ desktopIconPositions: nextPositions });
    },
    [
      enrichedItems,
      settings.desktopIconAlign,
      settings.desktopIconPositions,
      updateSettings,
    ]
  );

  const handleActivateItem = React.useCallback(
    (item: IconGridItem) => {
      if (item.kind === "desktop-entry" && item.desktopEntry) {
        const lower = `${item.desktopEntry.desktopId} ${item.desktopEntry.exec}`.toLowerCase();
        if (isBrowserRuntime) {
          if (lower.includes("nautilus")) {
            launchApp("nautilus");
            return;
          }
          if (lower.includes("settings") || lower.includes("control-center")) {
            launchApp("settings");
            return;
          }
        }
        launchXdgEntry(item.desktopEntry);
        return;
      }

      if (item.kind === "directory") {
        if (isBrowserRuntime) {
          launchApp("nautilus", { payload: item.path, forceNew: true });
          return;
        }
        launchDesktopCommand(domicile, ["nautilus", item.path]);
        return;
      }

      if (isBrowserRuntime) {
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
        return;
      }
      launchDesktopCommand(domicile, ["xdg-open", item.path]);
    },
    [domicile, isBrowserRuntime, launchApp, launchXdgEntry, openWebUrl]
  );

  const handlePasteToDesktop = React.useCallback(async () => {
    const clip = getVfsClipboard();
    if (!clip || clip.paths.length === 0 || !isBrowserRuntime) return;
    for (const srcPath of clip.paths) {
      if (clip.mode === "cut") {
        moveVfsEntry(srcPath, desktopDirPath);
      } else {
        copyVfsEntry(srcPath, desktopDirPath);
      }
    }
    if (clip.mode === "cut") {
      setVfsClipboard(null);
    }
    await loadDesktopFolder();
  }, [desktopDirPath, isBrowserRuntime, loadDesktopFolder]);

  const handleDuplicateItems = React.useCallback(
    async (list: IconGridItem[]) => {
      if (!isBrowserRuntime) return;
      const createdNames: string[] = [];
      for (const item of list) {
        const dup = duplicateVfsEntry(item.path);
        if (dup) createdNames.push(dup.name);
      }
      await loadDesktopFolder();
      if (createdNames.length > 0) {
        setSelectedIds(createdNames);
      }
    },
    [isBrowserRuntime, loadDesktopFolder]
  );

  const handleMoveItemsToTrash = React.useCallback(
    async (list: IconGridItem[]) => {
      for (const item of list) {
        await handleMoveToTrash(item);
      }
    },
    [handleMoveToTrash]
  );

  const handleDropDesktopItems = React.useCallback(
    async (droppedItems: IconGridItem[], destPath: string) => {
      if (destPath === WEB_VFS_TRASH) {
        await handleMoveItemsToTrash(droppedItems);
        return;
      }
      if (!isBrowserRuntime) return;
      const movedIds = new Set<string>();
      for (const item of droppedItems) {
        if (item.path === destPath || destPath.startsWith(`${item.path}/`)) {
          continue;
        }
        moveVfsEntry(item.path, destPath);
        movedIds.add(item.id);
      }
      if (movedIds.size > 0) {
        await loadDesktopFolder();
        setSelectedIds((prev) => prev.filter((id) => !movedIds.has(id)));
      }
    },
    [handleMoveItemsToTrash, isBrowserRuntime, loadDesktopFolder]
  );

  if (!settings.desktopIconsEnabled) return null;

  const selectedItems = enrichedItems.filter((i) => selectedIds.includes(i.id));

  return (
    <div
      ref={rootRef}
      data-desktop-icons-root
      data-vfs-drop-path={desktopDirPath}
      style={{ bottom: `${bottomInset}px` }}
      className="pointer-events-auto absolute inset-x-0 top-0 z-0"
      onKeyDown={(e) => {
        if (renamingId || e.target instanceof HTMLInputElement) return;
        const mod = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();
        if (mod && key === "c" && selectedItems.length > 0) {
          e.preventDefault();
          setVfsClipboard({
            mode: "copy",
            paths: selectedItems.map((i) => i.path),
          });
        } else if (mod && key === "x" && selectedItems.length > 0) {
          e.preventDefault();
          setVfsClipboard({
            mode: "cut",
            paths: selectedItems.map((i) => i.path),
          });
        } else if (mod && key === "v") {
          e.preventDefault();
          void handlePasteToDesktop();
        } else if (mod && key === "d" && selectedItems.length > 0) {
          e.preventDefault();
          void handleDuplicateItems(selectedItems);
        } else if (e.key === "F2" && selectedIds.length === 1) {
          e.preventDefault();
          setRenamingId(selectedIds[0]);
        } else if (
          (e.key === "Delete" || e.key === "Backspace") &&
          selectedItems.length > 0
        ) {
          e.preventDefault();
          void handleMoveItemsToTrash(selectedItems);
        }
      }}
      onDragOver={(e) => {
        if (!isBrowserRuntime || !e.dataTransfer?.types?.includes("Files")) {
          return;
        }
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
        if (!isBrowserRuntime || !e.dataTransfer?.files?.length) return;
        e.preventDefault();
        setExternalDropActive(false);
        const names = Array.from(e.dataTransfer.files).map((f) => f.name);
        assignDroppedNamesNearCursor(names, e.clientX, e.clientY);
        void importExternalFilesToVfs(desktopDirPath, e.dataTransfer.files);
      }}
    >
      <IconGrid
        items={enrichedItems}
        mode="spatial"
        align={settings.desktopIconAlign ?? "left"}
        currentDirPath={desktopDirPath}
        positions={settings.desktopIconPositions}
        onMoveItems={handleMoveItems}
        onDropItems={(dropped, destPath) =>
          void handleDropDesktopItems(dropped, destPath)
        }
        onActivateItem={handleActivateItem}
        onContextMenuItem={(item, e) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({ item, x: e.clientX, y: e.clientY });
        }}
        renamingId={renamingId}
        onCommitRename={(item, nextName) =>
          void handleCommitRename(item, nextName)
        }
        onCancelRename={() => setRenamingId(null)}
        selectedIds={selectedIds}
        onSelectIds={setSelectedIds}
        ariaLabel="Desktop Icons"
      />

      {externalDropActive && (
        <div className="pointer-events-none absolute inset-3 z-30 flex items-end justify-center rounded-xl border-2 border-dashed border-adw-accent/70 bg-adw-accent/10 pb-4">
          <span className="rounded-full bg-zinc-900/90 px-3 py-1 text-xs font-medium text-white shadow-sm ring-1 ring-white/10">
            {_("Drop files to copy to Desktop")}
          </span>
        </div>
      )}

      <FileItemContextMenu
        menu={contextMenu}
        context="desktop"
        selectedItems={selectedItems}
        onClose={() => setContextMenu(null)}
        onOpen={handleActivateItem}
        onOpenWithApp={(target, appId) => {
          launchApp(appId, { payload: target.path, forceNew: true });
        }}
        onOpenInNewWindow={(target) =>
          launchApp("nautilus", { payload: target.path, forceNew: true })
        }
        onOpenInTerminal={(target) =>
          launchApp("terminal", { payload: target.path, forceNew: true })
        }
        onCutItems={(list) =>
          setVfsClipboard({ mode: "cut", paths: list.map((i) => i.path) })
        }
        onCopyItems={(list) =>
          setVfsClipboard({ mode: "copy", paths: list.map((i) => i.path) })
        }
        onDuplicate={(list) => void handleDuplicateItems(list)}
        canPaste={Boolean(clipboard && clipboard.paths.length > 0)}
        onPaste={() => void handlePasteToDesktop()}
        activeEmblems={contextMenu ? getVfsEmblems(contextMenu.item.path) : []}
        onToggleEmblem={(list, emblem) => {
          for (const target of list) {
            toggleVfsEmblem(target.path, emblem);
          }
          void loadDesktopFolder();
        }}
        onRename={(target) => setRenamingId(target.id)}
        onNewFolder={() => void createDesktopFolder()}
        onNewTextFile={() => void createDesktopTextFile()}
        onTrash={(target) => void handleMoveToTrash(target)}
        onTrashItems={(list) => void handleMoveItemsToTrash(list)}
      />
    </div>
  );
}
