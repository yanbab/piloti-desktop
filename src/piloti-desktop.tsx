import type { Shell as ShellModule } from "@domicile-desktop/sdk/shell";
import "./styles/globals.css";

const CACHE_MARKER_KEY = "piloti.vfs.native-memory.v1";

/**
 * Entry of the native shell. The VFS root must be the real `$HOME`, and VFS
 * modules read it when they load, so ask the compositor for it first and only
 * then load the desktop (see `src/lib/engine/vfs-home.ts`).
 *
 * The native VFS is a memory cache of the disk: no browser storage, no demo
 * tree. Piloti's own state files are read back from `$HOME` before the desktop
 * starts.
 */
async function boot(root: HTMLElement, domicile: Parameters<ShellModule>[1]) {
  try {
    const stat = await domicile.files.stat(".");
    const home = stat.unwrapOr(undefined as never)?.realPath;
    if (home && home.startsWith("/")) {
      (globalThis as { __PILOTI_VFS_HOME__?: string }).__PILOTI_VFS_HOME__ = home;
      const vfs = await import("@/lib/engine-web/web-vfs");
      let cleared = false;
      try {
        cleared = localStorage.getItem(CACHE_MARKER_KEY) === "1";
      } catch {
        /* storage unavailable */
      }
      if (!cleared) {
        // Earlier builds cached the VFS (and a demo tree) in browser storage.
        vfs.clearAllWebVfsBackingStorage();
        try {
          localStorage.setItem(CACHE_MARKER_KEY, "1");
        } catch {
          /* storage unavailable */
        }
      }
      const { memoryPersistence } = await import("@/lib/ports/vfs-persistence");
      vfs.setVfsPersistence(memoryPersistence());
      vfs.setVfsDemoDefaults(false);
      const [{ createNativeFileStore }, { preloadNativeState }] = await Promise.all([
        import("@/lib/engine-native/native-file-store"),
        import("@/lib/engine-native/state-preload"),
      ]);
      await preloadNativeState(createNativeFileStore(domicile), {
        ensureDir: (path) => void vfs.ensureVfsDir(path),
        writeText: (path, content) => void vfs.writeVfsTextFile(path, content),
      });
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
