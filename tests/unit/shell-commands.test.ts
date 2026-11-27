import { describe, expect, test } from "bun:test";
import {
  dispatchPilotiShellCommand,
  shellCommandAnswer,
  shellCommandNumber,
  shellCommandWords,
  resolvePilotiCommandAppId,
  type PilotiShellCommandHandlers,
} from "@/shell/desktop/shell-commands";

function createRecorder() {
  const calls: Array<{ fn: string; args: unknown[] }> = [];
  const handlers: PilotiShellCommandHandlers = {
    launchApp: (appId, options) => calls.push({ fn: "launchApp", args: [appId, options] }),
    openWebUrl: (url, options) => calls.push({ fn: "openWebUrl", args: [url, options] }),
    setLauncherOpen: (open) => calls.push({ fn: "setLauncherOpen", args: [open] }),
    toggleOverview: () => calls.push({ fn: "toggleOverview", args: [] }),
    lockSession: () => calls.push({ fn: "lockSession", args: [] }),
    requestPowerAction: (action) => calls.push({ fn: "requestPowerAction", args: [action] }),
    takeScreenshot: () => calls.push({ fn: "takeScreenshot", args: [] }),
    startScreenRecording: () => calls.push({ fn: "startScreenRecording", args: [] }),
    installWebApp: (url) => calls.push({ fn: "installWebApp", args: [url] }),
    removeWebApp: (target) => calls.push({ fn: "removeWebApp", args: [target] }),
  };
  return { calls, handlers };
}

describe("shell-commands (domicile send-shell dispatcher)", () => {
  test("resolves piloti-* wrapper commands and friendly aliases to built-in app IDs", () => {
    expect(resolvePilotiCommandAppId("piloti-files")).toBe("nautilus");
    expect(resolvePilotiCommandAppId("piloti-texts")).toBe("texts");
    expect(resolvePilotiCommandAppId("piloti-applications")).toBe("app-store");
    expect(resolvePilotiCommandAppId("piloti-console")).toBe("console");
    expect(resolvePilotiCommandAppId("piloti-desktop")).toBe("console");
    expect(resolvePilotiCommandAppId("piloti-shell")).toBe("terminal");
    expect(resolvePilotiCommandAppId("piloti-settings")).toBe("settings");
    expect(resolvePilotiCommandAppId("calculator")).toBe("calculator");
  });

  test("dispatches open for built-in apps, payloads, URLs, and --app web apps", () => {
    const { calls, handlers } = createRecorder();

    expect(dispatchPilotiShellCommand(["open", "nautilus", "/home/user/Documents"], handlers)).toBe(true);
    expect(dispatchPilotiShellCommand(["open", "https://example.com"], handlers)).toBe(true);
    expect(dispatchPilotiShellCommand(["open", "--app", "https://excalidraw.com"], handlers)).toBe(true);
    expect(dispatchPilotiShellCommand(["piloti-texts", "/tmp/note.txt"], handlers)).toBe(true);

    expect(calls).toEqual([
      { fn: "launchApp", args: ["nautilus", { payload: "/home/user/Documents" }] },
      { fn: "openWebUrl", args: ["https://example.com/", undefined] },
      { fn: "openWebUrl", args: ["https://excalidraw.com/", { asApp: true }] },
      { fn: "launchApp", args: ["texts", { payload: "/tmp/note.txt" }] },
    ]);
  });

  test("dispatches settings, session, overlay, capture, and web-app lifecycle commands", () => {
    const { calls, handlers } = createRecorder();

    expect(dispatchPilotiShellCommand(["settings", "dock"], handlers)).toBe(true);
    expect(dispatchPilotiShellCommand(["launcher"], handlers)).toBe(true);
    expect(dispatchPilotiShellCommand(["overview"], handlers)).toBe(true);
    expect(dispatchPilotiShellCommand(["lock"], handlers)).toBe(true);
    expect(dispatchPilotiShellCommand(["logout"], handlers)).toBe(true);
    expect(dispatchPilotiShellCommand(["restart"], handlers)).toBe(true);
    expect(dispatchPilotiShellCommand(["poweroff"], handlers)).toBe(true);
    expect(dispatchPilotiShellCommand(["screenshot"], handlers)).toBe(true);
    expect(dispatchPilotiShellCommand(["record"], handlers)).toBe(true);
    expect(dispatchPilotiShellCommand(["install", "https://squoosh.app"], handlers)).toBe(true);
    expect(dispatchPilotiShellCommand(["remove", "https://squoosh.app"], handlers)).toBe(true);
    expect(dispatchPilotiShellCommand(["nonexistent"], handlers)).toBe(false);
    expect(dispatchPilotiShellCommand([], handlers)).toBe(false);

    expect(calls).toEqual([
      { fn: "launchApp", args: ["settings", { payload: "dock" }] },
      { fn: "setLauncherOpen", args: [true] },
      { fn: "toggleOverview", args: [] },
      { fn: "lockSession", args: [] },
      { fn: "requestPowerAction", args: ["logout"] },
      { fn: "requestPowerAction", args: ["restart"] },
      { fn: "requestPowerAction", args: ["poweroff"] },
      { fn: "takeScreenshot", args: [] },
      { fn: "startScreenRecording", args: [] },
      { fn: "installWebApp", args: ["https://squoosh.app"] },
      { fn: "removeWebApp", args: ["https://squoosh.app"] },
    ]);
  });
});

describe("shell command stream shapes", () => {
  test("reads words from SDK 2 arrays and Domicile 1.3 objects", () => {
    expect(shellCommandWords(["open", "nautilus"])).toEqual(["open", "nautilus"]);
    expect(shellCommandWords({ words: ["launcher"], sent: 7 })).toEqual(["launcher"]);
    expect(shellCommandNumber(["launcher"])).toBeUndefined();
    expect(shellCommandNumber({ words: ["launcher"], sent: 7 })).toBe(7);
  });

  test("answers ran, or why not, through match", () => {
    const arms = { Ok: (done: string) => `ok:${done}`, Err: (why: string) => `err:${why}` };
    expect(shellCommandAnswer(true, "no").match(arms)).toBe("ok:ran");
    expect(shellCommandAnswer(false, "no such command").match(arms)).toBe("err:no such command");
  });
});

describe("theme command", () => {
  test("passes a known mode and refuses anything else", () => {
    const modes: string[] = [];
    const { handlers } = createRecorder();
    handlers.setTheme = (mode) => modes.push(mode);

    expect(dispatchPilotiShellCommand(["theme", "Dark"], handlers)).toBe(true);
    expect(dispatchPilotiShellCommand(["theme", "toggle"], handlers)).toBe(true);
    expect(dispatchPilotiShellCommand(["theme", "blue"], handlers)).toBe(false);
    expect(dispatchPilotiShellCommand(["theme"], handlers)).toBe(false);
    expect(modes).toEqual(["dark", "toggle"]);
  });
});
