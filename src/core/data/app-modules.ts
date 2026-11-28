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
  /** Its window's first and smallest size, for an app smaller than a web page. */
  size?: { width: number; height: number };
}

const APPS_ROOT = "/usr/share/piloti-desktop/apps";

export const APP_MODULES: readonly AppModuleDef[] = [
  { id: "hello", dir: `${APPS_ROOT}/hello`, csd: false },
  // The basic keypad; the module then asks for the size it needs.
  {
    id: "calculator",
    dir: `${APPS_ROOT}/calculator`,
    csd: false,
    size: { width: 196, height: 320 },
  },
  { id: "image-viewer", dir: `${APPS_ROOT}/image-viewer`, csd: false, size: { width: 640, height: 480 } },
  { id: "selfies", dir: `${APPS_ROOT}/selfies`, csd: false, size: { width: 520, height: 420 } },
  {
    id: "system-monitor",
    dir: `${APPS_ROOT}/system-monitor`,
    csd: false,
    size: { width: 560, height: 520 },
  },
  {
    id: "texts",
    dir: `${APPS_ROOT}/texts`,
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
 * The shell and a module share only the module's URL and the disk. After `#` a
 * module puts its open file and the name it goes by (`lib/apps/module-channel.ts`);
 * the shell leaves the moves of files in `MODULE_MOVES_FILE`.
 */
export const documentHash = (path: string, instance?: string) =>
  `#${encodeURIComponent(path)}${instance ? `&i=${instance}` : ""}`;

export function moduleDocument(url: string | undefined): string | null {
  const hash = url?.split("#")[1]?.split("&")[0];
  if (!hash) return null;
  try {
    return decodeURIComponent(hash);
  } catch {
    return null;
  }
}

export const moduleInstance = (url: string | undefined): string | null =>
  /#[^#]*&i=([a-z0-9-]+)$/.exec(url ?? "")?.[1] ?? null;

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
