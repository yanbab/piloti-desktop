import { describe, expect, it } from "bun:test";
import { getContrastForeground } from "@/data/web-apps";

describe("getContrastForeground (tinted headerbar)", () => {
  it("returns dark foreground for light theme colors and white for dark ones", () => {
    expect(getContrastForeground("#ffffff")).toBe("#1d1d20");
    expect(getContrastForeground("rgb(250, 240, 200)")).toBe("#1d1d20");
    expect(getContrastForeground("#111827")).toBe("#ffffff");
    expect(getContrastForeground("#1a73e8")).toBe("#ffffff");
  });

  it("ignores missing or transparent colors", () => {
    expect(getContrastForeground(null)).toBeNull();
    expect(getContrastForeground("rgba(0,0,0,0)")).toBeNull();
  });
});
