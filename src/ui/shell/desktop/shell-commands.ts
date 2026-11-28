import { Err, Ok, type Result } from "@cprussin/option-result";
import type { CommandRan, ShellCommandHelp } from "@domicile-desktop/sdk/shell-command";
import { canonicalizeWebUrl } from "@/core/data/web-apps";

const THEME_MODES = ["dark", "light", "system", "toggle"] as const;
export type ThemeCommandMode = (typeof THEME_MODES)[number];

export interface PilotiShellCommandHandlers {
  launchApp: (appId: string, options?: { payload?: string }) => void;
  openWebUrl: (
    url: string,
    options?: { asApp?: boolean; title?: string }
  ) => void;
  setLauncherOpen: (open: boolean) => void;
  toggleOverview: () => void;
  lockSession: () => void;
  requestPowerAction: (action: "logout" | "restart" | "poweroff") => void;
  takeScreenshot: () => void | Promise<void>;
  startScreenRecording: () => void | Promise<void>;
  setTheme?: (mode: ThemeCommandMode) => void;
  installWebApp?: (url: string) => void | Promise<void>;
  removeWebApp?: (target: string) => void | Promise<void>;
}

const APP_ID_ALIASES: Record<string, string> = {
  "piloti-appstore": "app-store",
  "piloti-applications": "app-store",
  "piloti-app-store": "app-store",
  applications: "app-store",
  "piloti-calculator": "calculator",
  "piloti-selfies": "selfies",
  "piloti-demo": "piloti-demo",
  "piloti-hello-world": "hello-world",
  "piloti-system-monitor": "system-monitor",
  "piloti-browser": "browser",
  "piloti-console": "console",
  "piloti-desktop": "console",
  "piloti-devtools": "console",
  "piloti-files": "nautilus",
  files: "nautilus",
  folders: "nautilus",
  "piloti-image-viewer": "image-viewer",
  "piloti-login": "login-screen",
  "login-screen": "login-screen",
  "piloti-texts": "texts",
  notepad: "texts",
  "piloti-settings": "settings",
  "piloti-shell": "terminal",
  "piloti-terminal": "terminal",
};

/**
 * Resolves a Piloti CLI command name or friendly alias to a built-in Piloti app ID.
 */
export function resolvePilotiCommandAppId(raw: string): string {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  return APP_ID_ALIASES[lower] ?? trimmed;
}

/**
 * A command from `piloti.shell.commands()`: `{ words, sent }` to answer
 * (Domicile ≥ 1.3, SDK 3), or only its words from an older Domicile.
 */
export type IncomingShellCommand =
  | readonly string[]
  | { readonly words: readonly string[]; readonly sent: number };

export function shellCommandWords(command: IncomingShellCommand): readonly string[] {
  return Array.isArray(command) ? command : ((command as { words?: readonly string[] }).words ?? []);
}

/** The number `shell.answer` names, when the runtime expects an answer. */
export function shellCommandNumber(command: IncomingShellCommand): number | undefined {
  if (Array.isArray(command)) return undefined;
  const sent = (command as { sent?: unknown }).sent;
  return typeof sent === "number" ? sent : undefined;
}

/** The answer for `shell.answer(sent, …)`: `Ok("ran")`, or `Err(why)`. */
export function shellCommandAnswer(ran: boolean, refused: string): Result<CommandRan, string> {
  return ran ? Ok<CommandRan, string>("ran") : Err<CommandRan, string>(refused);
}

/** What `domicile list-shell-commands` prints for Piloti. */
export const PILOTI_SHELL_COMMAND_HELP: readonly ShellCommandHelp[] = [
  { usage: "open [--app] <app|url|file> [arg]", description: "Open a built-in app, a URL (as an app with --app) or a file" },
  { usage: "settings [pane]", description: "Open Settings, at a pane if given" },
  { usage: "launcher", description: "Open the Launcher" },
  { usage: "overview", description: "Toggle the Overview" },
  { usage: "theme dark|light|system|toggle", description: "Change the color scheme" },
  { usage: "lock", description: "Lock the screen" },
  { usage: "logout|restart|poweroff", description: "Ask to log out, restart or power off" },
  { usage: "screenshot", description: "Take a screenshot" },
  { usage: "record", description: "Start a screen recording" },
  { usage: "install|add <url>", description: "Install a web app" },
  { usage: "remove|del|uninstall <url|id>", description: "Remove a web app" },
];

/**
 * Dispatches a `domicile send-shell <words...>` command array into Piloti shell actions.
 * Returns `true` when the command was recognized and dispatched.
 */
export function dispatchPilotiShellCommand(
  rawArgs: readonly string[],
  handlers: PilotiShellCommandHandlers
): boolean {
  const args = rawArgs.map((s) => s.trim()).filter((s) => s.length > 0);
  if (args.length === 0) return false;

  const head = args[0].toLowerCase();
  const rest = args.slice(1);

  if (head === "open") {
    if (rest.length === 0) return false;
    let asApp = false;
    let idx = 0;
    if (rest[0] === "--app") {
      asApp = true;
      idx = 1;
    }
    const target = rest[idx];
    if (!target) return false;
    const payload = rest.slice(idx + 1).join(" ").trim() || undefined;

    if (asApp || /^https?:\/\//i.test(target)) {
      const canonical = canonicalizeWebUrl(target) ?? target;
      handlers.openWebUrl(canonical, asApp ? { asApp: true } : undefined);
      return true;
    }

    const appId = resolvePilotiCommandAppId(target);
    handlers.launchApp(appId, payload ? { payload } : undefined);
    return true;
  }

  if (head === "settings") {
    const pane = rest[0];
    handlers.launchApp("settings", pane ? { payload: pane } : undefined);
    return true;
  }

  if (head === "launcher") {
    handlers.setLauncherOpen(true);
    return true;
  }

  if (head === "overview") {
    handlers.toggleOverview();
    return true;
  }

  if (head === "theme") {
    const mode = THEME_MODES.find((m) => m === rest[0]?.toLowerCase());
    if (!mode || !handlers.setTheme) return false;
    handlers.setTheme(mode);
    return true;
  }

  if (head === "lock") {
    handlers.lockSession();
    return true;
  }

  if (head === "logout" || head === "restart" || head === "poweroff") {
    handlers.requestPowerAction(head);
    return true;
  }

  if (head === "screenshot") {
    void handlers.takeScreenshot();
    return true;
  }

  if (head === "record") {
    void handlers.startScreenRecording();
    return true;
  }

  if (head === "install" || head === "add") {
    const url = rest[0];
    if (!url || !handlers.installWebApp) return false;
    void handlers.installWebApp(url);
    return true;
  }

  if (head === "remove" || head === "del" || head === "uninstall") {
    const target = rest[0];
    if (!target || !handlers.removeWebApp) return false;
    void handlers.removeWebApp(target);
    return true;
  }

  if (APP_ID_ALIASES[head]) {
    const payload = rest.join(" ").trim() || undefined;
    handlers.launchApp(APP_ID_ALIASES[head], payload ? { payload } : undefined);
    return true;
  }

  return false;
}
