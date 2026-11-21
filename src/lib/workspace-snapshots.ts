import {
  readVfsStateJson,
  VFS_STATE_PATHS,
  writeVfsStateJson,
} from "@/lib/vfs-state";

export interface WorkspaceSnapshotWindow {
  appId: string;
  payload?: string;
  browserUrl?: string;
  title?: string;
}

export interface WorkspaceSnapshot {
  id: string;
  name: string;
  createdAt: number;
  windows: WorkspaceSnapshotWindow[];
}

const SNAPSHOTS_STORAGE_KEY = "piloti.workspace-snapshots.v1";

export function loadWorkspaceSnapshots(): WorkspaceSnapshot[] {
  try {
    const parsed = readVfsStateJson<unknown>(
      VFS_STATE_PATHS.workspaceSnapshots,
      SNAPSHOTS_STORAGE_KEY,
    );
    return Array.isArray(parsed) ? (parsed as WorkspaceSnapshot[]) : [];
  } catch {
    return [];
  }
}

export function saveWorkspaceSnapshot(
  name: string,
  windows: WorkspaceSnapshotWindow[],
): WorkspaceSnapshot[] {
  const prev = loadWorkspaceSnapshots();
  const cleanName = name.trim() || `Layout ${prev.length + 1}`;
  const entry: WorkspaceSnapshot = {
    id: `snap-${Date.now()}`,
    name: cleanName,
    createdAt: Date.now(),
    windows,
  };
  const next = [entry, ...prev.filter((s) => s.name !== cleanName)].slice(0, 8);
  try {
    writeVfsStateJson(VFS_STATE_PATHS.workspaceSnapshots, next);
  } catch {
    // ignore storage errors
  }
  return next;
}

export function deleteWorkspaceSnapshot(id: string): WorkspaceSnapshot[] {
  const next = loadWorkspaceSnapshots().filter((s) => s.id !== id);
  try {
    writeVfsStateJson(VFS_STATE_PATHS.workspaceSnapshots, next);
  } catch {
    // ignore storage errors
  }
  return next;
}

