import { describe, expect, test } from "bun:test";
import { createRepl, evaluateLine, formatValue, evaluateWithoutEval } from "@/apps/terminal/piloti-repl";

describe("piloti repl", () => {
  test("evaluates expressions and statements with the scope in reach", async () => {
    const scope = { two: 2, add: (a: number, b: number) => a + b };
    expect(await evaluateLine("add(two, 3)", scope)).toBe(5);
    expect(await evaluateLine("const x = add(1, 1); return x * 10", scope)).toBe(20);
    expect(await evaluateLine("await Promise.resolve(7)", scope)).toBe(7);
  });

  test("formats values for a terminal", () => {
    expect(formatValue(undefined)).toBe("");
    expect(formatValue("hi")).toBe("hi");
    expect(formatValue({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  test("edits a line, runs it on Enter, prints the result or the error, and recalls history", async () => {
    let out = "";
    const repl = createRepl({ write: (t) => (out += t), scope: () => ({ n: 41 }) });
    repl.start();
    repl.onData("n+1");
    repl.onData("\r");
    await new Promise((r) => setTimeout(r, 10));
    expect(out).toContain("42\r\n");
    out = "";
    repl.onData("boom(");
    repl.onData("\r");
    await new Promise((r) => setTimeout(r, 10));
    expect(out).toContain("\x1b[31m");
    out = "";
    repl.onData("\x1b[A");
    expect(out).toContain("boom(");
  });
});

describe("where eval is blocked (Linux)", () => {
  test("calls, expressions and await still work", async () => {
    const scope = { run: async (cmd: string) => ({ stdout: cmd.toUpperCase() }), n: 2 };
    expect(await evaluateWithoutEval('run("echo hi")', scope)).toEqual({ stdout: "ECHO HI" });
    expect(await evaluateWithoutEval('(await run("a")).stdout + n', scope)).toBe("A2");
  });
  test("loops say why they can't run", async () => {
    await expect(evaluateWithoutEval("for (const a of []) {}", {})).rejects.toThrow("need eval");
  });
});
