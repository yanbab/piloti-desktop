import { VFS_HOME, rehome } from "@/lib/engine/vfs-home";
import {
  WEB_VFS_HOME,
  WEB_VFS_TRASH,
  basename,
  dirname,
  type WebVfsEntry,
} from "@/lib/core/vfs-paths";
import type { KeyValueStorage } from "@/lib/ports/vfs-persistence";
import { DEFAULT_MIMEAPPS_INI } from "@/lib/xdg/xdg-mimeapps";
import {
  DEFAULT_HOME_DIRS as GENERATED_HOME_DIRS,
  DEFAULT_HOME_FILES as GENERATED_HOME_FILES,
} from "./default-vfs-tree";

// What the browser demo starts with (and tops up on every load). Native never uses this.
export const DEFAULT_HOME_DIRS: readonly string[] = GENERATED_HOME_DIRS.map(rehome);
export const DEFAULT_HOME_FILES: Record<string, string> = Object.fromEntries(
  Object.entries(GENERATED_HOME_FILES).map(([path, content]) => [rehome(path), content]),
);

export const DEFAULT_ETC_ISSUE = `Piloti Desktop Web VFS (localStorage)
Type 'help' for shell commands, 'piloti help' for desktop controls, or 'cat ~/Documents/Notes.txt'.
`;

const DEMO_MIMEAPPS_INI =
  DEFAULT_HOME_FILES[`${VFS_HOME}/.config/mimeapps.list`] ?? DEFAULT_MIMEAPPS_INI;

export const WELCOME_HTML =
  DEFAULT_HOME_FILES[`${VFS_HOME}/Desktop/Welcome.html`] ?? "";

const DEFAULT_DIRS = Array.from(
  new Set(["/etc", "/home", WEB_VFS_HOME, ...DEFAULT_HOME_DIRS, WEB_VFS_TRASH]),
);

const DEFAULT_LOCAL_DESKTOP_FILES: Record<string, string> = Object.fromEntries(
  Object.entries(DEFAULT_HOME_FILES)
    .filter(([p]) => p.startsWith(`${VFS_HOME}/.local/share/applications/`) && p.endsWith(".desktop"))
    .map(([p, content]) => [p.slice(`${VFS_HOME}/.local/share/applications/`.length), content]),
);

export function createInitialVfs(): WebVfsEntry[] {
  const now = Date.now();
  const entries: WebVfsEntry[] = DEFAULT_DIRS.map((dirPath) => ({
    id: dirPath,
    name: basename(dirPath),
    kind: "directory",
    path: dirPath,
    parentPath: dirname(dirPath),
    updatedAt: now,
  }));

  entries.push({
    id: "/etc/issue",
    name: "issue",
    kind: "file",
    path: "/etc/issue",
    parentPath: "/etc",
    content: DEFAULT_ETC_ISSUE,
    updatedAt: now,
  });

  for (const [fullPath, content] of Object.entries(DEFAULT_HOME_FILES)) {
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
          content: WELCOME_HTML,
          updatedAt: Date.now(),
        });
        addedDefaults = true;
      }
    }
    const now = Date.now();
    if (!entries.some((e) => e.path === "/etc/issue")) {
      if (!entries.some((e) => e.path === "/etc")) {
        entries.push({
          id: "/etc",
          name: "etc",
          kind: "directory",
          path: "/etc",
          parentPath: "/",
          updatedAt: now,
        });
      }
      entries.push({
        id: "/etc/issue",
        name: "issue",
        kind: "file",
        path: "/etc/issue",
        parentPath: "/etc",
        content: DEFAULT_ETC_ISSUE,
        updatedAt: now,
      });
      addedDefaults = true;
    }
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
        content: DEMO_MIMEAPPS_INI,
        updatedAt: now,
      });
      addedDefaults = true;
    }
    for (const dirPath of DEFAULT_DIRS) {
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
    for (const [fileName, content] of Object.entries(DEFAULT_LOCAL_DESKTOP_FILES)) {
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
    for (const [fullPath, content] of Object.entries(DEFAULT_HOME_FILES)) {
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
    // Bundled plugins ship with the shell (like /usr/share on native): keep
    // the demo's copies current, so updates and new plugins reach old demos.
    const pluginsPrefix = `${VFS_HOME}/.config/piloti/plugins/`;
    for (const [fullPath, content] of Object.entries(DEFAULT_HOME_FILES)) {
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
