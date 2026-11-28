import * as React from "react";
import { useApps } from "@/ui/context/DesktopStateContext";
import { readFsTextFile } from "@/platform/shared/fs-bridge";
import { usePiloti } from "@/platform/shared/piloti";
import type { IconGridItem } from "@/core/files/desktop-icons";
import { isLauncherItem, toLauncherItem } from "@/core/files/folder-items";

/** Shows `.desktop` files as launchers (name and icon of the app), as the desktop does. */
export function useLauncherItems(
  items: readonly IconGridItem[],
  enabled = true
): readonly IconGridItem[] {
  const piloti = usePiloti();
  const { getAppIconUrl, ensureWaylandIcons, installedXdgApps } = useApps();
  const [contents, setContents] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!enabled) return;
    const launchers = items.filter(isLauncherItem);
    if (launchers.length === 0) return;
    let stale = false;
    void Promise.all(
      launchers.map(async (item) => {
        const text = await readFsTextFile(piloti, item.path).catch(() => "");
        return [item.path, text ?? ""] as const;
      })
    ).then((read) => {
      if (stale) return;
      setContents((prev) =>
        read.every(([path, text]) => prev[path] === text)
          ? prev
          : { ...prev, ...Object.fromEntries(read) }
      );
    });
    return () => {
      stale = true;
    };
  }, [enabled, items, piloti]);

  const parsed = React.useMemo(
    () =>
      enabled
        ? items.map((item) =>
            isLauncherItem(item) && contents[item.path]
              ? toLauncherItem(item, contents[item.path])
              : item
          )
        : items,
    [contents, enabled, items]
  );

  React.useEffect(() => {
    const icons = parsed.flatMap((i) => (i.desktopEntry?.icon ? [i.desktopEntry.icon] : []));
    if (icons.length > 0) ensureWaylandIcons(icons);
  }, [ensureWaylandIcons, parsed]);

  // Icons resolve asynchronously: attach whatever is known by now.
  return React.useMemo(
    () =>
      parsed.map((item) => {
        const entry = item.desktopEntry;
        const url = entry
          ? (installedXdgApps.find(
              (app) => app.desktopId === entry.desktopId || app.appId === entry.appId
            )?.iconUrl ??
            getAppIconUrl(entry.icon) ??
            getAppIconUrl(entry.desktopId) ??
            getAppIconUrl(entry.appId))
          : item.iconCandidates?.map((c) => getAppIconUrl(c)).find(Boolean);
        return url && url !== item.iconUrl ? { ...item, iconUrl: url } : item;
      }),
    [getAppIconUrl, installedXdgApps, parsed]
  );
}
