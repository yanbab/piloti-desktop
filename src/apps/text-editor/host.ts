type Files = Omit<import("@domicile-desktop/sdk/desktop/files").Files, "search">;
import { parseIniText, serializeIniText } from "@/lib/config/ini";
import type { TextEditorHost } from "@/lib/engine/text-editor-host";

/** The shell's VFS root `/home/user/` is the real home folder; files take home-relative paths. */
const toReal = (p: string) => {
  const n = p.replace(/\/+/g, "/");
  return n.startsWith("/home/user/") ? n.slice("/home/user/".length) : n;
};

const SETTINGS_INI = ".config/piloti/settings.ini";
const NOTEPAD_INI = ".config/piloti/notepad.ini";
const GENERAL_INI = ".config/piloti/general.ini";

async function readText(files: Files, path: string): Promise<string | null> {
  const r = await files.readText(path).catch(() => null);
  return r ? r.unwrapOr(null as unknown as string) : null;
}

/**
 * TextEditorHost for a Domicile app module: files go straight to
 * `domicile.files` (no shell VFS). Reads that the port wants synchronously are
 * served from a cache filled by `preload` before the app mounts.
 */
export async function createDomicileEditorHost(files: Files, initialPath: string | null) {
  const stateCache = new Map<string, unknown>();
  const fileCache = new Map<string, string>();
  const [notepadRaw, generalRaw, settingsRaw, initial] = await Promise.all([
    readText(files, NOTEPAD_INI),
    readText(files, GENERAL_INI),
    readText(files, SETTINGS_INI),
    initialPath ? readText(files, toReal(initialPath)) : Promise.resolve(null),
  ]);
  if (initialPath && initial !== null) fileCache.set(toReal(initialPath), initial);
  const editorStatePath = ".local/state/piloti/editor-state.json";
  const stateRaw = await readText(files, editorStatePath);
  if (stateRaw) {
    try {
      stateCache.set(editorStatePath, JSON.parse(stateRaw));
    } catch {
      /* ignore corrupt state */
    }
  }

  const notepad = notepadRaw ? parseIniText(notepadRaw) : {};
  const general = generalRaw ? parseIniText(generalRaw) : {};
  const settings = settingsRaw ? parseIniText(settingsRaw) : {};

  let stateTimer: number | null = null;
  const flushState = () => {
    stateTimer = null;
    const value = stateCache.get(editorStatePath);
    if (value === undefined) return;
    void files.createDir(".local/state/piloti").catch(() => {});
    void files.write(editorStatePath, JSON.stringify(value)).catch(() => {});
  };
  addEventListener("pagehide", () => {
    if (stateTimer !== null) flushState();
  });

  const host: TextEditorHost = {
    nativeFs: true,
    normalizePath: (p) => p.replace(/\/+/g, "/"),
    peekFile: (p) => {
      const c = fileCache.get(toReal(p));
      return c === undefined ? undefined : { kind: "file", content: c };
    },
    watchFile: (p, listener) => {
      let stop: (() => void) | undefined;
      let dead = false;
      void files.watch(toReal(p)).then(async (r) => {
        if (dead) return;
        const watch = r.unwrapOr(undefined as never) as
          | { items: ReadableStream<unknown>; stop: () => void }
          | undefined;
        if (!watch) return;
        stop = watch.stop;
        const reader = watch.items.getReader();
        for (;;) {
          const { done } = await reader.read();
          if (done || dead) break;
          listener();
        }
      });
      return () => {
        dead = true;
        stop?.();
      };
    },
    onRenamed: () => () => {},
    renameFile: () => null,
    readMetadata: async () => ({}),
    writeMetadata: () => {},
    readState: <T,>(path: string, isValid: (v: unknown) => v is T) => {
      const v = stateCache.get(toReal(path));
      return isValid(v) ? v : null;
    },
    writeState: (path, value) => {
      stateCache.set(toReal(path), value);
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
      fs: {
        readText: (p) => readText(files, toReal(p)),
        writeText: async (p, content) => {
          const r = await files.write(toReal(p), content).catch(() => null);
          return Boolean(r?.isOk?.());
        },
        listDir: async () => [],
      },
      setTitle: (title) => {
        document.title = title;
      },
      closeWindow: () => window.close(),
    },
  };
  return { host, settings };
}
