// Domicile app module: Folders in its own process. See docs/ARCHITECTURE.md.
//
// Its paths are real ones (`core/state/vfs-home.ts`): learn `$HOME` first, then
// load the app, which reads it as it loads. Nothing here may import VFS code
// (`homeNotReadEarly` checks the build).
import type { AppMain } from "@domicile-desktop/sdk/app";
import { hostFiles } from "@/core/files/host-files";

export const main: AppMain = async (root, domicile) => {
  const stat = await hostFiles(domicile).stat(".");
  const home = stat.unwrapOr(undefined as never)?.realPath;
  if (home?.startsWith("/")) (globalThis as { __PILOTI_VFS_HOME__?: string }).__PILOTI_VFS_HOME__ = home;
  const { start } = await import("@/ui/apps/files/module");
  return start(root, domicile);
};
