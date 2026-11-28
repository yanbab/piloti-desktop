import { describe, expect, test } from "bun:test";
import { appIconThemes, findAppEntry } from "@/core/apps/describe-apps";
import type { XdgDesktopEntry } from "@/core/xdg/xdg-desktop-entry";

const entry = (desktopId: string, extra: Partial<XdgDesktopEntry> = {}, pilotiId?: string) =>
  ({
    desktopId,
    appId: desktopId.replace(/\.desktop$/, ""),
    name: desktopId,
    rawGroups: { "Desktop Entry": pilotiId ? { "X-Piloti-AppId": pilotiId } : {} },
    ...extra,
  }) as XdgDesktopEntry;

describe("describe apps", () => {
  const entries = [
    entry("piloti-system-monitor.desktop", {}, "system-monitor"),
    entry("org.gnome.Nautilus.desktop"),
    entry("firefox-esr.desktop", { startupWMClass: "Firefox-esr" }),
  ];

  test("finds a window's app by its Piloti id, desktop id or window class", () => {
    expect(findAppEntry(entries, "system-monitor")?.desktopId).toBe("piloti-system-monitor.desktop");
    expect(findAppEntry(entries, "org.gnome.Nautilus.desktop")?.desktopId).toBe("org.gnome.Nautilus.desktop");
    expect(findAppEntry(entries, "firefox-esr")?.desktopId).toBe("firefox-esr.desktop");
    expect(findAppEntry(entries, "Firefox-ESR")?.desktopId).toBe("firefox-esr.desktop");
    expect(findAppEntry(entries, "unknown")).toBeUndefined();
  });

  test("looks in the icon theme the shell would use", () => {
    expect(appIconThemes({ interfaceTheme: "adwaita", iconTheme: "Piloti" })).toEqual(["Adwaita", "hicolor"]);
    expect(appIconThemes({ interfaceTheme: "piloti", iconTheme: "Papirus" })[0]).toBe("Piloti");
    expect(appIconThemes({ interfaceTheme: "piloti", iconTheme: "Yaru" })[0]).toBe("Yaru");
  });
});
