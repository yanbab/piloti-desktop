/**
 * Reads the built-in apps from the installed desktop files (real ones on
 * Linux, the shipped ones in the demo) into the catalog. Both entry points
 * await this before importing the shell.
 */
import type { Piloti } from "@/lib/engine/piloti";
import { APP_CATALOG, registerApps } from "@/data/catalog";
import { hostFiles } from "@/lib/engine/host-files";

const APPLICATIONS_DIR = "/usr/share/applications";

export async function loadAppCatalog(piloti: Pick<Piloti, "files">): Promise<void> {
  const files = hostFiles(piloti);
  const names = (await files.readDir(APPLICATIONS_DIR)).match({
    Ok: (entries) => entries.map((e) => e.name),
    Err: () => [] as string[],
  });
  const contents = await Promise.all(
    names
      .filter((name) => name.startsWith("piloti-") && name.endsWith(".desktop"))
      .map(async (name) =>
        (await files.readText(`${APPLICATIONS_DIR}/${name}`)).match({
          Ok: (text) => text,
          Err: () => "",
        })
      )
  );
  registerApps(contents);
  if (APP_CATALOG.length === 0) {
    console.error(
      `[piloti] no app descriptions in ${APPLICATIONS_DIR}: install the piloti-desktop package matching this shell`
    );
  }
}
