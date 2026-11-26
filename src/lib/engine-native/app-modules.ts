/** Starts one of our apps as a Domicile app module (see docs/ARCHITECTURE.md). */
import { APP_MODULES } from "@/data/app-modules";
import { hostFiles } from "@/lib/engine/host-files";
import type { Piloti } from "@/lib/engine/piloti";

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
