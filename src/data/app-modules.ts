/**
 * Our Domicile app modules (see docs/ARCHITECTURE.md). A module's window
 * arrives as a browser window at `domicile://app-<hash>/`, where hash is the
 * first 32 hex digits of SHA-256 of the module's directory. Hashing the
 * directories of the modules we ship lets the shell recognise them.
 */
export interface AppModuleDef {
  id: string;
  dir: string;
  /** The module draws its own header; the shell adds only controls + drag strip. */
  csd: boolean;
  /** Pixels reserved by the module's header: shell controls at the edges (whichever side the button layout uses), module buttons next to them. */
  drag?: { left: number; right: number; height: number };
}

const APPS_ROOT = "/usr/share/piloti-desktop/apps";

export const APP_MODULES: readonly AppModuleDef[] = [
  { id: "hello", dir: `${APPS_ROOT}/hello`, csd: false },
  {
    id: "text-editor",
    dir: `${APPS_ROOT}/text-editor`,
    csd: true,
    drag: { left: 96, right: 200, height: 36 },
  },
];

const byHash = new Map<string, AppModuleDef>();

export async function initAppModules(): Promise<void> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return;
  for (const mod of APP_MODULES) {
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(mod.dir));
    const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    byHash.set(hex.slice(0, 32), mod);
  }
}

export function resolveAppModuleByUrl(url: string | undefined): AppModuleDef | undefined {
  const m = /^domicile:\/\/app-([0-9a-f]{32})/.exec(url ?? "");
  return m ? byHash.get(m[1]!) : undefined;
}

/**
 * The shell and a module share no channel but the module's URL and the disk:
 * a module puts its open file after `#`, and the shell leaves the moves of
 * files in `MODULE_MOVES_FILE` (relative to `$HOME`).
 */
export const documentHash = (path: string) => `#${encodeURIComponent(path)}`;

export function moduleDocument(url: string | undefined): string | null {
  const hash = url?.split("#")[1];
  if (!hash) return null;
  try {
    return decodeURIComponent(hash);
  } catch {
    return null;
  }
}

export const MODULE_MOVES_DIR = ".cache/piloti/moves";
export const MODULE_MOVES_FILE = `${MODULE_MOVES_DIR}/moves.json`;

export interface ModuleMove {
  /** Rises with each move, also across shell restarts. */
  seq: number;
  from: string;
  to: string;
}

/**
 * The app a web view window belongs to. Our modules are known by their URL:
 * Domicile may list one as a plain page, which would make it the Web Browser's.
 */
export function webViewAppId(
  view: { id: string | number; url: string; appId?: string; isApp?: boolean },
  webAppId?: string,
): string {
  return (
    resolveAppModuleByUrl(view.url)?.id ||
    view.appId ||
    webAppId ||
    (view.isApp ? `webview:${view.id}` : "browser")
  );
}
