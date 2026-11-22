/**
 * xdg-session-management-v1 — Client/Shell window session persistence
 * storing an array of session window records in VFS (`~/.local/state/piloti/session.json`).
 */
import {
  readVfsStateJson,
  removeVfsStateFile,
  VFS_STATE_PATHS,
  writeVfsStateJson,
} from "@/lib/engine/vfs-state";

const XDG_SESSION_STORAGE_KEY = "piloti.xdg-session-management-v1";

interface XdgSessionWindow {
  id: string;
  title: string;
  icon: string;
  width: number;
  height: number;
  x: number;
  y: number;
  monitor: string;
  workspace: number;
  maximized: boolean;
  fullscreen: boolean;
  pinned: boolean;
  payload?: string;
}

interface SessionWindowInput {
  id: string;
  appId: string;
  title: string;
  iconName: string;
  iconUrl?: string;
  browserUrl?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  workspace: number;
  maximized: boolean;
  fullscreen?: boolean;
  pinned?: boolean;
  payload?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSessionWindow(raw: unknown): XdgSessionWindow | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id) return null;
  return {
    id: raw.id,
    title: typeof raw.title === "string" ? raw.title : raw.id,
    icon: typeof raw.icon === "string" ? raw.icon : "",
    width: typeof raw.width === "number" && Number.isFinite(raw.width) ? raw.width : 800,
    height:
      typeof raw.height === "number" && Number.isFinite(raw.height) ? raw.height : 540,
    x: typeof raw.x === "number" && Number.isFinite(raw.x) ? raw.x : 80,
    y: typeof raw.y === "number" && Number.isFinite(raw.y) ? raw.y : 48,
    monitor: typeof raw.monitor === "string" ? raw.monitor : "primary",
    workspace:
      typeof raw.workspace === "number" && raw.workspace >= 1 ? raw.workspace : 1,
    maximized: Boolean(raw.maximized),
    fullscreen: Boolean(raw.fullscreen),
    pinned: Boolean(raw.pinned),
    ...(typeof raw.payload === "string" && raw.payload ? { payload: raw.payload } : {}),
  };
}

function serializeWindowToXdgSession(
  win: SessionWindowInput,
  monitor = "primary"
): XdgSessionWindow {
  const sessionId = win.browserUrl ? `web:${win.browserUrl}` : win.appId || win.id;
  return {
    id: sessionId,
    title: win.title,
    icon: win.iconUrl ?? win.iconName,
    width: Math.round(win.size.width),
    height: Math.round(win.size.height),
    x: Math.round(win.position.x),
    y: Math.round(win.position.y),
    monitor,
    workspace: win.workspace,
    maximized: Boolean(win.maximized),
    fullscreen: Boolean(win.fullscreen),
    pinned: Boolean(win.pinned),
    ...(typeof win.payload === "string" && win.payload ? { payload: win.payload } : {}),
  };
}

function loadXdgSession(
  storage?: Pick<Storage, "getItem">,
): XdgSessionWindow[] | null {
  try {
    const parsed: unknown = storage
      ? (() => {
          const raw = storage.getItem(XDG_SESSION_STORAGE_KEY);
          return raw === null ? null : JSON.parse(raw);
        })()
      : readVfsStateJson<unknown>(
          VFS_STATE_PATHS.session,
          XDG_SESSION_STORAGE_KEY,
        );
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map(parseSessionWindow)
      .filter((entry): entry is XdgSessionWindow => entry !== null);
  } catch {
    return null;
  }
}

function saveXdgSession(
  windows: readonly XdgSessionWindow[],
  storage?: Pick<Storage, "setItem">,
): void {
  try {
    if (storage) {
      storage.setItem(XDG_SESSION_STORAGE_KEY, JSON.stringify(windows));
    } else {
      writeVfsStateJson(VFS_STATE_PATHS.session, windows);
    }
  } catch {
    // ignore storage errors
  }
}

function clearXdgSession(
  storage?: Pick<Storage, "removeItem">,
): void {
  try {
    if (storage) {
      storage.removeItem(XDG_SESSION_STORAGE_KEY);
    } else {
      removeVfsStateFile(VFS_STATE_PATHS.session);
    }
  } catch {
    // ignore storage errors
  }
}

export {
  XDG_SESSION_STORAGE_KEY,
  clearXdgSession,
  loadXdgSession,
  saveXdgSession,
  serializeWindowToXdgSession,
};
export type { SessionWindowInput, XdgSessionWindow };

