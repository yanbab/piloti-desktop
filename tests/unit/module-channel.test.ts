import { describe, expect, test } from "bun:test";
import { Ok } from "@cprussin/option-result";
import { documentHash, moduleDocument, moduleInstance } from "@/core/data/app-modules";
import {
  createModuleChannel,
  newModuleId,
  parseStateWords,
  type ShellMessage,
  stateWords,
} from "@/core/apps/module-channel";

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
});
