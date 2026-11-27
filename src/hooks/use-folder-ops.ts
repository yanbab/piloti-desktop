import * as React from "react";
import { copyFsEntry, trashFsEntry } from "@/lib/engine/fs-bridge";
import {
  moveWithUndo,
  recordCreated,
  renameWithUndo,
  trashWithUndo,
} from "@/lib/engine/fs-undo";
import { usePiloti } from "@/lib/engine/piloti";
import { _ } from "@/lib/core/i18n";
import { getVfsClipboard, setVfsClipboard } from "@/lib/core/vfs-clipboard";
import { WEB_VFS_TRASH } from "@/lib/core/vfs-paths";
import { parentPath } from "@/lib/ports/vfs";
import { topmostItems } from "@/lib/files/folder-tree";

type Target = { id: string; path: string; name?: string };

/**
 * File operations of a folder view: drop (move, copy, trash), paste,
 * duplicate, link, rename. Shared by Folders and the desktop.
 */
export function useFolderOps({
  dirPath,
  reload,
  setSelectedIds,
  isTrash = false,
  readOnly = false,
}: {
  dirPath: string;
  reload: () => void;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  /** Trashing from the Trash is permanent. */
  isTrash?: boolean;
  /** Trash and virtual views: nothing can be pasted or created here. */
  readOnly?: boolean;
}) {
  const piloti = usePiloti();

  return React.useMemo(() => {
    const ctx = { piloti };
    const select = (paths: string[]) => {
      if (paths.length > 0) setSelectedIds(paths);
    };
    const deselect = (ids: Set<string>) =>
      setSelectedIds((prev) => prev.filter((id) => !ids.has(id)));

    const copyAll = async (
      list: readonly Target[],
      destPath: string,
      label: string,
      options: (target: Target) => { name?: string; symlink?: boolean } = () => ({}),
      /** Each copy next to its source: the tree shows subfolders' items. */
      beside = false,
    ) => {
      const created: string[] = [];
      for (const target of topmostItems(list)) {
        const into = beside ? parentPath(target.path) : destPath;
        if (into === target.path || into.startsWith(`${target.path}/`)) continue;
        const path = await copyFsEntry(piloti, target.path, into, options(target));
        if (path) created.push(path);
      }
      recordCreated(ctx, created, label);
      reload();
      return created;
    };

    const trashItems = (selection: readonly Target[]) => {
      // A folder takes its contents with it.
      const list = topmostItems(selection);
      if (list.length === 0) return;
      if (isTrash) {
        // Nothing to undo.
        void Promise.all(list.map((target) => trashFsEntry(piloti, target.path))).then(reload);
      } else {
        void trashWithUndo(ctx, list.map((t) => t.path)).then(reload);
      }
      deselect(new Set(selection.map((t) => t.id)));
    };

    return {
      trashItems,

      dropItems(list: readonly Target[], destPath: string, opts?: { copy?: boolean }) {
        if (destPath === WEB_VFS_TRASH) {
          trashItems(list);
          return;
        }
        if (opts?.copy) {
          void copyAll(list, destPath, "Copy");
          return;
        }
        const moving = topmostItems(list).filter(
          (item) =>
            item.path !== destPath &&
            parentPath(item.path) !== destPath &&
            !destPath.startsWith(`${item.path}/`),
        );
        if (moving.length === 0) return;
        void moveWithUndo(ctx, moving.map((i) => i.path), destPath).then(reload);
        deselect(new Set(moving.map((i) => i.id)));
      },

      pasteClipboard() {
        const clip = getVfsClipboard();
        if (!clip || clip.paths.length === 0 || readOnly) return;
        if (clip.mode === "cut") {
          const paths = topmostItems(clip.paths.map((path) => ({ path }))).map((i) => i.path);
          void moveWithUndo(ctx, paths, dirPath).then(reload);
          setVfsClipboard(null);
          return;
        }
        void copyAll(clip.paths.map((path) => ({ id: path, path })), dirPath, "Paste");
      },

      duplicateItems(list: readonly Target[]) {
        if (readOnly) return;
        void copyAll(list, dirPath, "Duplicate", (target) => {
          const base = target.path.split("/").filter(Boolean).pop() ?? "item";
          const dot = base.lastIndexOf(".");
          return {
            name: dot > 0 ? `${base.slice(0, dot)} Copy${base.slice(dot)}` : `${base} Copy`,
          };
        }, true).then(select);
      },

      makeLinks(list: readonly Target[]) {
        void copyAll(list, dirPath, "Make Link", (target) => ({
          symlink: true,
          name: _("Link to {name}").replace("{name}", target.name ?? ""),
        }), true).then(select);
      },

      /** Resolves to the new path, or null when nothing was renamed. */
      async renameItem(item: Target, rawName: string): Promise<string | null> {
        const name = rawName.trim().replace(/[/\\]/g, "");
        const oldName = item.path.split("/").pop();
        if (!name || name === oldName) return null;
        const renamed = await renameWithUndo(ctx, item.path, name);
        if (renamed) {
          reload();
          setSelectedIds([renamed]);
        }
        return renamed;
      },
    };
  }, [dirPath, isTrash, piloti, readOnly, reload, setSelectedIds]);
}
