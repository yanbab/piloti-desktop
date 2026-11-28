/** Starts one of our apps as a Domicile app module (see docs/ARCHITECTURE.md). */
import { MODULE_MOVES_DIR, MODULE_MOVES_FILE, type ModuleMove, APP_MODULES } from "@/core/data/app-modules";
import { hostFiles } from "@/platform/shared/host-files";
import type { Piloti } from "@/platform/shared/piloti";

/**
 * Opens the app in its own window, with `path` as the file to open. False when
 * its module isn't installed (a shell run from a checkout).
 */
export async function openAppModule(piloti: Piloti, appId: string, path?: string): Promise<boolean> {
  const mod = APP_MODULES.find((m) => m.id === appId);
  if (!mod) return false;
  const entry = `${mod.dir}/${mod.id}.js`;
  const files = hostFiles(piloti);
  const installed = await files.stat(entry).then(
    (res) => res.match({ Ok: () => true, Err: () => false }),
    () => false,
  );
  if (!installed) return false;
  // Modules take no arguments yet: the file to open is left where they look.
  await files.createDir(".cache/piloti");
  await files.write(`.cache/piloti/${mod.id}-open`, path ?? "");
  piloti.processes.launch(["domicile", "open", "--app", entry]);
  return true;
}

let moves: ModuleMove[] = [];

/** Tells module windows a file was renamed or moved. */
export async function tellModulesMoved(piloti: Piloti, from: string, to: string): Promise<void> {
  const seq = Math.max(Date.now(), (moves[moves.length - 1]?.seq ?? 0) + 1);
  // Several moves can land before a module reads: keep the last ones.
  moves = [...moves.slice(-49), { seq, from, to }];
  const files = hostFiles(piloti);
  await files.createDir(MODULE_MOVES_DIR);
  await files.write(MODULE_MOVES_FILE, JSON.stringify(moves));
}
