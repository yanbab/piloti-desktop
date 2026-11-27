import { createNativeVfs, type NativeVfsHost } from "@/lib/engine-native/vfs";
import { parseIniText, serializeIniText } from "@/lib/config/ini";
import { documentHash, MODULE_MOVES_DIR, MODULE_MOVES_FILE, type ModuleMove } from "@/data/app-modules";
import { _ } from "@/lib/core/i18n";
import { retainVfsWatch } from "@/lib/engine/vfs-query";
import type { TextsHost } from "@/lib/engine/texts-host";

/** `piloti.vfs` takes absolute paths. */
const toReal = (p: string) => p.replace(/\/+/g, "/");

const SETTINGS_INI = ".config/piloti/settings.ini";
const TEXTS_INI = ".config/piloti-texts/settings.ini";
/** Where the settings were before the app was renamed. */
const FORMER_INI = ".config/piloti/notepad.ini";
const GENERAL_INI = ".config/piloti/general.ini";

type Files = NativeVfsHost["files"];

async function readText(files: Files, path: string): Promise<string | null> {
  const r = await files.readText(path).catch(() => null);
  return r ? r.unwrapOr(null as unknown as string) : null;
}

/**
 * TextsHost for a Domicile app module: the document goes through the same
 * `piloti.vfs` as in the shell; the app's prefs and state, which the editor
 * reads synchronously, are loaded before it mounts.
 */
export async function createDomicileEditorHost(domicile: NativeVfsHost) {
  const { files } = domicile;
  const stateCache = new Map<string, unknown>();
  const home = (await files.stat(".")).unwrapOr(undefined as never)?.realPath ?? "";
  const [textsRaw, generalRaw, settingsRaw] = await Promise.all([
    readText(files, TEXTS_INI).then((raw) => raw ?? readText(files, FORMER_INI)),
    readText(files, GENERAL_INI),
    readText(files, SETTINGS_INI),
  ]);
  const editorStatePath = ".local/state/piloti/editor-state.json";
  const stateRaw = await readText(files, editorStatePath);
  if (stateRaw) {
    try {
      stateCache.set("editor-state", JSON.parse(stateRaw));
    } catch {
      /* ignore corrupt state */
    }
  }

  // Real Desktop folder from ~/.config/user-dirs.dirs (e.g. "Bureau"), else "Desktop".
  const userDirs = await readText(files, ".config/user-dirs.dirs");
  const desktopMatch = userDirs && /^XDG_DESKTOP_DIR="?\$HOME\/([^"\n]+)"?/m.exec(userDirs);
  const desktopDir = desktopMatch ? desktopMatch[1]!.replace(/\/+$/, "") : "Desktop";

  const vfs = createNativeVfs(domicile);
  await files.createDir(MODULE_MOVES_DIR).catch(() => {});
  const readMoves = async (): Promise<ModuleMove[]> => {
    try {
      return JSON.parse((await readText(files, MODULE_MOVES_FILE)) || "[]") as ModuleMove[];
    } catch {
      return [];
    }
  };
  // Moves made before this window opened are not for it.
  let seen = Math.max(0, ...(await readMoves()).map((m) => m.seq));

  const texts = textsRaw ? parseIniText(textsRaw) : {};
  const general = generalRaw ? parseIniText(generalRaw) : {};
  const settings = settingsRaw ? parseIniText(settingsRaw) : {};

  let stateTimer: number | null = null;
  const flushState = () => {
    stateTimer = null;
    const value = stateCache.get("editor-state");
    if (value === undefined) return;
    void files.createDir(".local/state/piloti").catch(() => {});
    void files.write(editorStatePath, JSON.stringify(value)).catch(() => {});
  };
  addEventListener("pagehide", () => {
    if (stateTimer !== null) flushState();
  });

  const host: TextsHost = {
    vfs,
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
      history.replaceState(null, "", path ? documentHash(path) : location.pathname);
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
    readState: <T,>(path: string, isValid: (v: unknown) => v is T) => {
      const v = stateCache.get(`${path}`);
      return isValid(v) ? v : null;
    },
    writeState: (path, value) => {
      stateCache.set(path, value);
      if (stateTimer === null) stateTimer = window.setTimeout(flushState, 400);
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
    requestAnimatedClose: () => window.close(),
    onPrintFocused: () => () => {},
    onBeforeClose: () => () => {},
    bridge: {
      setTitle: (title) => {
        document.title = title;
      },
      closeWindow: () => window.close(),
    },
  };
  return { host, settings };
}
