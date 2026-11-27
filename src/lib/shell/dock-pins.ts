/**
 * Apps dragged onto the Dock: which Dock entry a dragged item stands for.
 * Only installed apps can be pinned, as in GNOME's dash.
 */
import type { IconGridItem } from "@/lib/shell/desktop-icons";

interface InstalledApp {
  appId: string;
  desktopId: string;
  exec?: string;
}

export interface DockPinCatalog {
  builtins: readonly { id: string; command?: string; builtinComponent?: string }[];
  installed: readonly InstalledApp[];
  webApps: readonly { id: string; url: string }[];
}

type PinSource = Pick<IconGridItem, "id" | "path" | "kind" | "desktopEntry">;

/** An app, or a `.desktop` file describing one. */
export const isAppLauncherItem = (item: Pick<IconGridItem, "kind" | "path">): boolean =>
  item.kind === "desktop-entry" || (item.kind === "file" && item.path.endsWith(".desktop"));

const programOf = (exec?: string) => exec?.trim().split(/\s+/)[0]?.split("/").pop();

/**
 * The id to pin for `item`, or null when it names no installed app. `entry` is
 * the parsed `.desktop` file, when the item doesn't carry it.
 */
export function dockPinIdFor(
  item: PinSource,
  catalog: DockPinCatalog,
  entry: { desktopId: string; exec?: string } | undefined = item.desktopEntry,
): string | null {
  if (item.id.startsWith("app:builtin:")) return item.id.slice("app:builtin:".length);
  if (item.id.startsWith("app:web:")) return item.id.slice("app:web:".length);

  const desktopId = (
    entry?.desktopId ??
    (item.id.startsWith("app:xdg:")
      ? item.id.slice("app:xdg:".length)
      : item.path.slice(item.path.lastIndexOf("/") + 1))
  ).toLowerCase();
  const installed = catalog.installed.find((app) => app.desktopId.toLowerCase() === desktopId);
  const exec = entry?.exec ?? installed?.exec;

  const builtin = catalog.builtins.find(
    (app) => app.builtinComponent && app.command && app.command === programOf(exec),
  );
  if (builtin) return builtin.id;
  if (programOf(exec) === "piloti-webapp") {
    const url = exec!.trim().split(/\s+/)[1]?.replace(/^["']|["']$/g, "");
    const web = catalog.webApps.find((app) => app.url === url);
    if (web) return web.id;
  }
  return installed?.appId ?? null;
}

/** `pinned` with `ids` added before `beforeId`, or at the end. Pinned ones stay put. */
export function addDockPins(
  pinned: readonly string[],
  ids: readonly string[],
  beforeId?: string,
): string[] {
  const added = [...new Set(ids)].filter((id) => !pinned.includes(id));
  const at = beforeId ? pinned.indexOf(beforeId) : -1;
  const index = at < 0 ? pinned.length : at;
  return [...pinned.slice(0, index), ...added, ...pinned.slice(index)];
}
