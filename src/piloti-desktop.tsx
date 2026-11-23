import type { Shell as ShellModule } from "@domicile-desktop/sdk/shell";
import "./styles/globals.css";

const HOME_MARKER_KEY = "piloti.vfs.home";

/**
 * Entry of the native shell. The VFS root must be the real `$HOME`, and VFS
 * modules read it when they load, so ask the compositor for it first and only
 * then load the desktop (see `src/lib/engine/vfs-home.ts`).
 */
async function boot(root: HTMLElement, domicile: Parameters<ShellModule>[1]) {
  try {
    const stat = await domicile.files.stat(".");
    const home = stat.unwrapOr(undefined as never)?.realPath;
    if (home && home.startsWith("/")) {
      (globalThis as { __PILOTI_VFS_HOME__?: string }).__PILOTI_VFS_HOME__ = home;
      let previous: string | null = null;
      try {
        previous = localStorage.getItem(HOME_MARKER_KEY);
      } catch {
        /* storage unavailable */
      }
      if (previous !== home) {
        // The cached VFS was keyed by another root (the old virtual /home/user).
        const { clearAllWebVfsBackingStorage } = await import("@/lib/engine-web/web-vfs");
        clearAllWebVfsBackingStorage();
        try {
          localStorage.setItem(HOME_MARKER_KEY, home);
        } catch {
          /* storage unavailable */
        }
      }
    }
  } catch (error) {
    console.error("Could not resolve $HOME; using the virtual /home/user", error);
  }
  const app = await import("./piloti-desktop-app");
  app.Shell(root, domicile);
}

export const Shell: ShellModule = (root, domicile) => {
  void boot(root, domicile);
};
