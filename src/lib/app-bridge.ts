import * as React from "react";
import { ACCENT_COLORS, type AccentColorId } from "@/data/catalog";

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
        readText: (path: string) =>
          sendFsRpc<string | null>((requestId) => ({
            type: "piloti:fs-read",
            windowId,
            requestId,
            path,
          })),
        writeText: (path: string, content: string) =>
          sendFsRpc<boolean>((requestId) => ({
            type: "piloti:fs-write",
            windowId,
            requestId,
            path,
            content,
          })),
        listDir: (path: string) =>
          sendFsRpc<IsolatedFsEntry[]>((requestId) => ({
            type: "piloti:fs-list",
            windowId,
            requestId,
            path,
          })),
      },
    }),
    [isCsd, sendFsRpc, windowId],
  );
}

