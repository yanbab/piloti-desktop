import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { publishWindows, shellApi } from "@/lib/engine/shell-api";
import { withVfs } from "@/lib/engine/with-vfs";

const ROOT = path.resolve(import.meta.dir, "../..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

const window = {
  id: "w1",
  appId: "texts",
  title: "Notes",
  workspace: 1,
  position: { x: 0, y: 0 },
  size: { width: 400, height: 300 },
  minimized: false,
  maximized: false,
};

describe("shell API", () => {
  it("changes the window list only when its content does", () => {
    let changes = 0;
    const stop = shellApi.desktop.windows.on("change", () => changes++);
    publishWindows([window]);
    const list = shellApi.desktop.windows.list;
    publishWindows([{ ...window }]);
    expect(shellApi.desktop.windows.list).toBe(list);
    expect(shellApi.desktop.windows.get("w1")?.title).toBe("Notes");
    publishWindows([]);
    stop();
    publishWindows([window]);
    expect(changes).toBe(2);
    publishWindows([]);
  });

  it("adds to piloti without touching Domicile's namespaces", () => {
    const notifications = { list: [] };
    const piloti = withVfs({ notifications } as never, {} as never);
    expect(piloti.desktop).toBe(shellApi.desktop);
    expect(piloti.settings).toBe(shellApi.settings);
    expect(piloti.plugins).toBe(shellApi.plugins);
    expect(piloti.notifications).toBe(notifications as never);
  });

  it("is described in docs/API.md, member by member", () => {
    const doc = read("docs/API.md");
    const source = read("src/lib/ports/shell-api.ts");
    const members = [...source.matchAll(/^  (?:readonly )?(\w+)\??[(:]/gm)].map((m) => m[1]);
    expect(members.length).toBeGreaterThan(20);
    expect(members.filter((name) => !new RegExp(`\\b${name}\\b`).test(doc))).toEqual([]);
  });
});
