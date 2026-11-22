import { describe, expect, it } from "bun:test";
import { evaluateLauncherMath } from "@/lib/shell/launcher-math";

describe("evaluateLauncherMath", () => {
  it("evaluates arithmetic with operator precedence and parentheses", () => {
    expect(evaluateLauncherMath("1920 / 16 * 9")?.result).toBe("1,080");
    expect(evaluateLauncherMath("(2 + 3) * 4")?.result).toBe("20");
  });

  it("evaluates exponents, hex, binary, and math functions", () => {
    expect(evaluateLauncherMath("2^16")?.result).toBe("65,536");
    expect(evaluateLauncherMath("2**10")?.result).toBe("1,024");
    expect(evaluateLauncherMath("0xff")?.result).toBe("255");
    expect(evaluateLauncherMath("sqrt(144) + 6")?.result).toBe("18");
  });

  it("returns null for plain numbers, text queries, or division by zero", () => {
    expect(evaluateLauncherMath("42")).toBeNull();
    expect(evaluateLauncherMath("firefox")).toBeNull();
    expect(evaluateLauncherMath("10 / 0")).toBeNull();
  });
});

