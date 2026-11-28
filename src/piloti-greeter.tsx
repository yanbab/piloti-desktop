/// <reference types="@domicile-desktop/react/elements" />
import { loadAppCatalog } from "./platform/shared/app-catalog";
import { hostFiles } from "./core/files/host-files";
import "./ui/styles/globals.css";
import type { Shell as ShellModule } from "@domicile-desktop/sdk/shell";

/**
 * Standalone Domicile Wayland Display Manager Greeter shell (`dist/greeter.js`).
 * Intended to be launched by `greetd` via `/usr/bin/piloti-greeter`.
 *
 * Like the shell (`piloti-desktop.tsx`), it asks for `$HOME` before loading
 * anything that reads it, then loads its saved state.
 */
async function boot(root: HTMLElement, domicile: Parameters<ShellModule>[1]) {
  let home: string | undefined;
  try {
    home = (await hostFiles(domicile).stat(".")).unwrapOr(undefined as never)?.realPath;
    if (home) (globalThis as { __PILOTI_VFS_HOME__?: string }).__PILOTI_VFS_HOME__ = home;
  } catch (error) {
    console.error("Could not resolve $HOME", error);
  }
  // Only now: these read `$HOME` when they load.
  const [{ createNativeVfs }, { withVfs }] = await Promise.all([
    import("./platform/native/vfs"),
    import("./platform/shared/with-vfs"),
  ]);
  const vfs = createNativeVfs(domicile);
  if (home) {
    try {
      const [{ createNativeStateStore }, { setStateSource }] = await Promise.all([
        import("./platform/native/state-store"),
        import("./core/state/vfs-state"),
      ]);
      setStateSource(await createNativeStateStore(vfs, home));
    } catch (error) {
      console.error("Could not load the greeter's saved state", error);
    }
  }
  const piloti = withVfs(domicile, vfs);
  await loadAppCatalog(piloti).catch((error) => console.error("No app descriptions", error));
  const { mountGreeter } = await import("./piloti-greeter-app");
  mountGreeter(root, piloti);
}

// The greeter is a shell (never an app module): its host has all file calls.
export const Shell: ShellModule = (root, domicile) => void boot(root, domicile);
