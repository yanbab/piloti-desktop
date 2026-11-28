import * as React from "react";
import { ACCENT_COLORS, type AccentColorId } from "@/core/data/catalog";
import { subscribeLocale } from "@/core/util/i18n";

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
;

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


;

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
  root.style.setProperty("--ui-active-accent", accent.hex);
  if (theme.fontSansFamily) {
    root.style.setProperty(
      "--font-ui",
      `"${theme.fontSansFamily}", "Adwaita Sans", "Cantarell", system-ui, sans-serif`,
    );
  }
  if (theme.fontMonoFamily) {
    root.style.setProperty(
      "--font-ui-mono",
      `"${theme.fontMonoFamily}", "Adwaita Mono", ui-monospace, monospace`,
    );
  }
}

export function postToShell(msg: AppToShellMessage) {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage(msg, "*");
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
    }),
    [isCsd, localeTick, windowId],
  );
}

export interface AppMenuItemState {
  checked?: boolean;
  disabled?: boolean;
  /** Leaves the item out; its separator stays. */
  hidden?: boolean;
}

const windowMenuStateMap = new Map<string, Record<string, AppMenuItemState>>();
export const MENU_STATE_EVENT = "piloti:app-menu-state";

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


/** Menu actions chosen for `windowId`'s app. Returns stop. */
export function onAppAction(windowId: string, listener: (actionId: string) => void): () => void {
  const onEvent = (e: Event) => {
    const { windowId: to, actionId } = (e as CustomEvent).detail ?? {};
    if (actionId && (!to || to === windowId)) listener(actionId);
  };
  window.addEventListener("piloti:app-action", onEvent);
  return () => window.removeEventListener("piloti:app-action", onEvent);
}
