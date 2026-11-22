import { afterEach, describe, expect, test } from "bun:test";
import {
  _,
  getLocale,
  getLocalePreference,
  getSystemLocale,
  setLocale,
} from "@/lib/core/i18n";

describe("i18n translation helper", () => {
  afterEach(() => {
    setLocale("en");
  });

  test("falls back to English key when en.json is empty and formats %s/%d", () => {
    setLocale("en");
    expect(getLocale()).toBe("en");
    expect(getLocalePreference()).toBe("en");
    expect(_("My english sentence is: %s", "hello friend")).toBe(
      "My english sentence is: hello friend"
    );
    expect(_("Items: %d / 100%%", 42)).toBe("Items: 42 / 100%");
  });

  test("translates using fr.json when French locale is active and supports default preference", () => {
    setLocale("fr-FR");
    expect(getLocale()).toBe("fr");
    expect(getLocalePreference()).toBe("fr");
    expect(_("My english sentence is: %s", "hello friend")).toBe(
      "Ma phrase anglaise est : hello friend"
    );
    expect(_("Hide Desktop Icons")).toBe("Masquer les icônes du bureau");
    expect(_("Untranslated English fallback %s", "ok")).toBe(
      "Untranslated English fallback ok"
    );

    setLocale("default");
    expect(getLocalePreference()).toBe("default");
    expect(getLocale()).toBe(getSystemLocale());
  });
});

