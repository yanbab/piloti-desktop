import { isWebEngine } from "@/lib/engine/engine";
import * as React from "react";
import { ACCENT_COLORS, type AccentColorId } from "@/data/catalog";
import { subscribeLocale } from "@/lib/core/i18n";
import { getVfsEntry, listVfsDir, writeVfsTextFile } from "@/lib/engine-web/web-vfs";

export type ShellToAppMessage =
  | {
      type: "piloti:theme-sync";
      themeMode: "dark" | "light" | "system";
      accentColor: AccentColorId;
      fontSansFamily: string;
      fontMonoFamily: string;
      fontScale: number;
      isCsd: boolean;
      windowId: string;
    }
  | {
      type: "piloti:app-action";
      actionId: string;
    }
  | {
      type: "piloti:fs-response";
      requestId: string;
      ok: boolean;
      data?: unknown;
      error?: string;
    };

export type AppToShellMessage =
  | {
      type: "piloti:ready";
      windowId: string;
    }
  | {
      type: "piloti:focus-window";
      windowId: string;
    }
  | {
      type: "piloti:window-control";
      windowId: string;
      action: "close" | "minimize" | "maximize";
    }
  | {
      type: "piloti:resize-window";
      windowId: string;
      width: number;
      height: number;
    }
  | {
      type: "piloti:set-title";
      windowId: string;
      title: string;
    }
  | {
      type: "piloti:notify";
      windowId: string;
      summary: string;
      body?: string;
    }
  | {
      type: "piloti:fs-read";
      windowId: string;
      requestId: string;
      path: string;
    }
  | {
      type: "piloti:fs-write";
      windowId: string;
      requestId: string;
      path: string;
      content: string;
    }
  | {
      type: "piloti:fs-list";
      windowId: string;
      requestId: string;
      path: string;
    };

export function applyThemeToDocument(
  doc: Document,
  theme: {
    themeMode: "dark" | "light" | "system";
    accentColor: AccentColorId;
    fontSansFamily: string;
    fontMonoFamily: string;
    fontScale: number;
  },
) {
  const root = doc.documentElement;
  const isDark =
    theme.themeMode === "dark" ||
    (theme.themeMode === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);

  const accent =
    ACCENT_COLORS.find((c) => c.id === theme.accentColor) ?? ACCENT_COLORS[0];
  root.style.setProperty("--adw-active-accent", accent.hex);
  if (theme.fontSansFamily) {
    root.style.setProperty(
      "--font-adw",
      `"${theme.fontSansFamily}", "Cantarell", system-ui, sans-serif`,
    );
  }
  if (theme.fontMonoFamily) {
    root.style.setProperty(
      "--font-adw-mono",
      `"${theme.fontMonoFamily}", "Adwaita Mono", ui-monospace, monospace`,
    );
  }
}

export function postToShell(msg: AppToShellMessage) {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage(msg, "*");
}

export interface IsolatedFsEntry {
  name: string;
  path: string;
  kind: "file" | "directory";
}

export interface IsolatedAppBridge {
  windowId: string;
  isCsd: boolean;
  closeWindow: () => void;
  minimizeWindow: () => void;
  toggleMaximizeWindow: () => void;
  resizeWindow: (width: number, height: number) => void;
  setTitle: (title: string) => void;
  notify: (summary: string, body?: string) => void;
  fs: {
    readText: (path: string) => Promise<string | null>;
    writeText: (path: string, content: string) => Promise<boolean>;
    listDir: (path: string) => Promise<IsolatedFsEntry[]>;
  };
}

export function useIsolatedAppBridge(
  defaultWindowId = "",
  defaultIsCsd = true,
  onAction?: (actionId: string) => void,
): IsolatedAppBridge {
  const [windowId, setWindowId] = React.useState(defaultWindowId);
  const [isCsd, setIsCsd] = React.useState(defaultIsCsd);
  const [localeTick, setLocaleTick] = React.useState(0);
  React.useEffect(
    () => subscribeLocale(() => setLocaleTick((t) => t + 1)),
    [],
  );
  const onActionRef = React.useRef(onAction);
  onActionRef.current = onAction;
  const pendingFsRequestsRef = React.useRef(
    new Map<
      string,
      { resolve: (val: unknown) => void; reject: (err: Error) => void }
    >(),
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const onMessage = (e: MessageEvent) => {
      const data = e.data as ShellToAppMessage | undefined;
      if (!data || typeof data !== "object" || !("type" in data)) return;
      if (data.type === "piloti:theme-sync") {
        setWindowId(data.windowId);
        setIsCsd(data.isCsd);
        applyThemeToDocument(document, data);
      } else if (data.type === "piloti:app-action") {
        onActionRef.current?.(data.actionId);
      } else if (data.type === "piloti:fs-response") {
        const pending = pendingFsRequestsRef.current.get(data.requestId);
        if (pending) {
          pendingFsRequestsRef.current.delete(data.requestId);
          if (data.ok) {
            pending.resolve(data.data);
          } else {
            pending.reject(new Error(data.error ?? "FS request failed"));
          }
        }
      }
    };

    const onPointerDown = () => {
      if (windowId) {
        postToShell({ type: "piloti:focus-window", windowId });
      }
    };

    const onCustomAction = (e: Event) => {
      const detail = (
        e as CustomEvent<{ windowId?: string; actionId?: string }>
      ).detail;
      if (!detail?.actionId) return;
      if (detail.windowId && windowId && detail.windowId !== windowId) return;
      onActionRef.current?.(detail.actionId);
    };

    window.addEventListener("message", onMessage);
    window.addEventListener("piloti:app-action", onCustomAction);
    window.addEventListener("pointerdown", onPointerDown, true);
    if (windowId) {
      postToShell({ type: "piloti:ready", windowId });
    }
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("piloti:app-action", onCustomAction);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [windowId]);

  const sendFsRpc = React.useCallback(
    <T,>(
      buildMsg: (requestId: string) => AppToShellMessage,
    ): Promise<T> => {
      const requestId = `fs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return new Promise<T>((resolve, reject) => {
        pendingFsRequestsRef.current.set(requestId, {
          resolve: resolve as (val: unknown) => void,
          reject,
        });
        postToShell(buildMsg(requestId));
      });
    },
    [],
  );

  return React.useMemo<IsolatedAppBridge>(
    () => ({
      windowId,
      isCsd,
      closeWindow: () =>
        postToShell({
          type: "piloti:window-control",
          windowId,
          action: "close",
        }),
      minimizeWindow: () =>
        postToShell({
          type: "piloti:window-control",
          windowId,
          action: "minimize",
        }),
      toggleMaximizeWindow: () =>
        postToShell({
          type: "piloti:window-control",
          windowId,
          action: "maximize",
        }),
      resizeWindow: (width: number, height: number) =>
        postToShell({
          type: "piloti:resize-window",
          windowId,
          width,
          height,
        }),
      setTitle: (title: string) =>
        postToShell({ type: "piloti:set-title", windowId, title }),
      notify: (summary: string, body?: string) =>
        postToShell({ type: "piloti:notify", windowId, summary, body }),
      fs: {
        readText: async (path: string) => {
          if (typeof window !== "undefined" && window.parent === window) {
            const isBrowser = isWebEngine();
            const domicileFiles = !isBrowser
              ? (window as unknown as { __PILOTI__?: { domicile?: { files?: { readText: (p: string) => Promise<{ match: <R>(h: { Ok: (v: string) => R; Err: () => R }) => R }> } } } }).__PILOTI__?.domicile?.files
              : undefined;
            if (domicileFiles) {
              const res = await domicileFiles.readText(path).catch(() => null);
              if (res) return res.match({ Ok: (t) => t, Err: () => null });
            }
            const entry = getVfsEntry(path);
            return entry?.kind === "file" ? (entry.content ?? "") : null;
          }
          return sendFsRpc<string | null>((requestId) => ({
            type: "piloti:fs-read",
            windowId,
            requestId,
            path,
          }));
        },
        writeText: async (path: string, content: string) => {
          if (typeof window !== "undefined" && window.parent === window) {
            const isBrowser = isWebEngine();
            const domicileFiles = !isBrowser
              ? (window as unknown as { __PILOTI__?: { domicile?: { files?: { write: (p: string, d: string) => Promise<unknown> } } } }).__PILOTI__?.domicile?.files
              : undefined;
            if (domicileFiles) {
              await domicileFiles.write(path, content);
              return true;
            }
            writeVfsTextFile(path, content);
            return true;
          }
          return sendFsRpc<boolean>((requestId) => ({
            type: "piloti:fs-write",
            windowId,
            requestId,
            path,
            content,
          }));
        },
        listDir: async (path: string) => {
          if (typeof window !== "undefined" && window.parent === window) {
            const isBrowser = isWebEngine();
            const domicileFiles = !isBrowser
              ? (window as unknown as { __PILOTI__?: { domicile?: { files?: { readDir: (p: string) => Promise<{ match: <R>(h: { Ok: (v: Array<{ name: string; fileType: number }>) => R; Err: () => R }) => R }> } } } }).__PILOTI__?.domicile?.files
              : undefined;
            if (domicileFiles) {
              const res = await domicileFiles.readDir(path).catch(() => null);
              if (res) {
                return res.match({
                  Ok: (list) =>
                    list.map((e) => ({
                      name: e.name,
                      kind: e.fileType === 1 ? ("directory" as const) : ("file" as const),
                      path: `${path.replace(/\/+$/, "")}/${e.name}`,
                    })),
                  Err: () => [],
                });
              }
            }
            return listVfsDir(path).map((e) => ({
              name: e.name,
              kind: e.kind,
              path: e.path,
            }));
          }
          return sendFsRpc<IsolatedFsEntry[]>((requestId) => ({
            type: "piloti:fs-list",
            windowId,
            requestId,
            path,
          }));
        },
      },
    }),
    [isCsd, localeTick, sendFsRpc, windowId],
  );
}

export interface AppMenuItemState {
  checked?: boolean;
  disabled?: boolean;
}

const windowMenuStateMap = new Map<string, Record<string, AppMenuItemState>>();
const MENU_STATE_EVENT = "piloti:app-menu-state";

/**
 * Publishes per-window menu item state (checkboxes / disabled flags) so the
 * global MenuBar reflects live app state for the focused window.
 */
export function publishWindowMenuState(
  windowId: string,
  state: Record<string, AppMenuItemState>,
): void {
  if (!windowId || typeof window === "undefined") return;
  windowMenuStateMap.set(windowId, state);
  window.dispatchEvent(
    new CustomEvent(MENU_STATE_EVENT, { detail: { windowId, state } }),
  );
}

/**
 * Subscribes to live menu item state for `windowId`.
 */
export function useWindowMenuState(
  windowId: string | null,
): Record<string, AppMenuItemState> {
  const [state, setState] = React.useState<Record<string, AppMenuItemState>>(
    () => (windowId ? (windowMenuStateMap.get(windowId) ?? {}) : {}),
  );

  React.useEffect(() => {
    setState(windowId ? (windowMenuStateMap.get(windowId) ?? {}) : {});
    if (!windowId) return;
    const onUpdate = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          windowId?: string;
          state?: Record<string, AppMenuItemState>;
        }>
      ).detail;
      if (detail?.windowId === windowId && detail.state) {
        setState(detail.state);
      }
    };
    window.addEventListener(MENU_STATE_EVENT, onUpdate);
    return () => window.removeEventListener(MENU_STATE_EVENT, onUpdate);
  }, [windowId]);

  return state;
}

