/**
 * FreeDesktop.org XDG Base Directory Specification (v0.8).
 * https://specifications.freedesktop.org/basedir-spec/latest/
 */

type EnvMap = Record<string, string | undefined>;

interface XdgFileReader {
  readDir: (
    path: string
  ) => Promise<{
    match: <U>(m: {
      Ok: (entries: { name: string; fileType: number }[]) => U;
      Err: () => U;
    }) => U;
  }>;
  readText: (
    path: string
  ) => Promise<{
    match: <U>(m: { Ok: (text: string) => U; Err: () => U }) => U;
  }>;
  read?: (
    path: string
  ) => Promise<{
    match: <U>(m: { Ok: (bytes: Uint8Array) => U; Err: () => U }) => U;
  }>;
}

function getEnv(override?: EnvMap): EnvMap {
  if (override) return override;
  if (typeof process !== "undefined" && process.env) return process.env;
  return {};
}

function joinHome(home: string | undefined, rel: string): string {
  if (!home) return rel;
  return `${home.replace(/\/+$/, "")}/${rel}`;
}

function splitColonPaths(raw: string | undefined, fallback: readonly string[]): string[] {
  if (!raw || raw.trim() === "") return [...fallback];
  return raw
    .split(":")
    .map((p) => p.trim())
    .filter((p) => p.startsWith("/"));
}

function xdgDataHome(env?: EnvMap): string {
  const e = getEnv(env);
  const val = e.XDG_DATA_HOME;
  if (val && val.startsWith("/")) return val;
  return joinHome(e.HOME, ".local/share");
}

function xdgConfigHome(env?: EnvMap): string {
  const e = getEnv(env);
  const val = e.XDG_CONFIG_HOME;
  if (val && val.startsWith("/")) return val;
  return joinHome(e.HOME, ".config");
}

function xdgStateHome(env?: EnvMap): string {
  const e = getEnv(env);
  const val = e.XDG_STATE_HOME;
  if (val && val.startsWith("/")) return val;
  return joinHome(e.HOME, ".local/state");
}

function xdgCacheHome(env?: EnvMap): string {
  const e = getEnv(env);
  const val = e.XDG_CACHE_HOME;
  if (val && val.startsWith("/")) return val;
  return joinHome(e.HOME, ".cache");
}

function xdgRuntimeDir(env?: EnvMap): string | undefined {
  const val = getEnv(env).XDG_RUNTIME_DIR;
  return val && val.startsWith("/") ? val : undefined;
}

function xdgDataDirs(env?: EnvMap): string[] {
  return splitColonPaths(getEnv(env).XDG_DATA_DIRS, [
    "/usr/local/share",
    "/usr/share",
  ]);
}

function xdgConfigDirs(env?: EnvMap): string[] {
  return splitColonPaths(getEnv(env).XDG_CONFIG_DIRS, ["/etc/xdg"]);
}

function getXdgApplicationDirs(env?: EnvMap): string[] {
  const e = getEnv(env);
  const dataHome = xdgDataHome(e);
  const dirs = [
    `${dataHome}/applications`,
    joinHome(e.HOME, ".local/share/flatpak/exports/share/applications"),
    "/var/lib/flatpak/exports/share/applications",
    "/var/lib/snapd/desktop/applications",
    ...xdgDataDirs(e).map((d) => `${d.replace(/\/+$/, "")}/applications`),
  ];
  return Array.from(new Set(dirs));
}

function getXdgIconBaseDirs(env?: EnvMap): string[] {
  const e = getEnv(env);
  const dataHome = xdgDataHome(e);
  const dirs = [
    joinHome(e.HOME, ".icons"),
    `${dataHome}/icons`,
    joinHome(e.HOME, ".local/share/flatpak/exports/share/icons"),
    "/var/lib/flatpak/exports/share/icons",
    ...xdgDataDirs(e).map((d) => `${d.replace(/\/+$/, "")}/icons`),
    "/var/lib/snapd/desktop/icons",
  ];
  return Array.from(new Set(dirs));
}

const XDG_APPLICATION_DIRS: readonly string[] = [
  ".local/share/applications",
  ".local/share/flatpak/exports/share/applications",
  "/var/lib/flatpak/exports/share/applications",
  "/var/lib/snapd/desktop/applications",
  "/usr/local/share/applications",
  "/usr/share/applications",
];

const XDG_ICON_BASE_DIRS: readonly string[] = [
  ".icons",
  ".local/share/icons",
  ".local/share/flatpak/exports/share/icons",
  "/var/lib/flatpak/exports/share/icons",
  "/usr/local/share/icons",
  "/usr/share/icons",
  "/var/lib/snapd/desktop/icons",
];

const XDG_PIXMAPS_DIRS: readonly string[] = [
  "/usr/share/pixmaps",
  "/usr/local/share/pixmaps",
];

export {
  XDG_APPLICATION_DIRS,
  XDG_ICON_BASE_DIRS,
  XDG_PIXMAPS_DIRS,
  getXdgApplicationDirs,
  getXdgIconBaseDirs,
  xdgCacheHome,
  xdgConfigDirs,
  xdgConfigHome,
  xdgDataDirs,
  xdgDataHome,
  xdgRuntimeDir,
  xdgStateHome,
};
export type { EnvMap, XdgFileReader };

