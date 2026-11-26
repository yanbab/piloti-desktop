import { createNativeVfs, type NativeVfsHost } from "@/lib/engine-native/vfs";
import { parseIniText, serializeIniText } from "@/lib/config/ini";
import type { TextEditorHost } from "@/lib/engine/text-editor-host";

/** `piloti.vfs` takes absolute paths. */
const toReal = (p: string) => p.replace(/\/+/g, "/");

const SETTINGS_INI = ".config/piloti/settings.ini";
const NOTEPAD_INI = ".config/piloti/notepad.ini";
const GENERAL_INI = ".config/piloti/general.ini";

type Files = NativeVfsHost["files"];

async function readText(files: Files, path: string): Promise<string | null> {
  const r = await files.readText(path).catch(() => null);
  return r ? r.unwrapOr(null as unknown as string) : null;
}

/**
 * TextEditorHost for a Domicile app module: the document goes through the same
 * `piloti.vfs` as in the shell; the app's prefs and state, which the editor
 * reads synchronously, are loaded before it mounts.
 */
export async function createDomicileEditorHost(domicile: NativeVfsHost) {
  const { files } = domicile;
  const stateCache = new Map<string, unknown>();
  const home = (await files.stat(".")).unwrapOr(undefined as never)?.realPath ?? "";
  const [notepadRaw, generalRaw, settingsRaw] = await Promise.all([
    readText(files, NOTEPAD_INI),
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

  const notepad = notepadRaw ? parseIniText(notepadRaw) : {};
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

  const host: TextEditorHost = {
    vfs: createNativeVfs(domicile),
    normalizePath: toReal,
    defaultNewFilePath: (name) => `${home}/${desktopDir}/${name}`,
    onRenamed: () => () => {},
    readState: <T,>(path: string, isValid: (v: unknown) => v is T) => {
      const v = stateCache.get(`${path}`);
      return isValid(v) ? v : null;
    },
    writeState: (path, value) => {
      stateCache.set(path, value);
      if (stateTimer === null) stateTimer = window.setTimeout(flushState, 400);
    },
    readEditorPrefs: () => notepad.Editor ?? {},
    writeEditorPrefs: (values) => {
      notepad.Editor = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, String(v)]),
      );
      void files.createDir(".config/piloti").catch(() => {});
      void files.write(NOTEPAD_INI, serializeIniText(notepad)).catch(() => {});
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
