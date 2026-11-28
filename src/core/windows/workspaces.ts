/** Rules for workspaces, numbered from 1. */

/** Moving a window to `target`: the workspace it goes to, and how many there then are. */
export function moveToWorkspace(target: number, count: number): { workspace: number; count: number } {
  const workspace = Math.max(1, target);
  return { workspace, count: Math.max(count, workspace) };
}

/**
 * Taking a workspace away: its windows go to the first, later ones close the
 * gap. `null` if it is the only one.
 */
export function removeWorkspace(
  removed: number,
  { count, active }: { count: number; active: number },
): { remap: (workspace: number) => number; count: number; active: number } | null {
  if (count <= 1) return null;
  const remap = (workspace: number) =>
    workspace === removed ? 1 : workspace > removed ? workspace - 1 : workspace;
  return { remap, count: count - 1, active: Math.min(count - 1, remap(active)) };
}
