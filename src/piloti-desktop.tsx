import { loadAppCatalog } from "./lib/engine/app-catalog";
import { hostFiles } from "@/lib/engine/host-files";
import { attachConsoleDiskSink, installConsoleCapture } from "./lib/core/console-store";
import { createShellLogWriter } from "./lib/engine/shell-log";
import { profileStartup } from "./lib/core/startup-profile";
import { startBootPhase } from "./lib/core/perf-log";
import type { Shell as ShellModule } from "@domicile-desktop/sdk/shell";
import "./styles/globals.css";
import { nativeEngine, setEngine } from "./lib/engine/engine";
import type { Vfs } from "./lib/ports/vfs";

setEngine(nativeEngine);

const CACHE_MARKER_KEY = "piloti.vfs.native-memory.v1";

/** Moves what is left of `~/.config/Piloti` (capital P) into `~/.config/piloti`. */
async function moveLegacyConfigDir(piloti: Parameters<ShellModule>[1], config: string) {
  if (!(await hostFiles(piloti).stat(`${config}/Piloti`)).isOk()) return;
  await piloti.processes.run([
    "sh",
    "-c",
    'mkdir -p "$2" && cp -rn "$1"/. "$2"/ && rm -rf "$1"',
    "sh",
    `${config}/Piloti`,
    `${config}/piloti`,
  ]);
}

/**
 * Entry of the native shell. The VFS root must be the real `$HOME`, and VFS
 * modules read it when they load, so ask the compositor for it first and only
 * then load the desktop (see `src/lib/engine/vfs-home.ts`).
 *
 * The native VFS is a memory cache of the disk: no browser storage, no demo
 * tree. Piloti's own state files are read back from `$HOME` before the desktop
 * starts.
 */
async function boot(root: HTMLElement, piloti: Parameters<ShellModule>[1]) {
  const finishState = startBootPhase("home + saved state");
  let nativeVfs: Vfs | undefined;
  try {
    const finishHome = startBootPhase("stat $HOME");
    const stat = await hostFiles(piloti).stat(".");
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
      const [
        { createNativeFileStore },
        { createNativeKeyValueStorage },
        { createNativeStateStore },
        { setStateSource },
      ] = await Promise.all([
        import("@/lib/engine-native/native-file-store"),
        import("@/lib/engine-native/state-preload"),
        import("@/lib/engine-native/state-store"),
        import("@/lib/engine/vfs-state"),
      ]);
      const store = createNativeFileStore(piloti);
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
      nativeVfs = (await import("@/lib/engine-native/vfs")).createNativeVfs(piloti);
      await moveLegacyConfigDir(piloti, `${home}/.config`).catch(() => undefined);
      setStateSource(await createNativeStateStore(nativeVfs, home));
      finishPreload();
    }
  } catch (error) {
    console.error("Could not resolve $HOME; using the virtual /home/user", error);
  }
  finishState();
  const finishApps = startBootPhase("app descriptions");
  await loadAppCatalog(piloti);
  finishApps();
  const finishImport = startBootPhase("desktop module");
  // Imported late, like the desktop: no module may be loaded before `$HOME` is known.
  const [app, { createNativeVfs }, { withVfs }] = await Promise.all([
    import("./piloti-desktop-app"),
    import("@/lib/engine-native/vfs"),
    import("@/lib/engine/with-vfs"),
  ]);
  finishImport();
  const finishRender = startBootPhase("first render");
  app.Shell(root, withVfs(piloti, nativeVfs ?? createNativeVfs(piloti)));
  finishRender();
}

export const Shell: ShellModule = (root, piloti) => {
  // Log from the first line, so a start that hangs still leaves its trace.
  installConsoleCapture();
  attachConsoleDiskSink(createShellLogWriter(piloti));
  void boot(root, profileStartup(piloti));
};
