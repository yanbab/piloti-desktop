/**
 * How a window runs, for DevTools: drawn by the shell's React tree, in a demo
 * iframe, as a Domicile app module or web page, or as a native client
 * (Wayland, or X11 through xwayland-satellite).
 */
import { _ } from "@/core/util/i18n";
import type { DesktopWindowInstance } from "@/core/windows/types";

export type WindowKind =
  | "shell"
  | "frame"
  | "module"
  | "web-app"
  | "web-page"
  | "wayland"
  | "x11"
  | "simulated";

type KindFields = Pick<
  DesktopWindowInstance,
  "builtinComponent" | "isolated" | "browserWindowId" | "browserUrl" | "browserIsApp" | "waylandAppId"
>;

/** The process X11 clients reach the compositor through (`ps -o comm` cuts it to 15). */
const isX11Bridge = (processName: string | undefined) =>
  Boolean(processName?.startsWith("xwayland-sat"));

/**
 * `compositor`: native clients are real (else the demo simulates them).
 * `processName`: the command of the window's `pid`, when known.
 */
export function windowKind(
  win: KindFields,
  { compositor, processName }: { compositor: boolean; processName?: string },
): WindowKind {
  if (win.waylandAppId) {
    if (!compositor) return "simulated";
    return isX11Bridge(processName) ? "x11" : "wayland";
  }
  if (win.browserWindowId) {
    if (win.browserIsApp && win.browserUrl?.startsWith("domicile://app-")) return "module";
    return win.browserIsApp ? "web-app" : "web-page";
  }
  if (win.builtinComponent && win.isolated) return "frame";
  return "shell";
}

export const windowKindLabel = (kind: WindowKind): string =>
  ({
    shell: _("Shell"),
    frame: _("Iframe"),
    module: _("App module"),
    "web-app": _("Web app"),
    "web-page": _("Web page"),
    wayland: _("Wayland"),
    x11: _("X11 (XWayland)"),
    simulated: _("Simulated Wayland"),
  })[kind];

export const windowKindHint = (kind: WindowKind): string =>
  ({
    shell: _("Drawn by the shell's React tree, in the shell's process"),
    frame: _("A built-in app in its own iframe (browser demo)"),
    module: _("A Domicile app module, in its own process"),
    "web-app": _("An installed web app, in its own Domicile web view"),
    "web-page": _("A web page, in a Domicile web view"),
    wayland: _("A native Wayland client"),
    x11: _("An X11 client, through xwayland-satellite"),
    simulated: _("A native client simulated by the browser demo"),
  })[kind];
