import * as React from "react";
import {
  FileItemContextMenu,
  type FileItemContextMenuState,
} from "@/components/apps/FileItemContextMenu";
import { FolderIconView } from "@/components/ui/folder-icon-view";
import {
  useApps,
  useSystemBackends,
  useWindowActions,
  useDesktopSettings,
  useUpdateSettings,
} from "@/context/DesktopStateContext";
import { useArchiveActions } from "@/hooks/use-archive-actions";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useDesktopDirPath } from "@/hooks/use-desktop-dir";
import { useExternalFileDrop } from "@/hooks/use-external-file-drop";
import { useFolderOps } from "@/hooks/use-folder-ops";
import { useLauncherItems } from "@/hooks/use-launcher-items";
import { useOpenPath } from "@/hooks/use-open-path";
import { useVfsList, useVfsRefresh } from "@/hooks/use-vfs";
import { vfsKeys } from "@/lib/engine/vfs-query";
import { _ } from "@/lib/core/i18n";
import { startBootPhase } from "@/lib/core/perf-log";
import {
  createFsFileFromTemplate,
  createFsFolder,
  createFsTextFile,
} from "@/lib/engine/fs-bridge";
import {
  onFileUndoApplied,
  recordCreated,
  redoFileOperation,
  undoFileOperation,
} from "@/lib/engine/fs-undo";
import { usePiloti } from "@/lib/engine/piloti";
import { downloadVfsFile, toggleVfsEmblem } from "@/lib/engine-web/web-vfs";
import { getVfsClipboard, setVfsClipboard, subscribeVfsClipboard } from "@/lib/core/vfs-clipboard";
import { type WebVfsEntry } from "@/lib/core/vfs-paths";
import { onShellEvent } from "@/lib/shell/shell-events";
import { type IconGridItem, sortDesktopItems } from "@/lib/shell/desktop-icons";
import { hiddenNamesOf, vfsEntryToGridItem, entryVisual } from "@/lib/shell/folder-items";

const NO_ENTRIES: WebVfsEntry[] = [];

/**
 * The desktop: the XDG Desktop folder's icons over the wallpaper (below
 * windows), in the same view Folders shows with "As Desktop".
 */
export function DesktopIconsApp({
  bottomInset = 0,
}: {
  bottomInset?: number;
}) {
  const piloti = usePiloti();
  const settings = useDesktopSettings(["debugMode", "desktopIconsEnabled"]);
  const { realFilesystem } = useCapabilities();
  const { locked } = useSystemBackends();
  const { dockIconsReady, getAppIconUrl, ensureWaylandIcons } = useApps();
  const { launchApp, launchXdgApp } = useWindowActions();
  const { openPath, openPathWith } = useOpenPath();
  const desktopDirPath = useDesktopDirPath();

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [clipboard, setLocalClipboard] = React.useState(() => getVfsClipboard());
  const [contextMenu, setContextMenu] =
    React.useState<FileItemContextMenuState | null>(null);

  React.useEffect(
    () => subscribeVfsClipboard(() => setLocalClipboard(getVfsClipboard())),
    [],
  );

  // Debug mode lists the folder without waiting for the essential icons.
  const listingEnabled =
    settings.desktopIconsEnabled && (dockIconsReady || settings.debugMode);
  // Our own operations and other programs' (inotify via Domicile) refresh it.
  const listing = useVfsList(listingEnabled ? desktopDirPath : null);
  const entries = (settings.desktopIconsEnabled && listing.data) || NO_ENTRIES;
  const refresh = useVfsRefresh();
  const reload = React.useCallback(
    () => refresh(vfsKeys.list(desktopDirPath)),
    [desktopDirPath, refresh],
  );

  const finishBootPhaseRef = React.useRef<((note: string) => void) | null | undefined>(
    undefined,
  );
  React.useEffect(() => {
    if (listingEnabled && finishBootPhaseRef.current === undefined) {
      finishBootPhaseRef.current = startBootPhase("desktop icons");
    }
  }, [listingEnabled]);
  React.useEffect(() => {
    if (!listing.data || !finishBootPhaseRef.current) return;
    finishBootPhaseRef.current(`${listing.data.length} items`);
    finishBootPhaseRef.current = null;
  }, [listing.data]);

  const archive = useArchiveActions(reload);

  React.useEffect(() => onFileUndoApplied(reload), [reload]);

  React.useEffect(() => {
    if (!listingEnabled || locked) return;
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [listingEnabled, locked, reload]);

  const fileItems = React.useMemo(() => {
    const hidden = hiddenNamesOf(entries);
    return sortDesktopItems(
      entries
        .filter((e) => !e.name.startsWith(".") && !hidden.has(e.name))
        .map((e) => vfsEntryToGridItem(e, getAppIconUrl)),
    );
  }, [desktopDirPath, entries, getAppIconUrl]);

  React.useEffect(() => {
    const candidates = entries.flatMap((e) => [...entryVisual(e).iconCandidates]);
    if (candidates.length > 0) ensureWaylandIcons(Array.from(new Set(candidates)));
  }, [ensureWaylandIcons, entries]);

  const items = useLauncherItems(fileItems);
  const ops = useFolderOps({ dirPath: desktopDirPath, reload, setSelectedIds });
  const externalDrop = useExternalFileDrop(desktopDirPath, true, reload);

  // "New Folder", "Paste", "Open in Terminal"... from the shell's desktop menus.
  const editCreated = React.useCallback(
    (created: WebVfsEntry, label?: string) => {
      if (label) recordCreated({ piloti }, [created.path], label);
      reload();
      setSelectedIds([created.path]);
      setRenamingId(created.path);
    },
    [piloti, reload],
  );
  React.useEffect(() => {
    const listeners: Record<string, (e: Event) => void> = {
      "piloti:desktop-new-folder": () =>
        void createFsFolder(piloti, desktopDirPath).then((c) => editCreated(c, "New Folder")),
      "piloti:desktop-new-file": () =>
        void createFsTextFile(piloti, desktopDirPath).then((c) => editCreated(c, "New Text File")),
      "piloti:desktop-new-from-template": (e) => {
        const template = (e as CustomEvent<WebVfsEntry | undefined>).detail;
        if (template) {
          void createFsFileFromTemplate(piloti, desktopDirPath, template).then((c) =>
            editCreated(c),
          );
        }
      },
      "piloti:desktop-paste": () => ops.pasteClipboard(),
      "piloti:desktop-open-terminal": () =>
        launchApp("terminal", { payload: desktopDirPath, forceNew: true }),
    };
    for (const [type, fn] of Object.entries(listeners)) window.addEventListener(type, fn);
    return () => {
      for (const [type, fn] of Object.entries(listeners)) {
        window.removeEventListener(type, fn);
      }
    };
  }, [desktopDirPath, editCreated, launchApp, ops, piloti]);

  const updateSettings = useUpdateSettings();
  React.useEffect(() => {
    const onAlignIcons = () => updateSettings({ desktopIconPositions: {} });
    window.addEventListener("piloti:desktop-align-icons", onAlignIcons);
    return () => window.removeEventListener("piloti:desktop-align-icons", onAlignIcons);
  }, [updateSettings]);

  React.useEffect(
    () =>
      onShellEvent("piloti:select-all", (detail, event) => {
        if (detail.windowId !== null || items.length === 0) return;
        event.preventDefault();
        setSelectedIds(items.map((i) => i.id));
        // Keys (Delete, Ctrl+C...) then act on the desktop.
        document
          .querySelector<HTMLElement>('[data-desktop-icons-root] [role="gridcell"]')
          ?.focus({ preventScroll: true });
      }),
    [items],
  );

  const handleActivateItem = React.useCallback(
    (item: IconGridItem) => {
      if (item.kind === "desktop-entry" && item.desktopEntry) {
        const lower = `${item.desktopEntry.desktopId} ${item.desktopEntry.exec}`.toLowerCase();
        if (!realFilesystem) {
          if (lower.includes("nautilus")) {
            launchApp("nautilus");
            return;
          }
          if (lower.includes("settings") || lower.includes("control-center")) {
            launchApp("settings");
            return;
          }
        }
        launchXdgApp(item.desktopEntry);
        return;
      }

      void openPath(item.path, {
        kind: item.kind === "directory" ? "directory" : "file",
        name: item.name,
        onExtracted: reload,
      });
    },
    [realFilesystem, launchApp, launchXdgApp, reload, openPath]
  );

  if (!settings.desktopIconsEnabled) return null;

  const selectedItems = items.filter((i) => selectedIds.includes(i.id));
  const trashItems = (list: readonly IconGridItem[]) => {
    setContextMenu(null);
    ops.trashItems(list);
  };

  return (
    <div
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
          ops.pasteClipboard();
        } else if (mod && key === "d" && selectedItems.length > 0) {
          e.preventDefault();
          ops.duplicateItems(selectedItems);
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
          trashItems(selectedItems);
        }
      }}
      {...externalDrop.handlers}
    >
      <FolderIconView
        items={items}
        dirPath={desktopDirPath}
        arrangement="desktop"
        isDesktop
        onDropItems={ops.dropItems}
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
        onCommitRename={(item, nextName) => {
          setRenamingId(null);
          ops.renameItem(item, nextName);
        }}
        onCancelRename={() => setRenamingId(null)}
        selectedIds={selectedIds}
        onSelectIds={setSelectedIds}
        ariaLabel="Desktop Icons"
      />

      {externalDrop.active && (
        <div className="pointer-events-none absolute inset-3 z-30 flex items-end justify-center rounded-ui-box border-2 border-dashed border-ui-accent/70 bg-ui-accent/10 pb-4">
          <span className="rounded-full bg-ui-hud-dark px-3 py-1 text-ui-body font-medium text-ui-hud-dark-label shadow-sm ring-1 ring-ui-hud-dark-border">
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
        onMakeLink={ops.makeLinks}
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
        onDuplicate={ops.duplicateItems}
        onCompress={
          archive.available ? (list) => archive.compress(list.map((i) => i.path)) : undefined
        }
        onExtract={archive.available ? (target) => archive.extract(target.path) : undefined}
        onDownload={
          !realFilesystem ? (target) => downloadVfsFile(target.path) : undefined
        }
        canPaste={Boolean(clipboard && clipboard.paths.length > 0)}
        onPaste={ops.pasteClipboard}
        onRename={(target) => setRenamingId(target.id)}
        onTrash={(target) => trashItems([target])}
        onTrashItems={trashItems}
      />
    </div>
  );
}
