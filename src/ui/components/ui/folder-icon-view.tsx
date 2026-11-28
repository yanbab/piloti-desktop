import * as React from "react";
import { IconGrid, type IconGridProps } from "@/ui/components/ui/icon-grid";
import { useFilesHost } from "@/ui/components/files-host";
import { useDesktopDirPath } from "@/ui/hooks/use-desktop-dir";
import { subscribeRenames } from "@/platform/shared/renames";
import {
  clientPointToGridCell,
  computeGridMetrics,
  DESKTOP_GRID_PADDING,
  type GridCoord,
  type GridMetrics,
  moveInNamedLayout,
  type NamedPositions,
  placeNamesNear,
  positionsById,
} from "@/core/files/desktop-icons";

/**
 * - `flow`: sorted items, wrapped.
 * - `manual`: free placement at the view's zoom.
 * - `desktop`: the desktop's grid; for the Desktop folder, its saved layout.
 */
export type FolderArrangement = "flow" | "manual" | "desktop";

const DESKTOP_CELLS = { cellWidth: 112, cellHeight: 112, iconSize: 64 } as const;

/** Layouts not saved in settings: in memory, shared by every view of a folder. */
let sessionLayouts: Record<string, NamedPositions> = {};
const listeners = new Set<() => void>();
const subscribeLayouts = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const NO_POSITIONS: NamedPositions = {};

function useFolderLayout(dirPath: string, arrangement: FolderArrangement) {
  const host = useFilesHost();
  const settings = host.useDesktopSettings(["desktopIconAlign", "desktopIconPositions"]);
  const { updateSettings } = host.useActions();
  const desktopDirPath = useDesktopDirPath(host.useApps().xdgUserDirs);
  const persisted = arrangement === "desktop" && dirPath === desktopDirPath;
  const key = `${arrangement}:${dirPath}`;
  const session = React.useSyncExternalStore(
    subscribeLayouts,
    () => sessionLayouts[key] ?? NO_POSITIONS,
  );
  const positions = persisted ? settings.desktopIconPositions : session;
  const save = React.useCallback(
    (next: NamedPositions) => {
      if (persisted) {
        updateSettings({ desktopIconPositions: next });
        return;
      }
      sessionLayouts = { ...sessionLayouts, [key]: next };
      for (const listener of listeners) listener();
    },
    [key, persisted, updateSettings],
  );
  return { positions, save, align: settings.desktopIconAlign ?? "left" };
}

export type FolderIconViewProps = Omit<
  IconGridProps,
  "mode" | "positions" | "onMoveItem" | "onMoveItems" | "currentDirPath" | "align" | "stretchCells"
> & {
  /** Unset for virtual views, which have no layout. */
  dirPath?: string;
  arrangement: FolderArrangement;
  /** The desktop itself: a drop pins every icon where it is now. */
  isDesktop?: boolean;
};

/** The icons of a folder: Folders' grid views and the desktop. */
export function FolderIconView({
  dirPath,
  arrangement,
  isDesktop = false,
  ...grid
}: FolderIconViewProps) {
  const spatial = arrangement !== "flow" && Boolean(dirPath);
  const { positions, save, align: desktopAlign } = useFolderLayout(dirPath ?? "", arrangement);
  const align = arrangement === "desktop" ? desktopAlign : "left";
  const cells = arrangement === "desktop" ? DESKTOP_CELLS : null;
  const cellWidth = cells?.cellWidth ?? grid.cellWidth;
  const cellHeight = cells?.cellHeight ?? grid.cellHeight;
  const { items } = grid;

  const byId = React.useMemo(
    () => (spatial ? positionsById(items, positions) : undefined),
    [items, positions, spatial],
  );

  const onMoveItems = (
    ids: string[],
    primaryId: string,
    cell: GridCoord,
    metrics: GridMetrics,
  ) =>
    save(
      moveInNamedLayout(items, positions, ids, primaryId, cell, metrics, {
        align,
        partial: !isDesktop,
      }),
    );

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const latest = React.useRef({ items, positions, save });
  latest.current = { items, positions, save };

  // Files arriving from elsewhere land where they were dropped.
  React.useEffect(() => {
    if (!spatial) return;
    const onDropPosition = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          destPath?: string;
          names?: string[];
          clientX?: number;
          clientY?: number;
        }>
      ).detail;
      const root = rootRef.current;
      if (!root || detail?.destPath !== dirPath || !detail?.names?.length) return;
      const { clientX, clientY } = detail;
      if (typeof clientX !== "number" || typeof clientY !== "number") return;
      // Several views can show one folder: only the one under the pointer answers.
      const target = document
        .elementsFromPoint(clientX, clientY)
        .find((el) => el.matches("[data-vfs-drop-path], [data-slot=window]"));
      if (!target?.contains(root) && !(target && root.contains(target))) return;
      const rect = root.getBoundingClientRect();
      const metrics = computeGridMetrics(
        rect.width,
        rect.height,
        cellWidth,
        cellHeight,
        grid.padding ?? DESKTOP_GRID_PADDING,
        arrangement === "desktop",
      );
      const cell = clientPointToGridCell(clientX - rect.left, clientY - rect.top, metrics);
      const now = latest.current;
      now.save(placeNamesNear(now.items, now.positions, detail.names, cell, metrics, align));
    };
    window.addEventListener("residence:desktop-drop-position", onDropPosition);
    return () => window.removeEventListener("residence:desktop-drop-position", onDropPosition);
  }, [align, arrangement, cellHeight, cellWidth, dirPath, grid.padding, spatial]);

  // A renamed icon keeps its cell.
  React.useEffect(() => {
    if (!spatial) return;
    return subscribeRenames(({ oldPath, newPath }) => {
      const prefix = `${dirPath}/`;
      if (!oldPath.startsWith(prefix) || !newPath.startsWith(prefix)) return;
      const oldName = oldPath.slice(prefix.length);
      const newName = newPath.slice(prefix.length);
      const now = latest.current;
      const cell = now.positions[oldName];
      if (!cell || now.positions[newName]) return;
      const next = { ...now.positions, [newName]: cell };
      delete next[oldName];
      now.save(next);
    });
  }, [dirPath, spatial]);

  return (
    <div ref={rootRef} data-folder-arrangement={arrangement} className="h-full w-full">
      <IconGrid
        {...grid}
        {...cells}
        mode={spatial ? "spatial" : "flow"}
        align={align}
        stretchCells={arrangement === "desktop"}
        currentDirPath={dirPath}
        positions={byId}
        onMoveItems={spatial ? onMoveItems : undefined}
      />
    </div>
  );
}
