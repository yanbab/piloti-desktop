import * as React from "react";
import { useOpenPath } from "@/hooks/use-open-path";
import { copyFsEntry, moveFsEntry } from "@/lib/engine/fs-bridge";
import {
  moveWithUndo,
  onFileUndoApplied,
  recordCreated,
  redoFileOperation,
  trashWithUndo,
  undoFileOperation,
} from "@/lib/engine/fs-undo";
import { watchNativeDir } from "@/lib/engine-native/file-watch";
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
  useWindowActions,
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
  moveItemsInSpatialGrid,
  sortDesktopItems,
} from "@/lib/shell/desktop-icons";
import { launchDesktopCommand } from "@/lib/engine-native";
import { _ } from "@/lib/core/i18n";
import { startBootPhase } from "@/lib/core/perf-log";
import { parseDesktopEntry } from "@/lib/xdg/xdg-desktop-entry";
import {
  buildVfsEntryWebAppUrl,
  createVfsFileFromTemplate,
  createVfsFolder,
  createVfsTextFile,
  duplicateVfsEntry,
  getVfsClipboard,
  getVfsContentType,
  getVfsEntry,
  importExternalFilesToVfs,
  incrementVfsAccessCount,
  isImageVfsFile,
  isTextEditableVfsFile,
  listVfsDir,
  normalizeVfsPath,
  parseDotHiddenFile,
  renameVfsEntry,
  setVfsClipboard,
  subscribeVfsClipboard,
  subscribeVfsRenamed,
  subscribeWebVfs,
  toggleVfsEmblem,
  trashVfsEntry,
  WEB_VFS_HOME,
  WEB_VFS_TRASH,
  type WebVfsEntry,
  compressVfsEntries,
  downloadVfsFile,
  extractVfsZip,
} from "@/lib/engine-web/web-vfs";

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
  const { launchApp, openWebUrl } = useWindowActions();
  const { openPath, openPathWith } = useOpenPath();

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
          const isEmpty =
            entry.kind === "file" &&
            (typeof entry.size === "number"
              ? entry.size === 0
              : !entry.content || entry.content.length === 0);
          const visual = inferFileVisual(
            entry.name,
            entry.kind,
            getVfsContentType(entry),
            { isEmpty }
          );
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
            isEmpty,
            isSymlink: entry.isSymlink,
            symlinkTarget: entry.symlinkTarget,
            accessCount:
              entry.kind === "file" ? (entry.accessCount ?? 0) : undefined,
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

      let hiddenNames = new Set<string>();
      if (entries.some((e) => e.name === ".hidden")) {
        try {
          const dotHiddenRes = await domicile.files.readText(
            `${desktopDirPath.replace(/\/+$/, "")}/.hidden`
          );
          dotHiddenRes.match({
            Ok: (t) => {
              hiddenNames = parseDotHiddenFile(t);
            },
            Err: () => {},
          });
        } catch {
          // ignore .hidden read failure
        }
      }

      const visible = entries.filter(
        (entry) =>
          entry.name &&
          !entry.name.startsWith(".") &&
          !hiddenNames.has(entry.name)
      );

      const iconCandidatesToEnsure = new Set<string>();
      const built: IconGridItem[] = await Promise.all(
        visible.map(async (entry): Promise<IconGridItem> => {
          const fullPath = `${desktopDirPath.replace(/\/+$/, "")}/${entry.name}`;
          const isSymlink = entry.fileType === FileType.Symlink;
          let entryFileType: "file" | "directory" =
            entry.fileType === FileType.Directory ? "directory" : "file";
          if (isSymlink && typeof domicile.files.stat === "function") {
            // Follow the link to know whether it points at a folder.
            const linkStat = await domicile.files.stat(fullPath).catch(() => undefined);
            if (linkStat?.match({ Ok: (st) => st.fileType === FileType.Directory, Err: () => false })) {
              entryFileType = "directory";
            }
          }

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

          let isEmpty = false;
          if (entryFileType === "file" && typeof domicile.files.stat === "function") {
            try {
              const statRes = await domicile.files.stat(fullPath);
              statRes.match({
                Ok: (st) => {
                  isEmpty = st.size === 0;
                },
                Err: () => { },
              });
            } catch {
              // ignore stat failure
            }
          }
          const visual = inferFileVisual(entry.name, entryFileType, undefined, {
            isEmpty,
          });
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
            isEmpty,
            isSymlink: isSymlink || undefined,
            accessCount:
              entryFileType === "file"
                ? (getVfsEntry(fullPath)?.accessCount ?? 0)
                : undefined,
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

  React.useEffect(() => onFileUndoApplied(() => void loadDesktopFolder()), [loadDesktopFolder]);

  React.useEffect(() => {
    if (!settings.desktopIconsEnabled || !dockIconsReady) return;
    void loadDesktopFolder();
    if (isBrowserRuntime) {
      const unsubVfs = subscribeWebVfs(
        () => {
          void loadDesktopFolder();
        },
        { path: desktopDirPath, mode: "children" },
      );
      const unsubRenamed = subscribeVfsRenamed(({ oldPath, newPath }) => {
        const prefix = `${desktopDirPath.replace(/\/+$/, "")}/`;
        if (!oldPath.startsWith(prefix) || !newPath.startsWith(prefix)) return;
        const oldName = oldPath.slice(prefix.length);
        const newName = newPath.slice(prefix.length);
        if (!oldName || !newName || oldName === newName) return;
        if (
          settings.desktopIconPositions[oldName] &&
          !settings.desktopIconPositions[newName]
        ) {
          const nextPositions = { ...settings.desktopIconPositions };
          nextPositions[newName] = nextPositions[oldName];
          delete nextPositions[oldName];
          updateSettings({ desktopIconPositions: nextPositions });
        }
        void loadDesktopFolder();
      });
      return () => {
        unsubVfs();
        unsubRenamed();
      };
    }
    // inotify via Domicile instead of polling every 6 s (polls only as fallback).
    const stopWatch = watchNativeDir(domicile.files, desktopDirPath, () => {
      if (!locked) void loadDesktopFolder();
    });
    const onFocus = () => {
      void loadDesktopFolder();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      stopWatch();
      window.removeEventListener("focus", onFocus);
    };
  }, [
    desktopDirPath,
    domicile.files,
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

  const createDesktopFromTemplate = React.useCallback(
    async (template: WebVfsEntry) => {
      if (isBrowserRuntime) {
        const created =
          createVfsFileFromTemplate(desktopDirPath, template.path) ??
          createVfsTextFile(desktopDirPath, template.name, template.content ?? "");
        await loadDesktopFolder();
        setSelectedIds([created.name]);
        setRenamingId(created.name);
        return;
      }
      const existingNames = new Set(items.map((i) => i.name));
      const hasExt = /\.[a-z0-9]+$/i.test(template.name);
      const stem = hasExt
        ? template.name.replace(/\.[a-z0-9]+$/i, "")
        : template.name;
      const ext = hasExt ? template.name.slice(stem.length) : "";
      let fileName = `${stem}${ext}`;
      let n = 2;
      while (existingNames.has(fileName)) {
        fileName = `${stem} ${n++}${ext}`;
      }
      let content = template.content ?? "";
      if (!content && template.path) {
        const res = await domicile.files.readText(
          template.path.startsWith(`${WEB_VFS_HOME}/`)
            ? template.path.slice(WEB_VFS_HOME.length + 1)
            : template.path
        );
        res.match({
          Ok: (t) => {
            content = t;
          },
          Err: () => {},
        });
      }
      const fullPath = `${desktopDirPath.replace(/\/+$/, "")}/${fileName}`;
      await domicile.files.write(fullPath, content).catch(() => undefined);
      await loadDesktopFolder();
      setSelectedIds([fileName]);
      setRenamingId(fileName);
    },
    [desktopDirPath, domicile.files, isBrowserRuntime, items, loadDesktopFolder]
  );

  // Listen for "New Folder", "New Text File", "New from Template", and "Arrange Icons" triggered from Desktop menus
  React.useEffect(() => {
    const onNewFolder = () => void createDesktopFolder();
    const onNewFile = () => void createDesktopTextFile();
    const onNewFromTemplate = (e: Event) => {
      const tmpl = (e as CustomEvent<WebVfsEntry | undefined>).detail;
      if (tmpl) void createDesktopFromTemplate(tmpl);
    };
    const onAlignIcons = () => updateSettings({ desktopIconPositions: {} });
    window.addEventListener("piloti:desktop-new-folder", onNewFolder);
    window.addEventListener("piloti:desktop-new-file", onNewFile);
    window.addEventListener("piloti:desktop-new-from-template", onNewFromTemplate);
    window.addEventListener("piloti:desktop-align-icons", onAlignIcons);
    return () => {
      window.removeEventListener("piloti:desktop-new-folder", onNewFolder);
      window.removeEventListener("piloti:desktop-new-file", onNewFile);
      window.removeEventListener(
        "piloti:desktop-new-from-template",
        onNewFromTemplate
      );
      window.removeEventListener("piloti:desktop-align-icons", onAlignIcons);
    };
  }, [
    createDesktopFolder,
    createDesktopFromTemplate,
    createDesktopTextFile,
    updateSettings,
  ]);

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
      trashWithUndo({ domicile, isBrowserRuntime }, [item.path]);
      await loadDesktopFolder();
      setSelectedIds((prev) => prev.filter((id) => id !== item.id));
    },
    [domicile, isBrowserRuntime, loadDesktopFolder]
  );

  // Re-attach resolved XDG icon URLs once asynchronous icon loading completes
  const enrichedItems = React.useMemo(
    () =>
      items.map((item) => {
        if (!item.iconCandidates) return item;
        const resolved = item.iconCandidates
          .map((c) => getAppIconUrl(c))
          .find(Boolean);
        return resolved && resolved !== item.iconUrl
          ? { ...item, iconUrl: resolved }
          : item;
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
      updateSettings({
        desktopIconPositions: moveItemsInSpatialGrid(
          enrichedItems,
          settings.desktopIconPositions,
          itemIds,
          primaryId,
          cell,
          metrics,
          settings.desktopIconAlign ?? "left"
        ),
      });
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

      void openPath(item.path, {
        kind: item.kind === "directory" ? "directory" : "file",
        name: item.name,
        onExtracted: () => void loadDesktopFolder(),
      });
    },
    [isBrowserRuntime, launchApp, launchXdgEntry, loadDesktopFolder, openPath]
  );

  // Paste and Open in Terminal from the shell's desktop menu.
  React.useEffect(() => {
    const onPaste = () => void handlePasteToDesktopRef.current();
    const onOpenTerminal = () =>
      launchApp("terminal", { payload: desktopDirPath, forceNew: true });
    window.addEventListener("piloti:desktop-paste", onPaste);
    window.addEventListener("piloti:desktop-open-terminal", onOpenTerminal);
    return () => {
      window.removeEventListener("piloti:desktop-paste", onPaste);
      window.removeEventListener("piloti:desktop-open-terminal", onOpenTerminal);
    };
  }, [desktopDirPath, launchApp]);

  const handlePasteToDesktop = React.useCallback(async () => {
    const clip = getVfsClipboard();
    if (!clip || clip.paths.length === 0) return;
    const ctx = { domicile, isBrowserRuntime };
    if (clip.mode === "cut") {
      moveWithUndo(ctx, clip.paths, desktopDirPath);
    } else {
      const created: string[] = [];
      for (const srcPath of clip.paths) {
        const path = await copyFsEntry(domicile, isBrowserRuntime, srcPath, desktopDirPath);
        if (path) created.push(path);
      }
      recordCreated(ctx, created, "Paste");
    }
    if (clip.mode === "cut") {
      setVfsClipboard(null);
    }
    await loadDesktopFolder();
  }, [desktopDirPath, domicile, isBrowserRuntime, loadDesktopFolder]);
  const handlePasteToDesktopRef = React.useRef(handlePasteToDesktop);
  handlePasteToDesktopRef.current = handlePasteToDesktop;

  const handleDuplicateItems = React.useCallback(
    async (list: IconGridItem[]) => {
      const createdPaths: string[] = [];
      for (const item of list) {
        const dot = item.name.lastIndexOf(".");
        const name =
          dot > 0 && item.kind !== "directory"
            ? `${item.name.slice(0, dot)} Copy${item.name.slice(dot)}`
            : `${item.name} Copy`;
        const path = await copyFsEntry(domicile, isBrowserRuntime, item.path, desktopDirPath, { name });
        if (path) createdPaths.push(path);
      }
      recordCreated({ domicile, isBrowserRuntime }, createdPaths, "Duplicate");
      await loadDesktopFolder();
      if (createdPaths.length > 0) {
        setSelectedIds(createdPaths.map((p) => p.split("/").pop() ?? p));
      }
    },
    [desktopDirPath, domicile, isBrowserRuntime, loadDesktopFolder]
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
    async (droppedItems: IconGridItem[], destPath: string, opts?: { copy?: boolean }) => {
      if (destPath === WEB_VFS_TRASH) {
        await handleMoveItemsToTrash(droppedItems);
        return;
      }
      if (opts?.copy) {
        const created: string[] = [];
        for (const item of droppedItems) {
          const path = await copyFsEntry(domicile, isBrowserRuntime, item.path, destPath);
          if (path) created.push(path);
        }
        recordCreated({ domicile, isBrowserRuntime }, created, "Copy");
        await loadDesktopFolder();
        return;
      }
      const movedIds = new Set<string>();
      const toMove: string[] = [];
      for (const item of droppedItems) {
        if (item.path === destPath || destPath.startsWith(`${item.path}/`)) {
          continue;
        }
        toMove.push(item.path);
        movedIds.add(item.id);
      }
      moveWithUndo({ domicile, isBrowserRuntime }, toMove, destPath);
      if (movedIds.size > 0) {
        await loadDesktopFolder();
        setSelectedIds((prev) => prev.filter((id) => !movedIds.has(id)));
      }
    },
    [domicile, handleMoveItemsToTrash, isBrowserRuntime, loadDesktopFolder]
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
      onContextMenu={() => {
        // The desktop background menu is the shell's (Desktop.tsx); it acts
        // here through `piloti:desktop-*` events.
        setContextMenu(null);
      }}
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
        } else if (mod && (key === "z" || key === "y")) {
          e.preventDefault();
          if (key === "y" || e.shiftKey) void redoFileOperation();
          else void undoFileOperation();
        } else if (mod && key === "v") {
          e.preventDefault();
          void handlePasteToDesktop();
        } else if (mod && key === "d" && selectedItems.length > 0) {
          e.preventDefault();
          void handleDuplicateItems(selectedItems);
        } else if (
          ((e.ctrlKey && !e.altKey && !e.shiftKey && e.key === "Enter") ||
            e.key === "F2") &&
          selectedIds.length === 1
        ) {
          e.preventDefault();
          setRenamingId(selectedIds[0]);
        } else if (
          e.key === "Enter" &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          !e.shiftKey &&
          selectedItems.length === 1 &&
          !(e.target as HTMLElement | null)?.closest('[role="grid"]')
        ) {
          e.preventDefault();
          handleActivateItem(selectedItems[0]);
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
        void importExternalFilesToVfs(desktopDirPath, e.dataTransfer.files).then(() => {
          window.dispatchEvent(
            new CustomEvent("piloti:folder-drop-anim", {
              detail: { path: desktopDirPath },
            }),
          );
        });
      }}
    >
      <IconGrid
        items={enrichedItems}
        mode="spatial"
        align={settings.desktopIconAlign ?? "left"}
        cellWidth={120}
        cellHeight={126}
        iconSize={64}
        currentDirPath={desktopDirPath}
        positions={settings.desktopIconPositions}
        onMoveItems={handleMoveItems}
        onDropItems={(dropped, destPath, opts) =>
          void handleDropDesktopItems(dropped, destPath, opts)
        }
        onActivateItem={handleActivateItem}
        onToggleFavorite={(item) => {
          if (item.path && item.kind !== "desktop-entry") {
            toggleVfsEmblem(item.path, "favorite");
          }
        }}
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
        onOpenWithApp={(target, app) => {
          void openPathWith(target.path, app, {
            kind: target.kind === "directory" ? "directory" : "file",
          });
        }}
        onMakeLink={(list) => {
          void Promise.all(
            list.map((target) =>
              copyFsEntry(domicile, isBrowserRuntime, target.path, desktopDirPath, {
                symlink: true,
                name: _("Link to {name}").replace("{name}", target.name),
              }),
            ),
          ).then(() => loadDesktopFolder());
        }}
        onShowOriginal={(target) => {
          const dest = target.symlinkTarget;
          if (!dest) return;
          launchApp("nautilus", { payload: dest.replace(/\/[^/]*$/, "") || "/", forceNew: true });
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
        onCompress={
          isBrowserRuntime
            ? (list) => {
              void compressVfsEntries(list.map((i) => i.path)).then((created) => {
                if (created) void loadDesktopFolder();
              });
            }
            : undefined
        }
        onExtract={
          isBrowserRuntime
            ? (target) => {
              void extractVfsZip(target.path).then((folder) => {
                if (folder) void loadDesktopFolder();
              });
            }
            : undefined
        }
        onDownload={
          isBrowserRuntime ? (target) => downloadVfsFile(target.path) : undefined
        }
        canPaste={Boolean(clipboard && clipboard.paths.length > 0)}
        onPaste={() => void handlePasteToDesktop()}
        onRename={(target) => setRenamingId(target.id)}
        onTrash={(target) => void handleMoveToTrash(target)}
        onTrashItems={(list) => void handleMoveItemsToTrash(list)}
      />
    </div>
  );
}
