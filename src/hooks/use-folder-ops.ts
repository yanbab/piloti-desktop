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
import { getVfsClipboard, setVfsClipboard, WEB_VFS_TRASH } from "@/lib/engine-web/web-vfs";

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
    ) => {
      const created: string[] = [];
      for (const target of list) {
        if (destPath === target.path || destPath.startsWith(`${target.path}/`)) continue;
        const path = await copyFsEntry(piloti, target.path, destPath, options(target));
        if (path) created.push(path);
      }
      recordCreated(ctx, created, label);
      reload();
      return created;
    };

    const trashItems = (list: readonly Target[]) => {
      if (list.length === 0) return;
      if (isTrash) {
        // Nothing to undo.
        for (const target of list) trashFsEntry(piloti, target.path);
      } else {
        trashWithUndo(ctx, list.map((t) => t.path));
      }
      reload();
      deselect(new Set(list.map((t) => t.id)));
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
        const moving = list.filter(
          (item) => item.path !== destPath && !destPath.startsWith(`${item.path}/`),
        );
        if (moving.length === 0) return;
        moveWithUndo(ctx, moving.map((i) => i.path), destPath);
        reload();
        deselect(new Set(moving.map((i) => i.id)));
      },

      pasteClipboard() {
        const clip = getVfsClipboard();
        if (!clip || clip.paths.length === 0 || readOnly) return;
        if (clip.mode === "cut") {
          moveWithUndo(ctx, clip.paths, dirPath);
          setVfsClipboard(null);
          reload();
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
        }).then(select);
      },

      makeLinks(list: readonly Target[]) {
        void copyAll(list, dirPath, "Make Link", (target) => ({
          symlink: true,
          name: _("Link to {name}").replace("{name}", target.name ?? ""),
        })).then(select);
      },

      /** Returns the new path, or null when nothing was renamed. */
      renameItem(item: Target, rawName: string): string | null {
        const name = rawName.trim().replace(/[/\\]/g, "");
        const oldName = item.path.split("/").pop();
        if (!name || name === oldName) return null;
        const renamed = renameWithUndo(ctx, item.path, name);
        if (renamed) {
          reload();
          setSelectedIds([renamed]);
        }
        return renamed;
      },
    };
  }, [dirPath, isTrash, piloti, readOnly, reload, setSelectedIds]);
}
