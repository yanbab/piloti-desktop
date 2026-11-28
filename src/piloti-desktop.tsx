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

/**
 * Entry of the native shell. The VFS root must be the real `$HOME`, and VFS
 * modules read it when they load, so ask the compositor for it first and only
 * then load the desktop (see `src/lib/engine/vfs-home.ts`).
 *
 * Files are the disk's: no browser storage, no demo tree. Piloti's own state files are read back from `$HOME` before the desktop
 * starts.
 */
async function boot(root: HTMLElement, piloti: Parameters<ShellModule>[1]) {
  const finishState = startBootPhase("home + saved state");
  let nativeVfs: Vfs | undefined;
  let apps: Promise<void> | undefined;
  const loadApps = () =>
    (apps ??= (async () => {
      const finishApps = startBootPhase("app descriptions");
      await loadAppCatalog(piloti);
      finishApps();
    })());
  try {
    const finishHome = startBootPhase("stat $HOME");
    const stat = await hostFiles(piloti).stat(".");
    finishHome();
    const home = stat.unwrapOr(undefined as never)?.realPath;
    if (home && home.startsWith("/")) {
      (globalThis as { __PILOTI_VFS_HOME__?: string }).__PILOTI_VFS_HOME__ = home;
      const [
        { createNativeVfs },
        { setEmblems },
        { createNativeEmblemStorage },
        { createNativeStateStore },
        { setStateSource },
        emblems,
        { clearOldBrowserCache },
      ] = await Promise.all([
        import("@/lib/engine-native/vfs"),
        import("@/lib/engine-native/gio"),
        import("@/lib/engine-native/emblem-storage"),
        import("@/lib/engine-native/state-store"),
        import("@/lib/engine/vfs-state"),
        import("@/lib/engine/emblems"),
        import("@/lib/engine-native/clear-old-browser-cache"),
      ]);
      clearOldBrowserCache();
      nativeVfs = createNativeVfs(piloti);
      // Emblems (favorites included) live in the file's gio `metadata::emblems`, like other file managers.
      emblems.setEmblemPersist((path, names) =>
        setEmblems(piloti.processes, path, names, emblems.MANAGED_GNOME_EMBLEMS),
      );
      const { mergeConfigDirs } = await import("@/lib/engine/system-commands");
      const config = `${home}/.config`;
      if ((await hostFiles(piloti).stat(`${config}/Piloti`)).isOk()) {
        await mergeConfigDirs(piloti, `${config}/Piloti`, `${config}/piloti`).catch(() => undefined);
      }
      const statVfs = nativeVfs;
      const loadState = async () => {
        const finishPreload = startBootPhase("saved state files");
        setStateSource(await createNativeStateStore(statVfs, home));
        // After the state store: the favorites are one of its files.
        emblems.setEmblemStorage(await createNativeEmblemStorage(statVfs));
        finishPreload();
      };
      // Desktop settings in dconf when Piloti's schemas are installed.
      const loadSettings = async () => {
        const finishSettings = startBootPhase("settings backend");
        const { selectNativeSettingsBackend } = await import("@/lib/engine-native/settings-backend");
        const backend = await selectNativeSettingsBackend(piloti, {
          home,
          exists: async (path) => (await statVfs.stat(path).catch(() => null)) !== null,
          readText: (path) => statVfs.readText(path),
        }).catch(() => "keyfile");
        finishSettings(backend);
      };
      // The settings come after the state files (they may copy settings.ini to
      // dconf); the app descriptions need neither.
      await Promise.all([loadState().then(loadSettings), loadApps()]);
    }
  } catch (error) {
    console.error("Could not resolve $HOME; using the virtual /home/user", error);
  }
  finishState();
  await loadApps();
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
