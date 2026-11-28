import type { XdgDesktopEntry } from "@/core/xdg/xdg-desktop-entry";

/** What runs a desktop entry (or one of its actions) with `files`; `null` if nothing does. */
export function entryCommand(
  entry: XdgDesktopEntry,
  actionId?: string,
  files: readonly string[] = [],
): { argv: string[]; cwd?: string } | null {
  const action = actionId ? entry.actions.find((a) => a.id === actionId) : undefined;
  const own = action && action.execArgv.length > 0 ? action.execArgv : null;
  // The parser already puts the entry's own command in a terminal, not an action's.
  const exec = own ? (entry.terminal ? ["kitty", "-e", ...own] : own) : entry.execArgv;
  if (exec.length === 0) return null;
  return { argv: [...exec, ...files], cwd: entry.workingDirectory };
}
