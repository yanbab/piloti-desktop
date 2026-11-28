import { loadAppCatalog } from "./platform/shared/app-catalog";
import { hostFiles } from "@/core/files/host-files";
import { attachConsoleDiskSink, installConsoleCapture } from "./core/util/console-store";
import { createShellLogWriter } from "./platform/shared/shell-log";
import { profileStartup } from "./core/util/startup-profile";
import { startBootPhase } from "./core/util/perf-log";
import type { Shell as ShellModule } from "@domicile-desktop/sdk/shell";
import "./ui/styles/globals.css";
import { nativeEngine, setEngine } from "./core/ports/engine";
import type { Vfs } from "./core/ports/vfs";

setEngine(nativeEngine);

/**
 * Entry of the native shell. The VFS root must be the real `$HOME`, and VFS
 * modules read it when they load, so ask the compositor for it first and only
 * then load the desktop (see `src/platform/shared/vfs-home.ts`).
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
        import("@/platform/native/vfs"),
        import("@/platform/native/gio"),
        import("@/platform/native/emblem-storage"),
        import("@/platform/native/state-store"),
        import("@/core/state/vfs-state"),
        import("@/platform/shared/emblems"),
        import("@/platform/native/clear-old-browser-cache"),
      ]);
      clearOldBrowserCache();
      nativeVfs = createNativeVfs(piloti);
      // Emblems (favorites included) live in the file's gio `metadata::emblems`, like other file managers.
      emblems.setEmblemPersist((path, names) =>
        setEmblems(piloti.processes, path, names, emblems.MANAGED_GNOME_EMBLEMS),
      );
      const { mergeConfigDirs } = await import("@/platform/shared/system-commands");
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
        const { selectNativeSettingsBackend } = await import("@/platform/native/settings-backend");
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
  const [app, { createNativeVfs }, { withVfs }, { ensureLocale }] = await Promise.all([
    import("./piloti-desktop-app"),
    import("@/platform/native/vfs"),
    import("@/platform/shared/with-vfs"),
    import("@/core/util/i18n"),
  ]);
  // The language's strings before the first drawing.
  await ensureLocale();
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
