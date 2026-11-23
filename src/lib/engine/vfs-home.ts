/**
 * Root of the home folder in VFS paths. The browser demo uses the virtual
 * `/home/user`. The native shell sets `globalThis.__PILOTI_VFS_HOME__` to the
 * real `$HOME` (e.g. `/home/debian`) before any VFS module loads, so every path
 * the user sees or hands to another program is a real one.
 */
const injected = (globalThis as { __PILOTI_VFS_HOME__?: string }).__PILOTI_VFS_HOME__;

export const DEFAULT_VFS_HOME = "/home/user";
export const VFS_HOME: string = (injected || DEFAULT_VFS_HOME).replace(/\/+$/, "") || DEFAULT_VFS_HOME;

/** Maps a `/home/user/...` path (as written in generated defaults) to the real home. */
export function rehome(path: string): string {
  if (VFS_HOME === DEFAULT_VFS_HOME) return path;
  if (path === DEFAULT_VFS_HOME) return VFS_HOME;
  return path.startsWith(`${DEFAULT_VFS_HOME}/`)
    ? `${VFS_HOME}${path.slice(DEFAULT_VFS_HOME.length)}`
    : path;
}
