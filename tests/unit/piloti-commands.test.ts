import { describe, expect, test } from "bun:test";
import { createShellCommands } from "@/ui/apps/terminal/piloti-commands";
import { runLine, splitWords } from "@/ui/apps/terminal/piloti-repl";
import type { Vfs } from "@/core/ports/vfs";

/** Folders are `null`, files their text. */
function fakeVfs(files: Map<string, string | null>): Vfs {
  const kind = (path: string) => (files.get(path) === null ? "directory" : "file") as "directory" | "file";
  const entry = (path: string) => ({ name: path.slice(path.lastIndexOf("/") + 1), path, kind: kind(path) });
  const under = (path: string) => [...files.keys()].filter((p) => p === path || p.startsWith(`${path}/`));
  const copy = async (from: string, to: string) => {
    for (const p of under(from)) files.set(to + p.slice(from.length), files.get(p)!);
  };
  const remove = async (path: string) => void under(path).forEach((p) => files.delete(p));
  return {
    stat: async (p: string) => (files.has(p) ? { ...entry(p), realPath: p } : null),
    list: async (dir: string) =>
      files.get(dir) === null
        ? [...files.keys()].filter((p) => p !== dir && p.slice(0, p.lastIndexOf("/")) === dir).map(entry)
        : null,
    readText: async (p: string) => files.get(p) ?? null,
    write: async (p: string, data: string) => void files.set(p, data),
    createDir: async (p: string) => void files.set(p, null),
    copy,
    move: async (from: string, to: string) => {
      await copy(from, to);
      await remove(from);
    },
    remove,
  } as unknown as Vfs;
}

function setup() {
  const files = new Map<string, string | null>([["/h", null]]);
  const vfs = fakeVfs(files);
  const shell = createShellCommands({ vfs: () => vfs, home: "/h" });
  const scope: Record<string, unknown> = { ...shell.commands, join: (...a: unknown[]) => a, n: 5 };
  const run = (line: string) =>
    runLine(line, scope, { textCommands: new Set(Object.keys(shell.commands)), glob: shell.glob });
  return { files, shell, run };
}

describe("piloti shell commands", () => {
  test("command syntax calls functions; JavaScript stays JavaScript", async () => {
    const { run } = setup();
    expect(await run("join arg1 'other arg'")).toEqual(["arg1", "other arg"]);
    expect(await run("join 2 true '2' $n $(n + 1) {a: 'b c'}")).toEqual([2, true, "2", 5, 6, { a: "b c" }]);
    expect(await run("join")).toEqual([]);
    expect(await run("join('a')")).toEqual(["a"]);
    expect(await run("n + 1")).toBe(6);
    expect(() => splitWords("'open")).toThrow();
  });

  test("manages files relative to the current folder", async () => {
    const { files, shell, run } = setup();
    await run("mkdir docs 'my dir'");
    await run("cd docs");
    expect(shell.shortCwd()).toBe("docs");
    await run("touch a.txt b.txt 1");
    await run("mv a.txt c.txt");
    await run("cp *.txt '../my dir'");
    expect(await run("ls '../my dir'")).toBe("b.txt\nc.txt");
    await run("cd");
    await run("rm -r docs");
    expect([...files.keys()].filter((p) => p.startsWith("/h/docs"))).toEqual([]);
  });

  test("does not destroy files by mistake", async () => {
    const { files, run } = setup();
    await run("mkdir d");
    await run("touch f");
    await expect(run("cp f f")).rejects.toThrow("same file");
    await expect(run("rm d")).rejects.toThrow("use -r");
    await expect(run("rm -rf ~")).rejects.toThrow("refusing");
    await expect(run("mv d d")).rejects.toThrow();
    expect(files.has("/h/f") && files.has("/h/d")).toBe(true);
  });
});
