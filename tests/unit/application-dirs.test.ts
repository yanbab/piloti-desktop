import { describe, expect, it } from "bun:test";
import { applicationDirsFor, XDG_APPLICATION_DIRS } from "../../src/lib/xdg/xdg-basedir";

describe("application folders", () => {
  it("follows XDG_DATA_DIRS after the user's own folder", () => {
    const dirs = applicationDirsFor("/run/domicile/electron/:/usr/share:relative");
    expect(dirs.slice(0, 3)).toEqual([
      ".local/share/applications",
      "/run/domicile/electron/applications",
      "/usr/share/applications",
    ]);
    expect(dirs).toHaveLength(XDG_APPLICATION_DIRS.length + 1);
  });

  it("keeps the usual folders without XDG_DATA_DIRS", () => {
    expect(applicationDirsFor(null)).toEqual([...XDG_APPLICATION_DIRS]);
  });
});
