import { VFS_HOME, rehome } from "@/core/state/vfs-home";
import {
  WEB_VFS_HOME,
  WEB_VFS_TRASH,
  basename,
  dirname,
  type WebVfsEntry,
} from "@/core/files/vfs-paths";
import type { KeyValueStorage } from "@/core/ports/vfs-persistence";
import { DEFAULT_MIMEAPPS_INI } from "@/core/xdg/xdg-mimeapps";
import { DATA_DIRS, DATA_FILES } from "./data-files";

// What the browser demo starts with (and tops up on every load). Native never uses this.
// The shipped files spell the home folder `/home/user`. Read when needed:
// they arrive just before the shell starts (`loadDataFiles`).
const inHome = (path: string) => path === "/home/user" || path.startsWith("/home/user/");

function shippedDefaults() {
  const homeFiles: Record<string, string> = Object.fromEntries(
    Object.entries(DATA_FILES)
      .filter(([path]) => inHome(path))
      .map(([path, content]) => [rehome(path), content])
  );
  const homeDirs = ["/home/user", ...DATA_DIRS.filter(inHome)].map(rehome);
  const applications = `${VFS_HOME}/.local/share/applications/`;
  return {
    homeFiles,
    dirs: Array.from(new Set(["/etc", "/home", WEB_VFS_HOME, ...homeDirs, WEB_VFS_TRASH])),
    mimeApps: homeFiles[`${VFS_HOME}/.config/mimeapps.list`] ?? DEFAULT_MIMEAPPS_INI,
    welcome: homeFiles[`${VFS_HOME}/Desktop/Welcome.html`] ?? "",
    desktopFiles: Object.fromEntries(
      Object.entries(homeFiles)
        .filter(([p]) => p.startsWith(applications) && p.endsWith(".desktop"))
        .map(([p, content]) => [p.slice(applications.length), content])
    ),
  };
}

export function createInitialVfs(): WebVfsEntry[] {
  const defaults = shippedDefaults();
  const now = Date.now();
  const entries: WebVfsEntry[] = defaults.dirs.map((dirPath) => ({
    id: dirPath,
    name: basename(dirPath),
    kind: "directory",
    path: dirPath,
    parentPath: dirname(dirPath),
    updatedAt: now,
  }));

  for (const [fullPath, content] of Object.entries(defaults.homeFiles)) {
    entries.push({
      id: fullPath,
      name: basename(fullPath),
      kind: "file",
      path: fullPath,
      parentPath: dirname(fullPath),
      content,
      updatedAt: now,
    });
  }

  return entries;
}

/**
 * Adds any demo defaults that are missing from an existing VFS (new default
 * files shipped in an update, the one-time Welcome file). Returns true if
 * `entries` changed and must be persisted.
 */
export function topUpDefaults(entries: WebVfsEntry[], kv: KeyValueStorage | null): boolean {
  const defaults = shippedDefaults();
  let addedDefaults = false;
  const welcomeFlagKey = "piloti.web.vfs.welcome.v1";
    if (kv && !kv.getItem(welcomeFlagKey)) {
      kv.setItem(welcomeFlagKey, "1");
      const hasWelcome = entries.some(
        (e) =>
          e.path === `${VFS_HOME}/Desktop/Welcome.html` ||
          e.path === `${WEB_VFS_TRASH}/Welcome.html`
      );
      if (!hasWelcome) {
        entries.push({
          id: `${VFS_HOME}/Desktop/Welcome.html`,
          name: "Welcome.html",
          kind: "file",
          path: `${VFS_HOME}/Desktop/Welcome.html`,
          parentPath: `${VFS_HOME}/Desktop`,
          content: defaults.welcome,
          updatedAt: Date.now(),
        });
        addedDefaults = true;
      }
    }
    const now = Date.now();
    if (!entries.some((e) => e.path === `${VFS_HOME}/.config/mimeapps.list`)) {
      if (!entries.some((e) => e.path === `${VFS_HOME}/.config`)) {
        entries.push({
          id: `${VFS_HOME}/.config`,
          name: ".config",
          kind: "directory",
          path: `${VFS_HOME}/.config`,
          parentPath: `${VFS_HOME}`,
          updatedAt: now,
        });
      }
      entries.push({
        id: `${VFS_HOME}/.config/mimeapps.list`,
        name: "mimeapps.list",
        kind: "file",
        path: `${VFS_HOME}/.config/mimeapps.list`,
        parentPath: `${VFS_HOME}/.config`,
        content: defaults.mimeApps,
        updatedAt: now,
      });
      addedDefaults = true;
    }
    for (const dirPath of defaults.dirs) {
      if (!entries.some((e) => e.path === dirPath)) {
        entries.push({
          id: dirPath,
          name: basename(dirPath),
          kind: "directory",
          path: dirPath,
          parentPath: dirname(dirPath),
          updatedAt: now,
        });
        addedDefaults = true;
      }
    }
    for (const [fileName, content] of Object.entries(defaults.desktopFiles)) {
      const fullPath = `${VFS_HOME}/.local/share/applications/${fileName}`;
      if (!entries.some((e) => e.path === fullPath)) {
        entries.push({
          id: fullPath,
          name: fileName,
          kind: "file",
          path: fullPath,
          parentPath: `${VFS_HOME}/.local/share/applications`,
          content,
          updatedAt: now,
        });
        addedDefaults = true;
      }
    }
    for (const [fullPath, content] of Object.entries(defaults.homeFiles)) {
      if (
        (fullPath === `${VFS_HOME}/.hidden` ||
          fullPath.startsWith(`${VFS_HOME}/Templates/`)) &&
        !entries.some((e) => e.path === fullPath)
      ) {
        entries.push({
          id: fullPath,
          name: basename(fullPath),
          kind: "file",
          path: fullPath,
          parentPath: dirname(fullPath),
          content,
          updatedAt: now,
        });
        addedDefaults = true;
      }
    }
    // Old demos seeded a "Desktop Shell" launcher; Terminal replaced it.
    const staleShell = `${VFS_HOME}/.local/share/applications/piloti-shell.desktop`;
    const staleIndex = entries.findIndex((e) => e.path === staleShell);
    if (staleIndex >= 0) {
      entries.splice(staleIndex, 1);
      addedDefaults = true;
    }
    // Old demos had copies of the system's app launchers in the home folder,
    // which listed those apps twice.
    for (const name of ["appstore", "calculator", "console", "files", "image-viewer", "login", "notepad", "settings"]) {
      const copy = `${VFS_HOME}/.local/share/applications/piloti-${name}.desktop`;
      const index = entries.findIndex((e) => e.path === copy);
      if (index >= 0) {
        entries.splice(index, 1);
        addedDefaults = true;
      }
    }
    // These moved to /usr/share/piloti/plugins: old demos' copies would shadow them.
    for (const id of ["app-dark-mode", "aurora-drift", "picture-in-picture"]) {
      const dir = `${VFS_HOME}/.config/piloti/plugins/${id}`;
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        const path = entries[i]!.path;
        if (path !== dir && !path.startsWith(`${dir}/`)) continue;
        entries.splice(i, 1);
        addedDefaults = true;
      }
    }
    // Bundled plugins ship with the shell (like /usr/share on native): keep
    // the demo's copies current, so updates and new plugins reach old demos.
    const pluginsPrefix = `${VFS_HOME}/.config/piloti/plugins/`;
    for (const [fullPath, content] of Object.entries(defaults.homeFiles)) {
      if (!fullPath.startsWith(pluginsPrefix)) continue;
      const existing = entries.find((e) => e.path === fullPath);
      if (!existing) {
        entries.push({
          id: fullPath,
          name: basename(fullPath),
          kind: "file",
          path: fullPath,
          parentPath: dirname(fullPath),
          content,
          updatedAt: now,
        });
        addedDefaults = true;
      } else if (existing.kind === "file" && existing.content !== content) {
        existing.content = content;
        existing.updatedAt = now;
        addedDefaults = true;
      }
    }
  return addedDefaults;
}

/** The browser demo's starting tree, for `setVfsSeed` in `piloti-web.tsx`. */
export const demoVfsSeed = {
  create: createInitialVfs,
  topUp: topUpDefaults,
};
