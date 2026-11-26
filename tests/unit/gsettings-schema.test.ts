import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SETTINGS } from "@/context/SettingsContext";
import { fromGVariant, toGVariant } from "@/lib/config/gvariant";
import { buildPilotiGschemaXml, gschemaDefaults, PILOTI_GSCHEMA_FILE, schemaPath } from "@/lib/config/piloti-gschema";
import { desktopSchemaDefaults, desktopSchemaKeys } from "@/lib/config/piloti-settings-ini";

describe("GVariant text", () => {
  it("round-trips each kind", () => {
    const cases = [
      ["string", "it's a \\ path"],
      ["string", ""],
      ["boolean", "true"],
      ["boolean", "false"],
      ["number", "52"],
      ["number", "1.25"],
      ["string[]", "a;b c;d'e"],
      ["string[]", ""],
    ] as const;
    for (const [kind, text] of cases) {
      expect(fromGVariant(toGVariant(text, kind), kind)).toBe(text);
    }
  });

  it("reads what dconf prints", () => {
    expect(fromGVariant("52.0", "number")).toBe("52");
    expect(fromGVariant("@as []", "string[]")).toBe("");
    expect(fromGVariant("['nautilus', 'terminal']", "string[]")).toBe("nautilus;terminal");
    expect(fromGVariant("'prefer-dark'")).toBe("prefer-dark");
    expect(fromGVariant('"say \\"hi\\""', "string")).toBe('say "hi"');
  });
});

describe("Piloti gschema", () => {
  it("is up to date with the settings table (run scripts/generate-gschemas.ts)", () => {
    const xml = buildPilotiGschemaXml(
      desktopSchemaKeys(),
      desktopSchemaDefaults(gschemaDefaults(DEFAULT_SETTINGS)),
    );
    const file = fs.readFileSync(path.resolve(import.meta.dir, "../..", PILOTI_GSCHEMA_FILE), "utf8");
    expect(file).toBe(xml);
  });

  it("maps schema ids to dconf paths", () => {
    expect(schemaPath("org.piloti.desktop.dock")).toBe("/org/piloti/desktop/dock/");
  });
});
