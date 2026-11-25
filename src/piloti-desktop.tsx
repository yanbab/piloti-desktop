import { hostFiles } from "@/lib/engine/host-files";
import { attachConsoleDiskSink, installConsoleCapture } from "./lib/core/console-store";
import { createShellLogWriter } from "./lib/engine/shell-log";
import { profileStartup } from "./lib/core/startup-profile";
import { startBootPhase } from "./lib/core/perf-log";
import type { Shell as ShellModule } from "@domicile-desktop/sdk/shell";
import "./styles/globals.css";
import { nativeEngine, setEngine } from "./lib/engine/engine";

setEngine(nativeEngine);

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
  const finishState = startBootPhase("home + saved state");
  try {
    const finishHome = startBootPhase("stat $HOME");
    const stat = await hostFiles(domicile).stat(".");
    finishHome();
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
      const { memoryBlobStorage } = await import("@/lib/ports/vfs-persistence");
      const [{ createNativeFileStore }, { preloadNativeState, createNativeKeyValueStorage }] =
        await Promise.all([
          import("@/lib/engine-native/native-file-store"),
          import("@/lib/engine-native/state-preload"),
        ]);
      const store = createNativeFileStore(domicile);
      const finishKv = startBootPhase("saved key/values");
      const kv = await createNativeKeyValueStorage(store, (key) => key === vfs.WEB_VFS_STORAGE_KEY);
      finishKv();
      vfs.setVfsPersistence({
        kv,
        blobs: memoryBlobStorage(),
        persistEntries: false,
      });
      // Emblems (favorites included) live in the file's gio `metadata::emblems`, like other file managers.
      vfs.setVfsEmblemPersist((path, names) =>
        void store.setEmblems?.(path, names, vfs.MANAGED_GNOME_EMBLEMS),
      );
      const finishPreload = startBootPhase("saved state files");
      const loaded = await preloadNativeState(store, {
        ensureDir: (path) => void vfs.ensureVfsDir(path),
        writeText: (path, content) => void vfs.writeVfsTextFile(path, content),
      });
      finishPreload(`${loaded} files`);
    }
  } catch (error) {
    console.error("Could not resolve $HOME; using the virtual /home/user", error);
  }
  finishState();
  const finishImport = startBootPhase("desktop module");
  const app = await import("./piloti-desktop-app");
  finishImport();
  const finishRender = startBootPhase("first render");
  app.Shell(root, domicile);
  finishRender();
}

export const Shell: ShellModule = (root, domicile) => {
  // Log from the first line, so a start that hangs still leaves its trace.
  installConsoleCapture();
  attachConsoleDiskSink(createShellLogWriter(domicile));
  void boot(root, profileStartup(domicile));
};
