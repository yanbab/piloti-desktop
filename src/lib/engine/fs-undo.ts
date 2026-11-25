import { getEngine } from "@/lib/engine/engine";
import * as React from "react";
import type { Piloti } from "@/lib/engine/piloti";
import {
  listVfsDir,
  normalizeVfsPath,
  WEB_VFS_TRASH,
} from "@/lib/engine-web/web-vfs";
import {
  moveFsEntry,
  renameFsEntry,
  restoreFsEntry,
  toDomicilePath,
  trashFsEntry,
} from "@/lib/engine/fs-bridge";

/**
 * Undo / redo for file operations done in Folders (move, rename, trash, create).
 * One shared history for the whole session; each entry knows how to reverse and
 * replay itself. Listeners (open Folders windows) reload when one is applied.
 */
export interface FileUndoContext {
  piloti: Piloti;
}

interface FileUndoEntry {
  label: string;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
}

const MAX_HISTORY = 50;
let past: FileUndoEntry[] = [];
let future: FileUndoEntry[] = [];
let snapshot = { undoLabel: null as string | null, redoLabel: null as string | null };
const stateListeners = new Set<() => void>();
const appliedListeners = new Set<() => void>();

function publish(): void {
  snapshot = {
    undoLabel: past[past.length - 1]?.label ?? null,
    redoLabel: future[future.length - 1]?.label ?? null,
  };
  for (const l of stateListeners) l();
}

function record(entry: FileUndoEntry): void {
  past = [...past.slice(-(MAX_HISTORY - 1)), entry];
  future = [];
  publish();
}

export async function undoFileOperation(): Promise<boolean> {
  const entry = past[past.length - 1];
  if (!entry) return false;
  past = past.slice(0, -1);
  try {
    await entry.undo();
  } finally {
    future = [...future, entry];
    publish();
    for (const l of appliedListeners) l();
  }
  return true;
}

export async function redoFileOperation(): Promise<boolean> {
  const entry = future[future.length - 1];
  if (!entry) return false;
  future = future.slice(0, -1);
  try {
    await entry.redo();
  } finally {
    past = [...past, entry];
    publish();
    for (const l of appliedListeners) l();
  }
  return true;
}

export function clearFileUndoHistory(): void {
  past = [];
  future = [];
  publish();
}

/** Calls `listener` after an undo / redo changed the filesystem. */
export function onFileUndoApplied(listener: () => void): () => void {
  appliedListeners.add(listener);
  return () => appliedListeners.delete(listener);
}

function subscribe(listener: () => void): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

/** Labels of the next undo / redo (null when unavailable). */
export function useFileUndoState(): { undoLabel: string | null; redoLabel: string | null } {
  return React.useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}

function baseName(path: string): string {
  return normalizeVfsPath(path).split("/").filter(Boolean).pop() ?? "";
}

function parentDir(path: string): string {
  const norm = normalizeVfsPath(path);
  const idx = norm.lastIndexOf("/");
  return idx <= 0 ? "/" : norm.slice(0, idx);
}

/** Where a just-trashed `path` ended up in the Trash folder. */
function findTrashedPath(path: string): string {
  const norm = normalizeVfsPath(path);
  const match = listVfsDir(WEB_VFS_TRASH, { includeHidden: true })
    .filter((e) => e.trashedFromPath === norm)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return match?.path ?? `${WEB_VFS_TRASH}/${baseName(path)}`;
}

function restoreFromTrash(ctx: FileUndoContext, trashPath: string, originalPath: string): void {
  const restored = restoreFsEntry(ctx.piloti, trashPath);
  if (!restored && getEngine().capabilities.realFilesystem) {
    // Native trash is not always mirrored in the VFS: put it back on disk.
    void ctx.piloti.processes.run([
      "mv",
      "-n",
      "--",
      toDomicilePath(trashPath),
      toDomicilePath(originalPath),
    ]);
  }
}

function trashAll(ctx: FileUndoContext, paths: readonly string[]): string[] {
  return paths.map((path) => {
    trashFsEntry(ctx.piloti, path);
    return findTrashedPath(path);
  });
}

/** Moves `paths` to the Trash and records it (undo restores them). */
export function trashWithUndo(ctx: FileUndoContext, paths: readonly string[]): void {
  if (paths.length === 0) return;
  const originals = paths.map(normalizeVfsPath);
  let trashed = trashAll(ctx, originals);
  record({
    label: "Move to Trash",
    undo: () => {
      trashed.forEach((tp, i) => restoreFromTrash(ctx, tp, originals[i] ?? tp));
    },
    redo: () => {
      trashed = trashAll(ctx, originals);
    },
  });
}

/** Records items that were just created (copy, duplicate, link, new folder…): undo trashes them. */
export function recordCreated(
  ctx: FileUndoContext,
  paths: readonly string[],
  label = "Create",
): void {
  if (paths.length === 0) return;
  const created = paths.map(normalizeVfsPath);
  let trashed: string[] = [];
  record({
    label,
    undo: () => {
      trashed = trashAll(ctx, created);
    },
    redo: () => {
      trashed.forEach((tp, i) => restoreFromTrash(ctx, tp, created[i] ?? tp));
    },
  });
}

/** Moves `paths` into `destDir` and records it (undo moves them back). */
export function moveWithUndo(
  ctx: FileUndoContext,
  paths: readonly string[],
  destDir: string,
): string[] {
  const moves: Array<{ from: string; to: string }> = [];
  for (const from of paths) {
    const moved = moveFsEntry(ctx.piloti, from, destDir);
    const dir = normalizeVfsPath(destDir);
    const to = moved?.path ?? `${dir === "/" ? "" : dir}/${baseName(from)}`;
    if (normalizeVfsPath(from) !== to) moves.push({ from: normalizeVfsPath(from), to });
  }
  if (moves.length > 0) {
    record({
      label: "Move",
      undo: () => {
        for (const m of moves) moveFsEntry(ctx.piloti, m.to, parentDir(m.from));
      },
      redo: () => {
        for (const m of moves) moveFsEntry(ctx.piloti, m.from, parentDir(m.to));
      },
    });
  }
  return moves.map((m) => m.to);
}

/** Renames `path` and records it. Returns the new path (null when it failed). */
export function renameWithUndo(
  ctx: FileUndoContext,
  path: string,
  newName: string,
): string | null {
  const from = normalizeVfsPath(path);
  const oldName = baseName(from);
  const renamed = renameFsEntry(ctx.piloti, from, newName);
  if (!renamed) return null;
  let current = renamed.path;
  record({
    label: "Rename",
    undo: () => {
      current = renameFsEntry(ctx.piloti, current, oldName)?.path ?? current;
    },
    redo: () => {
      current = renameFsEntry(ctx.piloti, current, newName)?.path ?? current;
    },
  });
  return renamed.path;
}

/** Restores items from the Trash and records it (undo puts them back in the Trash). */
export function restoreWithUndo(ctx: FileUndoContext, trashPaths: readonly string[]): void {
  if (trashPaths.length === 0) return;
  const items = trashPaths.map((tp) => {
    const restored = restoreFsEntry(ctx.piloti, tp);
    return { trashPath: tp, restored: restored?.path ?? null };
  });
  const placed = items.filter((i) => i.restored);
  if (placed.length === 0) return;
  let trashed = placed.map((i) => i.trashPath);
  record({
    label: "Restore",
    undo: () => {
      trashed = trashAll(ctx, placed.map((i) => i.restored as string));
    },
    redo: () => {
      trashed.forEach((tp, i) => restoreFromTrash(ctx, tp, placed[i]?.restored ?? tp));
    },
  });
}
