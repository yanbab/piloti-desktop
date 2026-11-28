import {
  createAppModuleHost,
  type ModuleDomicile,
  readModuleText,
} from "@/lib/engine/app-module-host";
import { parseIniText, serializeIniText } from "@/lib/config/ini";
import { documentHash, MODULE_MOVES_DIR, MODULE_MOVES_FILE, type ModuleMove } from "@/data/app-modules";
import { _ } from "@/lib/core/i18n";
import { retainVfsWatch } from "@/lib/engine/vfs-query";
import type { TextsHost } from "@/lib/engine/texts-host";

/** `piloti.vfs` takes absolute paths. */
const toReal = (p: string) => p.replace(/\/+/g, "/");

const TEXTS_INI = ".config/piloti-texts/settings.ini";
/** Where the settings were before the app was renamed. */
const FORMER_INI = ".config/piloti/notepad.ini";
const GENERAL_INI = ".config/piloti/general.ini";

/**
 * TextsHost for a Domicile app module: the document goes through the same
 * `piloti.vfs` as in the shell; the app's prefs and state, which the editor
 * reads synchronously, are loaded before it mounts.
 */
export async function createDomicileEditorHost(domicile: ModuleDomicile) {
  const { files } = domicile;
  const {
    host: appHost,
    home,
    instance,
    desktopSettings: settings,
    watchDesktopSettings,
  } = await createAppModuleHost(domicile, { appId: "texts", stateKeys: ["editor-state"] });
  const readText = (path: string) => readModuleText(files, path);
  const [textsRaw, generalRaw] = await Promise.all([
    readText(TEXTS_INI).then((raw) => raw ?? readText(FORMER_INI)),
    readText(GENERAL_INI),
  ]);

  // Real Desktop folder from ~/.config/user-dirs.dirs (e.g. "Bureau"), else "Desktop".
  const userDirs = await readText(".config/user-dirs.dirs");
  const desktopMatch = userDirs && /^XDG_DESKTOP_DIR="?\$HOME\/([^"\n]+)"?/m.exec(userDirs);
  const desktopDir = desktopMatch ? desktopMatch[1]!.replace(/\/+$/, "") : "Desktop";

  const { vfs } = appHost;
  await files.createDir(MODULE_MOVES_DIR).catch(() => {});
  const readMoves = async (): Promise<ModuleMove[]> => {
    try {
      return JSON.parse((await readText(MODULE_MOVES_FILE)) || "[]") as ModuleMove[];
    } catch {
      return [];
    }
  };
  // Moves made before this window opened are not for it.
  let seen = Math.max(0, ...(await readMoves()).map((m) => m.seq));

  const texts = textsRaw ? parseIniText(textsRaw) : {};
  const general = generalRaw ? parseIniText(generalRaw) : {};
  const host: TextsHost = {
    ...appHost,
    normalizePath: toReal,
    defaultNewFilePath: (name) => `${home}/${desktopDir}/${name}`,
    onRenamed: (listener) =>
      // The folder: a watch on a replaced file reports only once.
      retainVfsWatch(vfs, `${home}/${MODULE_MOVES_DIR}`, () => {
        void readMoves().then((moves) => {
          for (const move of moves) {
            if (move.seq <= seen) continue;
            seen = move.seq;
            listener({ oldPath: move.from, newPath: move.to });
          }
        });
      }),
    opened: (path) => {
      history.replaceState(null, "", documentHash(path ?? "", instance));
      if (!path) document.title = _("Untitled");
    },
    guardClose: (mustAsk, ask) => {
      const onBeforeUnload = (event: BeforeUnloadEvent) => {
        if (!mustAsk()) return;
        // The shell answers "stay"; the editor then asks in its own window.
        event.preventDefault();
        event.returnValue = "";
        ask();
      };
      addEventListener("beforeunload", onBeforeUnload);
      return () => removeEventListener("beforeunload", onBeforeUnload);
    },
    readEditorPrefs: () => texts.Editor ?? {},
    writeEditorPrefs: (values) => {
      texts.Editor = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, String(v)]),
      );
      void files.createDir(".config/piloti-texts").catch(() => {});
      void files.write(TEXTS_INI, serializeIniText(texts)).catch(() => {});
    },
    confirmUnsavedOnClose: () => {
      const v = general.Windows?.["confirm-unsaved-on-close"];
      return v === "true" || v === "1";
    },
    onPrintFocused: () => () => {},
    onBeforeClose: () => () => {},
    bridge: {
      setTitle: (title) => {
        document.title = title;
      },
      closeWindow: () => window.close(),
    },
  };
  return { host, settings, instance, watchDesktopSettings };
}
