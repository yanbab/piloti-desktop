import { describe, expect, test } from "bun:test";
import { addDockPins, dockPinIdFor, isAppLauncherItem } from "@/ui/shell/dock/dock-pins";

const catalog = {
  builtins: [{ id: "nautilus", command: "piloti-files", builtinComponent: "files" }],
  installed: [{ appId: "org.gimp.GIMP", desktopId: "org.gimp.GIMP.desktop", exec: "gimp %U" }],
  webApps: [{ id: "webapp-mail", url: "https://mail.example" }],
};
const file = (path: string) => ({ id: path, path, kind: "file" as const });

describe("apps dropped on the Dock", () => {
  test("a .desktop file pins the installed app it names", () => {
    expect(dockPinIdFor(file("/h/Desktop/org.gimp.GIMP.desktop"), catalog)).toBe("org.gimp.GIMP");
    expect(dockPinIdFor(file("/h/unknown.desktop"), catalog)).toBeNull();
  });

  test("built-in and web apps are found by what they run", () => {
    const entry = (exec: string) => ({ desktopId: "x.desktop", exec });
    expect(dockPinIdFor(file("/h/x.desktop"), catalog, entry("/usr/bin/piloti-files %U"))).toBe(
      "nautilus",
    );
    expect(
      dockPinIdFor(file("/h/x.desktop"), catalog, entry('piloti-webapp "https://mail.example"')),
    ).toBe("webapp-mail");
  });

  test("entries of the Applications view", () => {
    const app = (id: string) => ({ id, path: "piloti://apps/x", kind: "desktop-entry" as const });
    expect(dockPinIdFor(app("app:builtin:calculator"), catalog)).toBe("calculator");
    expect(dockPinIdFor(app("app:xdg:org.gimp.GIMP.desktop"), catalog)).toBe("org.gimp.GIMP");
  });

  test("only launchers count, and pins keep their place", () => {
    expect(isAppLauncherItem(file("/h/a.desktop"))).toBe(true);
    expect(isAppLauncherItem(file("/h/a.txt"))).toBe(false);
    expect(addDockPins(["a", "b"], ["c", "a"], "b")).toEqual(["a", "c", "b"]);
    expect(addDockPins(["a"], ["c"])).toEqual(["a", "c"]);
  });
});
