import { describe, expect, test } from "bun:test";
import { Ok } from "@cprussin/option-result";
import { documentHash, moduleDocument, moduleInstance } from "@/core/data/app-modules";
import {
  createModuleChannel,
  newModuleId,
  parseAppDragEvent,
  parseRequestWords,
  parseStateWords,
  requestWords,
  type ShellMessage,
  stateWords,
} from "@/core/apps/module-channel";
import { createModuleShell } from "@/core/apps/module-shell";
import type { ShellWindow } from "@/core/ports/shell-host";
import { toShellWindows } from "@/core/windows/shell-windows";

/** A module's host: records the programs run, and `signal` plays the shell. */
function fakeHost() {
  const ran: string[][] = [];
  let controller: ReadableStreamDefaultController<unknown>;
  const items = new ReadableStream({ start: (c) => void (controller = c) });
  const host = {
    processes: {
      run: async (argv: string[]) => {
        ran.push(argv);
        return Ok({ code: 0, stdout: "", stderr: "" });
      },
    },
    dbus: { match: async () => Ok({ items }) },
  } as never;
  // The shape the SDK delivers, as seen on Linux.
  const signal = async (message: ShellMessage) => {
    controller.enqueue({ kind: 0, item: { body: [JSON.stringify(message)] } });
    await new Promise((r) => setTimeout(r, 5));
  };
  return { host, ran, signal };
}

describe("module channel", () => {
  test("sends the whole state, once per change", async () => {
    const { host, ran } = fakeHost();
    const channel = createModuleChannel(host, "a-1");
    await channel.publish({ menu: { "x:y": { checked: true } } });
    await channel.publish({ size: { width: 10, height: 20 } });
    await channel.publish({ size: { width: 10, height: 20 } });
    expect(ran).toHaveLength(2);
    expect(ran[1]!.slice(0, 2)).toEqual(["piloti", "send"]);
    expect(parseStateWords(ran[1]!.slice(2))).toEqual({
      id: "a-1",
      state: { menu: { "x:y": { checked: true } }, size: { width: 10, height: 20 } },
    });
  });

  test("hears its own actions only, and resends when asked", async () => {
    const { host, ran, signal } = fakeHost();
    const channel = createModuleChannel(host, "a-1");
    const got: string[] = [];
    channel.onAction((actionId) => got.push(actionId));
    await signal({ to: "other", type: "action", actionId: "x:not-mine" });
    await signal({ to: "a-1", type: "action", actionId: "x:one" });
    expect(got).toEqual(["x:one"]);
    await signal({ to: "a-1", type: "sync" });
    expect(ran).toHaveLength(1);
  });

  test("a state stays one word, whatever it holds", () => {
    const state = { menu: { "a b'\"": { checked: false } } };
    const words = stateWords("a-1", state);
    expect(words[2]).not.toMatch(/\s/);
    expect(parseStateWords(words)).toEqual({ id: "a-1", state });
    expect(parseStateWords(["open", "texts"])).toBeNull();
    expect(parseStateWords(["piloti-ipc", "a-1", "%"])).toBeNull();
  });

  test("a module's URL carries its file and its name", () => {
    const id = newModuleId();
    const url = `domicile://app-abc/${documentHash("/a & b#.txt", id)}`;
    expect(moduleDocument(url)).toBe("/a & b#.txt");
    expect(moduleInstance(url)).toBe(id);
    const blank = `domicile://app-abc/${documentHash("", id)}`;
    expect(moduleDocument(blank)).toBeNull();
    expect(moduleInstance(blank)).toBe(id);
  });

  test("asks the shell after the states it already sent", async () => {
    const { host, ran } = fakeHost();
    const channel = createModuleChannel(host, "a-1");
    void channel.publish({ ready: true });
    await channel.request({ do: "close-window", windowId: "w 1" });
    expect(ran).toHaveLength(2);
    expect(parseStateWords(ran[0]!.slice(2))?.state).toEqual({ ready: true });
    expect(parseRequestWords(ran[1]!.slice(2))).toEqual({
      id: "a-1",
      request: { do: "close-window", windowId: "w 1" },
    });
  });

  test("a request is one word, and only a known one is read", () => {
    const words = requestWords("a-1", { do: "focus-window", windowId: "a b'\"" });
    expect(words[2]).not.toMatch(/\s/);
    expect(parseRequestWords(words)?.request).toEqual({ do: "focus-window", windowId: "a b'\"" });
    expect(parseRequestWords(["piloti-ipc-do", "a-1", encodeURIComponent('{"do":"rm -rf"}')])).toBeNull();
    expect(parseRequestWords(stateWords("a-1", {}))).toBeNull();
    expect(parseStateWords(words)).toBeNull();
  });

  test("a module asks the shell to launch and open", () => {
    const read = (request: unknown) =>
      parseRequestWords(["piloti-ipc-do", "a-1", encodeURIComponent(JSON.stringify(request))])?.request ?? null;
    expect(read({ do: "launch", appId: "texts", payload: "/home/u/a.txt" })).toEqual({
      do: "launch",
      appId: "texts",
      payload: "/home/u/a.txt",
    });
    expect(read({ do: "launch" })).toBeNull();
    const app = { appId: "texts", desktopId: "piloti-texts.desktop", label: "Texts" };
    expect(read({ do: "open", path: "/home/u/a.txt", kind: "file", preferApp: app, extra: 1 })).toEqual({
      do: "open",
      path: "/home/u/a.txt",
      kind: "file",
      preferApp: app,
    });
    // Only absolute paths, and only the kinds there are.
    expect(read({ do: "open", path: "a.txt" })).toBeNull();
    expect(read({ do: "open", path: "/a", kind: "socket" })).toEqual({ do: "open", path: "/a" });
    expect(read({ do: "drop-items", paths: ["/a", "b", 3], x: -12.5, y: 40, copy: true })).toEqual({
      do: "drop-items",
      paths: ["/a"],
      x: -12.5,
      y: 40,
      copy: true,
    });
    expect(read({ do: "drop-items", paths: ["/a"], x: "1", y: 2 })).toBeNull();
    // A drag's paths; none (or none usable) ends it.
    expect(read({ do: "drag-items", paths: ["/a", "b"] })).toEqual({ do: "drag-items", paths: ["/a"] });
    expect(read({ do: "drag-items", paths: "x" })).toEqual({ do: "drag-items", paths: [] });
  });
});

describe("a drag the shell owns", () => {
  test("reads each event back, and nothing else", () => {
    expect(parseAppDragEvent({ state: "outside" })).toEqual({ state: "outside" });
    expect(parseAppDragEvent({ state: "leave", x: 1 })).toEqual({ state: "leave" });
    expect(parseAppDragEvent({ to: "m", type: "drag", state: "over", paths: ["/a", "b"], x: 3, y: 4 })).toEqual({
      state: "over",
      paths: ["/a"],
      x: 3,
      y: 4,
    });
    expect(parseAppDragEvent({ state: "drop", paths: ["/a"], x: 1, y: 2, copy: true })).toEqual({
      state: "drop",
      paths: ["/a"],
      x: 1,
      y: 2,
      copy: true,
    });
    // A place and a usable path, or nothing.
    expect(parseAppDragEvent({ state: "drop", paths: ["/a"], x: "1", y: 2 })).toBeNull();
    expect(parseAppDragEvent({ state: "over", paths: ["a"], x: 1, y: 2 })).toBeNull();
    expect(parseAppDragEvent({ state: "fly" })).toBeNull();
    expect(parseAppDragEvent(null)).toBeNull();
  });
});

describe("module shell", () => {
  const windows: ShellWindow[] = [
    { id: "w1", appId: "texts", title: "a.txt" },
    { id: "wayland:2", appId: "org.gnome.Nautilus", title: "Home", pid: 42 },
  ];

  test("watches the windows while someone listens", async () => {
    const { host, ran, signal } = fakeHost();
    const channel = createModuleChannel(host, "a-1");
    const shell = createModuleShell(channel);
    const seen: (readonly ShellWindow[])[] = [];
    const stop = shell.watchWindows((w) => seen.push(w));
    await new Promise((r) => setTimeout(r, 5));
    expect(parseStateWords(ran.at(-1)!.slice(2))?.state.watch).toEqual(["windows"]);

    await signal({ to: "other", type: "windows", windows: [] });
    await signal({ to: "a-1", type: "windows", windows });
    expect(seen).toEqual([windows]);

    // A second listener gets what is known without asking again.
    const second: (readonly ShellWindow[])[] = [];
    const stopSecond = shell.watchWindows((w) => second.push(w));
    expect(second).toEqual([windows]);
    expect(ran).toHaveLength(1);

    stopSecond();
    stop();
    await new Promise((r) => setTimeout(r, 5));
    expect(parseStateWords(ran.at(-1)!.slice(2))?.state.watch).toEqual([]);
  });

  test("closes and focuses through the shell", async () => {
    const { host, ran } = fakeHost();
    const shell = createModuleShell(createModuleChannel(host, "a-1"));
    shell.closeWindow("w1");
    shell.focusWindow("w2");
    await new Promise((r) => setTimeout(r, 5));
    expect(ran.map((argv) => parseRequestWords(argv.slice(2))?.request)).toEqual([
      { do: "close-window", windowId: "w1" },
      { do: "focus-window", windowId: "w2" },
    ]);
  });

  test("the shell gives its windows without its own fields", () => {
    expect(
      toShellWindows([
        { id: "w1", appId: "texts", title: "a.txt", pid: null },
        { id: "w2", appId: "x", title: "X", pid: 7 },
        { id: "w3", appId: "nautilus", title: "Music", pid: null, payload: "/home/u/Music" },
        { id: "w4", appId: "settings", title: "Settings", pid: null, payload: "wifi" },
      ]),
    ).toEqual([
      { id: "w1", appId: "texts", title: "a.txt" },
      { id: "w2", appId: "x", title: "X", pid: 7 },
      { id: "w3", appId: "nautilus", title: "Music", path: "/home/u/Music" },
      { id: "w4", appId: "settings", title: "Settings" },
    ]);
  });
});
