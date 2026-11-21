import { canonicalizeWebUrl } from "@/data/web-apps";

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
  installWebApp?: (url: string) => void | Promise<void>;
  removeWebApp?: (target: string) => void | Promise<void>;
}

const APP_ID_ALIASES: Record<string, string> = {
  "piloti-applications": "app-store",
  "piloti-app-store": "app-store",
  applications: "app-store",
  "piloti-calculator": "calculator",
  "piloti-console": "console",
  "piloti-desktop": "console",
  "piloti-devtools": "console",
  "piloti-files": "nautilus",
  files: "nautilus",
  folders: "nautilus",
  "piloti-image-viewer": "image-viewer",
  "piloti-notepad": "text-editor",
  notepad: "text-editor",
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
