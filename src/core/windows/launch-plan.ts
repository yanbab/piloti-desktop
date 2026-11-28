/**
 * What opening an app means: go to a window that has it, open one in the shell,
 * start it on its own, or run a program. Decisions only; the window manager
 * carries them out.
 */
import { moduleDocument, resolveAppModuleByUrl } from "@/core/data/app-modules";
import type { AppDefinition, BuiltinAppId } from "@/core/data/catalog";
import type { RunIn } from "@/core/windows/run-mode";
import { DOCUMENT_SCOPED_APP_IDS } from "@/core/windows/spatial-window-bounds";
import type { DesktopWindowInstance } from "@/core/windows/types";

export interface LaunchRequest {
  payload?: string;
  forceNew?: boolean;
  forceCsd?: boolean;
  /** Not on its own, whatever the setting: its module could not start. */
  inShell?: boolean;
}

export interface LaunchContext {
  windows: readonly DesktopWindowInstance[];
  /** The catalog entry of the app, if it has one. */
  definition?: AppDefinition;
  /** Installed applications, for those the shell does not draw. */
  programs: readonly { appId: string; desktopId: string; execArgv: readonly string[] }[];
  runIn(appId: string): RunIn;
  /** App modules and programs can run. */
  systemServices: boolean;
  /** The address a Web Browser launch goes to. */
  browserUrl: string;
}

export type LaunchPlan =
  /** Ask for something else instead. */
  | { kind: "instead"; appId: string; options: LaunchRequest }
  /** Go to a window, after giving it what the request brings. */
  | { kind: "focus"; windowId: string; patch?: { payload?: string; clientFrame?: boolean }; openTab?: string }
  /** A new Web Browser window. */
  | { kind: "browser"; url: string }
  /** The app's module, in its own process. */
  | { kind: "module"; builtin: BuiltinAppId }
  /** A window of the shell (`isolated`: a frame, in the demo). */
  | { kind: "shell"; builtin: BuiltinAppId; isolated: boolean }
  | { kind: "program"; argv: readonly string[] };

/** The shell's own drawing of `appId`, if it has one. */
function builtinOf(appId: string, definition?: AppDefinition): BuiltinAppId | undefined {
  if (definition?.builtinComponent) return definition.builtinComponent;
  if (appId === "settings" || appId === "console" || appId === "terminal") return appId;
  return appId === "nautilus" ? "files" : undefined;
}

/** One window per document: two editors of a file would save over each other. */
const ONE_PER_DOCUMENT = new Set(["texts", "image-viewer"]);

/** The window already open that answers the request, if any. */
function openWindow(appId: string, request: LaunchRequest, windows: readonly DesktopWindowInstance[]) {
  const { payload, forceNew } = request;
  if (!forceNew) {
    const lower = appId.toLowerCase();
    return windows.find((w) => {
      const desktopId = w.waylandDesktopId?.toLowerCase();
      const same =
        w.appId.toLowerCase() === lower ||
        desktopId === lower ||
        desktopId?.replace(/\.desktop$/, "") === lower;
      return same && (!(DOCUMENT_SCOPED_APP_IDS.has(appId) && payload) || w.payload === payload);
    });
  }
  // A new window was asked for, but not a second one of the same folder or document.
  if (!payload || !(appId === "nautilus" || ONE_PER_DOCUMENT.has(appId))) return undefined;
  return windows.find((w) => w.appId === appId && w.payload === payload);
}

export function planLaunch(appId: string, request: LaunchRequest, context: LaunchContext): LaunchPlan {
  const { windows } = context;
  const { payload } = request;

  // Advanced settings are in Devtools.
  if (appId === "settings" && payload === "advanced") {
    return { kind: "instead", appId: "console", options: { payload: "advanced" } };
  }

  if (appId === "browser") {
    const existing = request.forceNew
      ? undefined
      : windows.find((w) => w.appId === "browser" && w.browserWindowId);
    // Like other browsers: a link opens as a tab of the open window.
    return existing
      ? { kind: "focus", windowId: existing.id, ...(payload ? { openTab: context.browserUrl } : {}) }
      : { kind: "browser", url: context.browserUrl };
  }

  const existing = openWindow(appId, request, windows);
  if (existing) {
    const changes =
      !request.forceNew &&
      (payload || request.forceCsd !== undefined) &&
      !existing.id.startsWith("wayland:");
    return {
      kind: "focus",
      windowId: existing.id,
      ...(changes
        ? {
            patch: {
              payload: payload ?? existing.payload,
              clientFrame: request.forceCsd ?? existing.clientFrame,
            },
          }
        : {}),
    };
  }

  const builtin = builtinOf(appId, context.definition);
  if (builtin) {
    const isolated = !request.inShell && context.runIn(builtin) === "isolated";
    if (!isolated || !context.systemServices) return { kind: "shell", builtin, isolated };
    // A separate window says which document it has in its URL.
    const open =
      payload &&
      windows.find(
        (w) =>
          resolveAppModuleByUrl(w.browserUrl)?.id === builtin && moduleDocument(w.browserUrl) === payload,
      );
    return open ? { kind: "focus", windowId: open.id } : { kind: "module", builtin };
  }

  if (context.definition?.linuxCommand) {
    return { kind: "program", argv: context.definition.linuxCommand };
  }
  const lower = appId.toLowerCase();
  const installed = context.programs.find(
    (p) =>
      p.appId.toLowerCase() === lower ||
      p.desktopId.toLowerCase() === lower ||
      p.desktopId.toLowerCase() === `${lower}.desktop`,
  );
  if (installed && installed.execArgv.length > 0) return { kind: "program", argv: installed.execArgv };
  // Reverse-DNS ids with no entry are Flatpak apps.
  if (/^[\w-]+\.[\w-]+\.[\w.-]+$/.test(appId)) return { kind: "program", argv: ["flatpak", "run", appId] };
  return { kind: "program", argv: [appId] };
}

/** A double click can ask twice before the first window is there. */
export function createRepeatGuard(withinMs = 500, now: () => number = Date.now) {
  const asked = new Map<string, number>();
  return (key: string): boolean => {
    const time = now();
    if (time - (asked.get(key) ?? -Infinity) < withinMs) return true;
    asked.set(key, time);
    return false;
  };
}
