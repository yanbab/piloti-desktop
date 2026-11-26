/**
 * The session's application folders. Domicile puts folders of its own on
 * `XDG_DATA_DIRS` (copies of the entries listed in `electron.apps`), so the
 * fixed XDG list is not enough.
 */
import type { Piloti } from "@/lib/engine/piloti";
import { applicationDirsFor } from "@/lib/xdg/xdg-basedir";
import { runText } from "./exec";

export async function readApplicationDirs(piloti: Piloti): Promise<string[]> {
  return applicationDirsFor(await runText(piloti, ["printenv", "XDG_DATA_DIRS"]));
}
