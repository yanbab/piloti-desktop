import { describe, expect, test } from "bun:test";
import { complete } from "@/apps/terminal/piloti-completion";
import { createRepl, expandAliases, formatValue, runLine, type ProgramRunner } from "@/apps/terminal/piloti-repl";
import { createShellCommands } from "@/apps/terminal/piloti-commands";
import { runTop } from "@/apps/terminal/piloti-top";
import { runInTerminal } from "@/apps/terminal/piloti-run";
import type { Vfs } from "@/lib/ports/vfs";

const programs: ProgramRunner = {
  has: async (name) => ["git", "apt-get", "true", "find", "ls", "./run.sh"].includes(name),
  run: async (argv) => argv,
};

describe("piloti shell programs", () => {
  const run = (line: string, scope: Record<string, unknown> = {}) => runLine(line, scope, { programs });

  test("runs programs of $PATH; shell functions and JavaScript come first", async () => {
    expect(await run("git commit -m 'two words'")).toEqual(["git", "commit", "-m", "two words"]);
    expect(await run("apt-get install $name", { name: "vim" })).toEqual(["apt-get", "install", "vim"]);
    expect(await run("find . -name '*.ts'")).toEqual(["find", ".", "-name", "*.ts"]);
    expect(await run("./run.sh")).toEqual(["./run.sh"]);
    expect(await run("ls", { ls: () => "mine" })).toBe("mine");
    expect(await run("true")).toBe(true);
    expect(await run("git = 2; return git", {})).toBe(2);
    await expect(run("git log | head")).rejects.toThrow("not supported");
  });
});

describe("piloti shell tables", () => {
  test("prints arrays of objects, or their JSON, as tables without control codes", () => {
    const rows = [{ name: "a\x1b[2J", size: 1 }, { name: "bb", tags: ["x"] }];
    for (const value of [rows, JSON.stringify(rows)]) {
      const lines = formatValue(value, 80).split("\n");
      expect(lines[0]).toContain("name");
      expect(lines[1]).toMatch(/^─+$/);
      expect(lines[2]).toBe("a [2J 1");
      expect(lines[3]).toBe('bb         ["x"]');
    }
    expect(formatValue([1, 2])).toBe("[\n  1,\n  2\n]");
    const wide = formatValue([{ a: "x".repeat(100), b: "y".repeat(100) }], 30).split("\n");
    expect(wide[2]!.length).toBeLessThanOrEqual(30);
    const many = [{ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, name: "n" }];
    expect(formatValue(many)).toStartWith("name a b c d e\n");
    expect(formatValue(many)).toContain("2 more columns");
    expect(formatValue(many, 80, true)).toStartWith("a b c d e f g name\n");
  });

  test("holds a program's JSON array for a table, and streams anything else", async () => {
    const go = async (chunks: string[]) => {
      let out = "";
      const value = await runInTerminal({
        start: async (onOutput, onExit) => {
          setTimeout(() => {
            for (const c of chunks) onOutput(new TextEncoder().encode(c));
            onExit("done", 0);
          });
          return { write() {}, resize() {}, stop() {} };
        },
        write: (d) => (out += typeof d === "string" ? d : new TextDecoder().decode(d)),
        attach: () => {},
        hold: () => {},
      });
      return { value, out };
    };
    expect(await go(["[", '{"a":1}]\r\n'])).toEqual({ value: [{ a: 1 }], out: "" });
    expect(await go(["[sudo] password"])).toEqual({ value: undefined, out: "[sudo] password\r\n" });
  });
});

describe("piloti shell completion", () => {
  const entry = (name: string, kind = "file") => ({ name, path: `/h/${name}`, kind });
  const sources = {
    scope: { windows: () => [], files: { read: 1, readDir: 2 } },
    programs: async () => ["wc"],
    vfs: { list: async () => [entry("My Docs", "directory"), entry("notes.txt"), entry(".hidden")] } as unknown as Vfs,
    resolve: (p: string) => p,
  };
  const inserts = async (text: string) => (await complete(text, sources)).matches.map((m) => m.insert + m.end);

  test("completes commands, members and paths", async () => {
    expect(await inserts("w")).toEqual(["wc ", "windows "]);
    expect(await inserts("files.read")).toEqual(["files.read", "files.readDir"]);
    expect(await inserts("cat no")).toEqual(["notes.txt "]);
    expect(await inserts("cd My")).toEqual(["My\\ Docs/"]);
    expect(await inserts("cat 'no")).toEqual(["'notes.txt' "]);
    expect(await inserts("cat ")).toHaveLength(2);
  });

  test("Tab extends the line in the repl", async () => {
    let out = "";
    const repl = createRepl({ write: (t) => (out += t), scope: () => sources.scope, complete: (t) => complete(t, sources) });
    repl.onData("cat no");
    repl.onData("\t");
    await new Promise((r) => setTimeout(r, 10));
    expect(out).toContain("cat notes.txt ");
  });
});

describe("piloti shell scripts, aliases, ls and top", () => {
  const files = [
    { name: "pics", path: "/h/pics", kind: "directory" },
    { name: "a.png", path: "/h/a.png", kind: "file" },
    { name: ".rc", path: "/h/.rc", kind: "file" },
  ];
  const vfs = {
    stat: async (p: string) =>
      p === "/h" || p.startsWith("/h/pics")
        ? { kind: "directory", size: 4096, realPath: p, modifiedMs: 0 }
        : { kind: "file", size: 2048, realPath: p, modifiedMs: 0 },
    list: async (p: string) => (p === "/h" ? files : []),
  } as unknown as Vfs;

  test("ls colors names and has a long form; the prompt path is relative to home", async () => {
    const shell = createShellCommands({ vfs: () => vfs, home: "/h", color: true });
    expect(await shell.commands.ls()).toBe("\x1b[01;35ma.png\x1b[0m\n\x1b[01;34mpics\x1b[0m/");
    const long = (await shell.commands.ls("-lah")).split("\n");
    expect(long).toHaveLength(5);
    expect(long[0]).toStartWith("type size modified");
    expect(long[2]).toBe("file 2.0K Jan  1  1970 .rc");
    expect(shell.shortCwd()).toBe("");
    await shell.commands.cd("pics");
    expect(shell.shortCwd()).toBe("pics");
    await shell.commands.cd("/h");
  });

  test("aliases expand once; scripts stop at a failed command", async () => {
    const shell = createShellCommands({ vfs: () => vfs, home: "/h" });
    const { aliases } = shell;
    expect(expandAliases("ll pics", aliases)).toBe("ls -la pics");
    expect(expandAliases("more x", aliases)).toBe("cat x");
    expect(expandAliases("ll = 1", aliases)).toBe("ll = 1");
    await runLine("alias echo='echo hi'", { ...shell.commands }, { textCommands: new Set(["alias"]) });
    expect(expandAliases("echo you", aliases)).toBe("echo hi you");

    let out = "";
    const repl = createRepl({ write: (t) => (out += t), scope: () => ({ ...shell.commands }), aliases });
    await expect(repl.runScript("# note\necho one\nunalias nope\necho two", "s.psh")).rejects.toThrow("s.psh:3");
    expect(out).toBe("hi one\r\n");
    out = "";
    await repl.runScript("unalias nope\necho two", "autoexec.psh", { keepGoing: true });
    expect(out).toContain("autoexec.psh:1");
    expect(out).toContain("hi two");
  });

  test("a script is one program: variables, blocks and objects span lines", async () => {
    const echo = (...words: unknown[]) => words.join(" ");
    const seen: unknown[] = [];
    let out = "";
    const repl = createRepl({
      write: (t) => (out += t),
      scope: () => ({ echo, apps: () => seen, keep: (...a: unknown[]) => void seen.push(...a) }),
    });
    await repl.runScript(
      [
        "const apps = ['a', 'b']",
        "let total = 0",
        "for (const name of apps) {",
        "  echo item $name $(name.toUpperCase())",
        "  total += 1",
        "}",
        "const o = {",
        "  echo: 1,",
        "  keep",
        "    : 2",
        "}",
        "if (total === 2)",
        "  keep $o",
        "alias say='echo said'",
      ]
        .slice(0, -1)
        .join("\n"),
      "s.psh",
    );
    expect(out).toBe("item a A\r\nitem b B\r\n");
    expect(seen).toEqual([{ echo: 1, keep: 2 }]);
    await expect(repl.runScript("const x =", "bad.psh")).rejects.toThrow("bad.psh");
  });

  test("top draws busiest first and quits on q", async () => {
    let ticks = 0;
    let out = "";
    let keys = (_: string) => {};
    await runTop({
      sample: async () => {
        ticks += 100;
        const proc = (name: string, t: number) => ({ ppid: 0, name, ticks: t, rssKb: 1024 });
        return {
          cpuTotal: ticks, cpuIdle: ticks / 2, memTotalKb: 2048, memAvailableKb: 1024,
          processes: new Map([[1, proc("idle", 5)], [2, proc("busy", ticks / 4)]]),
        };
      },
      write: (t) => {
        out += t;
        if (t.includes("busy")) keys("q");
      },
      size: () => ({ cols: 60, rows: 10 }),
      capture: (handler) => (keys = handler),
      interval: 1,
    });
    expect(out.indexOf("busy")).toBeLessThan(out.indexOf("idle"));
    expect(out.endsWith("\x1b[?1049l")).toBe(true);
  });
});
