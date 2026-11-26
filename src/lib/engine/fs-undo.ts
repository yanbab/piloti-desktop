import * as React from "react";
import type { Piloti } from "@/lib/engine/piloti";
import { normalizeVfsPath } from "@/lib/core/vfs-paths";
import {
  moveFsEntry,
  renameFsEntry,
  restoreFsEntry,
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

/** Trashes one after the other; where each went (`null` if it stayed or is unknown). */
async function trashAll(ctx: FileUndoContext, paths: readonly string[]): Promise<(string | null)[]> {
  const trashed: (string | null)[] = [];
  for (const path of paths) trashed.push(await trashFsEntry(ctx.piloti, path));
  return trashed;
}

async function restoreAll(ctx: FileUndoContext, trashPaths: readonly (string | null)[]): Promise<void> {
  for (const path of trashPaths) if (path) await restoreFsEntry(ctx.piloti, path);
}

/** Moves `paths` to the Trash and records it (undo restores them). */
export async function trashWithUndo(ctx: FileUndoContext, paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  const originals = paths.map(normalizeVfsPath);
  let trashed = await trashAll(ctx, originals);
  if (!trashed.some(Boolean)) return;
  record({
    label: "Move to Trash",
    undo: () => restoreAll(ctx, trashed),
    redo: async () => {
      trashed = await trashAll(ctx, originals);
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
  let trashed: (string | null)[] = [];
  record({
    label,
    undo: async () => {
      trashed = await trashAll(ctx, created);
    },
    redo: () => restoreAll(ctx, trashed),
  });
}

/** Moves `paths` into `destDir` and records it (undo moves them back). */
export async function moveWithUndo(
  ctx: FileUndoContext,
  paths: readonly string[],
  destDir: string,
): Promise<string[]> {
  const moves: Array<{ from: string; to: string }> = [];
  for (const from of paths) {
    const moved = await moveFsEntry(ctx.piloti, from, destDir);
    if (moved) moves.push({ from: normalizeVfsPath(from), to: moved.path });
  }
  if (moves.length > 0) {
    record({
      label: "Move",
      undo: async () => {
        for (const m of moves) await moveFsEntry(ctx.piloti, m.to, parentDir(m.from));
      },
      redo: async () => {
        for (const m of moves) await moveFsEntry(ctx.piloti, m.from, parentDir(m.to));
      },
    });
  }
  return moves.map((m) => m.to);
}

/** Renames `path` and records it. Returns the new path (null when it failed). */
export async function renameWithUndo(
  ctx: FileUndoContext,
  path: string,
  newName: string,
): Promise<string | null> {
  const from = normalizeVfsPath(path);
  const oldName = baseName(from);
  const renamed = await renameFsEntry(ctx.piloti, from, newName);
  if (!renamed) return null;
  let current = renamed.path;
  record({
    label: "Rename",
    undo: async () => {
      current = (await renameFsEntry(ctx.piloti, current, oldName))?.path ?? current;
    },
    redo: async () => {
      current = (await renameFsEntry(ctx.piloti, current, newName))?.path ?? current;
    },
  });
  return renamed.path;
}

/** Restores items from the Trash and records it (undo puts them back in the Trash). */
export async function restoreWithUndo(ctx: FileUndoContext, trashPaths: readonly string[]): Promise<void> {
  const placed: string[] = [];
  for (const path of trashPaths) {
    const restored = await restoreFsEntry(ctx.piloti, path);
    if (restored) placed.push(restored.path);
  }
  if (placed.length === 0) return;
  let trashed: (string | null)[] = [];
  record({
    label: "Restore",
    undo: async () => {
      trashed = await trashAll(ctx, placed);
    },
    redo: () => restoreAll(ctx, trashed),
  });
}
