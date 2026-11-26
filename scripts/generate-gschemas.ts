// Writes Piloti's GSettings schema from the settings table:
//   ~/.bun/bin/bun scripts/generate-gschemas.ts
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SETTINGS } from "@/context/SettingsContext";
import { buildPilotiGschemaXml, gschemaDefaults, PILOTI_GSCHEMA_FILE } from "@/lib/config/piloti-gschema";
import { desktopSchemaDefaults, desktopSchemaKeys } from "@/lib/config/piloti-settings-ini";

const xml = buildPilotiGschemaXml(
  desktopSchemaKeys(),
  desktopSchemaDefaults(gschemaDefaults(DEFAULT_SETTINGS)),
);
const out = path.resolve(import.meta.dir, "..", PILOTI_GSCHEMA_FILE);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, xml);
console.log(`wrote ${PILOTI_GSCHEMA_FILE}`);
