import { describe, expect, test } from "bun:test";
import { createLoopGuard, guardLoops } from "@/lib/shell/piloti-loops";
import { createRepl, evaluateLine } from "@/lib/shell/piloti-repl";
import { createWebVfs } from "@/lib/engine-web/vfs";
import { setDemoApps, demoPid } from "@/lib/engine/demo-processes";
import { parseSystemSample, readProcFiles } from "@/lib/engine-native/system-stats";

describe("piloti shell loop checks", () => {
  test("guarded code still means the same", async () => {
    const run = (code: string) => evaluateLine(code, { __loop: createLoopGuard(() => false) });
    expect(await run("let n = 0; for (;n < 3;) n++; return n")).toBe(3);
    expect(await run("let n = 0; for (let i = 0; i < 2; i++) for (const j of [1, 2]) if (j) n += j; else n--; return n")).toBe(6);
    expect(await run("let n = 0; do n++; while (n < 4)\nreturn n")).toBe(4);
    expect(await run("let n = 5; while (n --> 0); return n")).toBe(-1);
    expect(await run("const f = () => { let n = 0; while (n < 2) n++; return n }; return f()")).toBe(2);
    expect(await run("const o = { f() { for (;;) return 7 } }; return o.f()")).toBe(7);
    expect(guardLoops("const a = 'for while'")).toBe("const a = 'for while'");
  });

  test("a loop that cannot pause is stopped", async () => {
    const guard = createLoopGuard(() => false, 20);
    await expect(evaluateLine("(() => { while (true) {} })()", { __loop: guard })).rejects.toThrow("too long");
  });

  test("Ctrl+C ends endless loops, typed or in a script", async () => {
    let out = "";
    const repl = createRepl({ write: (t) => (out += t), scope: () => ({}) });
    repl.onData("while (true) {}\r");
    await new Promise((done) => setTimeout(done, 80));
    repl.onData("\x03");
    await new Promise((done) => setTimeout(done, 30));
    expect(out).toContain("interrupted");
    const script = repl.runScript("for (;;) {\n}", "s.psh");
    setTimeout(() => repl.dispose(), 30);
    await script;
  });
});

describe("demo /proc", () => {
  test("reads as Linux's does, with a process per running app", async () => {
    const vfs = createWebVfs({ files: {} as never });
    setDemoApps(["calculator"]);
    const sample = parseSystemSample(await readProcFiles({ vfs }))!;
    expect(sample.memTotalKb).toBeGreaterThan(sample.memAvailableKb);
    expect(sample.processes.get(demoPid("calculator"))?.name).toBe("calculator");
    expect((await vfs.stat("/proc/1"))?.kind).toBe("directory");
    expect(await vfs.stat("/proc/nope")).toBeNull();
  });
});
