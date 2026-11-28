import { afterEach, describe, expect, test } from "bun:test";
import {
  _,
  getLocale,
  getLocalePreference,
  getSystemLocale,
  setLocale,
} from "@/core/util/i18n";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import es from "@/core/locales/es.json";
import fr from "@/core/locales/fr.json";

/** Literal `_("…")` keys under src/. */
function sourceKeys(): string[] {
  const root = join(import.meta.dir, "../../src");
  const keys = new Set<string>();
  for (const file of readdirSync(root, { recursive: true, encoding: "utf8" })) {
    if (!/\.tsx?$/.test(file)) continue;
    const text = readFileSync(join(root, file), "utf8");
    for (const match of text.matchAll(/\b_\(\s*("(?:[^"\\\n]|\\.)*")/g)) {
      keys.add(JSON.parse(match[1]!) as string);
    }
  }
  return [...keys];
}

describe("i18n translation helper", () => {
  afterEach(() => {
    setLocale("en");
  });

  test("fr and es cover every literal string in the source", () => {
    const keys = sourceKeys();
    expect(keys.length).toBeGreaterThan(500);
    expect(keys.filter((key) => !(key in fr))).toEqual([]);
    expect(keys.filter((key) => !(key in es))).toEqual([]);
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

