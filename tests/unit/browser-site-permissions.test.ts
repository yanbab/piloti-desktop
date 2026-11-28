import { describe, expect, test } from "bun:test";
import { hasStoredPermissions, sitePermissionRows } from "@/ui/shell/windows/browser-site-permissions";

describe("sitePermissionRows", () => {
  test("no site, no rows", () => {
    expect(sitePermissionRows({})).toEqual([]);
    expect(sitePermissionRows(null)).toEqual([]);
  });

  test("common permissions always, others once answered", () => {
    const rows = sitePermissionRows({
      camera: "allow",
      microphone: "ask",
      location: "ask",
      notifications: "ask",
      clipboard: "block",
      midi: "ask",
    });
    expect(rows.map((r) => r.permission)).toEqual(["camera", "microphone", "location", "notifications", "clipboard"]);
    expect(rows[0]?.setting).toBe("allow");
    expect(rows[4]?.setting).toBe("block");
  });

  test("unknown values read as ask, unknown names are dropped", () => {
    const rows = sitePermissionRows({ camera: "maybe", bogus: "allow" });
    expect(rows.find((r) => r.permission === "camera")?.setting).toBe("ask");
    expect(rows.some((r) => (r.permission as string) === "bogus")).toBe(false);
  });

  test("reset only when something is stored", () => {
    expect(hasStoredPermissions(sitePermissionRows({ camera: "ask" }))).toBe(false);
    expect(hasStoredPermissions(sitePermissionRows({ camera: "block" }))).toBe(true);
  });
});
