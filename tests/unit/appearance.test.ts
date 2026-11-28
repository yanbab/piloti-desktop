import { describe, expect, test } from "bun:test";
import { resolveTheme } from "@/core/config/appearance";
import { followLocale, getLocale } from "@/core/util/i18n";
import { desktopSettingsFrom } from "@/platform/shared/app-module-desktop";

describe("the look a module takes from the desktop", () => {
  test("system is the time of day on Linux, the browser's choice without services", () => {
    expect(resolveTheme("system", { hour: 22 })).toBe("dark");
    expect(resolveTheme("system", { hour: 12 })).toBe("light");
    expect(resolveTheme("system", { prefersDark: true })).toBe("dark");
    expect(resolveTheme("light", { hour: 22 })).toBe("light");
  });

  test("unset keys are the shell's defaults", () => {
    const set = desktopSettingsFrom("[org.piloti.desktop.interface]\naccent-color=red\n");
    expect(set.accentColor).toBe("red");
    expect(set.fontSansFamily).toBe(desktopSettingsFrom(null).fontSansFamily);
    expect(set.windowButtonLayout).toBe(":close");
  });

  test("follows the desktop's language", () => {
    const before = getLocale();
    followLocale("[org.piloti.desktop.locale]\nlocale=fr\n");
    expect(getLocale()).toBe("fr");
    followLocale(`[org.piloti.desktop.locale]\nlocale=${before}\n`);
  });
});
