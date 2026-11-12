import { describe, expect, test } from "bun:test";
import { evaluateReplCode, formatInspectValue } from "./console-store";
import { evaluateCspSafe } from "./csp-repl-eval";

describe("console-store REPL and formatter", () => {
  test("evaluates single expressions and async calls against scope", async () => {
    const scope = {
      x: 21,
      double: async (n: number) => n * 2,
    };
    expect(await evaluateReplCode("x + 1", scope)).toBe(22);
    expect(await evaluateReplCode("await double(x)", scope)).toBe(42);
  });

  test("falls back to statement mode when expression return fails", async () => {
    const res = await evaluateReplCode("const a = 5; return a * 3;", {});
    expect(res).toBe(15);
  });

  test("formats objects cleanly and guards circular references", () => {
    const obj: Record<string, unknown> = { name: "piloti" };
    obj.self = obj;
    const formatted = formatInspectValue(obj);
    expect(formatted).toContain('name: "piloti"');
    expect(formatted).toContain("self: [Circular]");
  });

  test("evaluates expressions, await, arrows, and objects in CSP-safe mode", async () => {
    const scope = {
      windows: [{ title: "Settings" }, { title: "Console" }],
      run: async (cmd: string) => `ok:${cmd}`,
      updateSettings: (patch: Record<string, unknown>) => patch,
    };

    expect(await evaluateCspSafe('await run("uname -a")', scope)).toBe(
      "ok:uname -a"
    );
    expect(await evaluateCspSafe("windows.map(w => w.title)", scope)).toEqual([
      "Settings",
      "Console",
    ]);
    expect(
      await evaluateCspSafe('updateSettings({ uiTheme: "adwaita" })', scope)
    ).toEqual({ uiTheme: "adwaita" });
    expect(
      await evaluateCspSafe("const a = 5; a * 3", scope)
    ).toBe(15);
  });
});

