// The unit tests run against the browser demo's seeded VFS, as `piloti-web.tsx` sets it up.
import fs from "node:fs";
import path from "node:path";
import { registerApps } from "@/data/catalog";
import { setEngine, webEngine } from "@/lib/engine/engine";
import { setDataFiles } from "@/lib/engine-web/data-files";
import { demoVfsSeed } from "@/lib/engine-web/vfs-seed";
import { setVfsSeed } from "@/lib/engine-web/web-vfs";
import { webDemoFiles } from "@/lib/engine-web/demo-files";
import { setDemoFiles } from "@/lib/ports/demo-files";
// @ts-expect-error -- plain build script
import { DATA_FILES_DIR, indexDataFiles } from "../../scripts/data-files.mjs";

// What the demo fetches from `__fs/`, read from disk here.
const index = indexDataFiles();
setDataFiles(
  index.dirs,
  Object.fromEntries(
    index.files.map((p: string) => [p, fs.readFileSync(path.join(DATA_FILES_DIR, p), "utf8")])
  )
);
// The app catalog, as `loadAppCatalog` fills it.
registerApps(
  index.files
    .filter((p: string) => /^\/usr\/share\/applications\/piloti-.*\.desktop$/.test(p))
    .map((p: string) => fs.readFileSync(path.join(DATA_FILES_DIR, p), "utf8"))
);
setVfsSeed(demoVfsSeed);
setEngine(webEngine);
setDemoFiles(webDemoFiles);
