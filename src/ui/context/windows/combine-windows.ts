/** The shell's, the browser's and the Wayland windows as one list. */
import type { useWindows } from "@domicile-desktop/react/windows";
import type { Piloti } from "@/platform/shared/piloti";
import type { AppsContextValue } from "@/ui/context/AppsContext";
import type { DesktopSettings } from "@/ui/context/SettingsContext";
import type { BrowserTab, DesktopWindowInstance, ExternalWindowMeta } from "./types";
import type { FrameRoots } from "@/core/windows/layout/frames";
import type { StackNode } from "@/core/windows/layout/types";
import { findMatchingWebApp, getWebAppFaviconUrl, resolveWebAppTitle } from "@/core/data/web-apps";
import { resolveAppModuleByUrl, webViewAppId } from "@/core/data/app-modules";
import { resolveWaylandOuterConstraints } from "@/core/windows/window-bounds";
import { matchXdgEntryForWaylandWindow, resolveWaylandClientFrame, type XdgDesktopEntry } from "xdg-desktop-entry";
import { matchAppFromWayland } from "@/ui/context/AppsContext";

export interface CombineWindowsInput {
  shellWindows: readonly DesktopWindowInstance[];
  browserWindows: NonNullable<Piloti["browser"]["windows"]>;
  browserFavicons: Readonly<Record<string, string>>;
  browserTitles: Readonly<Record<string, string>>;
  browserMeta: Readonly<Record<string, ExternalWindowMeta>>;
  /** Web windows with several tabs (splits come later: only stacks for now). */
  browserTabGroups: FrameRoots;
  waylandWindows: ReturnType<typeof useWindows>;
  waylandMeta: Readonly<Record<string, ExternalWindowMeta>>;
  syncedParentFrames: ReadonlyMap<string, number>;
  installedXdgApps: XdgDesktopEntry[];
  getAppIconUrl: AppsContextValue["getAppIconUrl"];
  unreadyWindowIds: ReadonlySet<string>;
  screenWidth: number;
  screenHeight: number;
  settings: Pick<DesktopSettings, "installedWebApps" | "windowDecorationMode">;
  /** Titles given when a page was opened, until it has its own. */
  pendingWebTitles: ReadonlyMap<string, string>;
}

export function combineWindows({
  shellWindows,
  browserWindows,
  browserFavicons,
  browserTitles,
  browserMeta,
  browserTabGroups,
  waylandWindows,
  waylandMeta,
  syncedParentFrames,
  installedXdgApps,
  getAppIconUrl,
  unreadyWindowIds,
  screenWidth,
  screenHeight,
  settings,
  pendingWebTitles,
}: CombineWindowsInput): DesktopWindowInstance[] {
  const resolvedShellWindows = shellWindows.map((sw) => ({
    ...sw,
    iconUrl: sw.iconUrl ?? getAppIconUrl(sw.appId),
    ready: !unreadyWindowIds.has(sw.id),
  }));

  const toplevels = waylandWindows
    .filter((w) => w.parent === undefined)
    .flatMap((w): DesktopWindowInstance[] => {
      const meta = waylandMeta[w.appId];
      if (!meta) return [];
      const matched = matchAppFromWayland(w.desktopId, w.title);
      const xdgMatch = matchXdgEntryForWaylandWindow(
        installedXdgApps,
        w.desktopId
      );
      const resolvedIconUrl =
        xdgMatch?.iconUrl ??
        getAppIconUrl(w.desktopId) ??
        getAppIconUrl(w.appId) ??
        getAppIconUrl(matched.id);
      const clientFrame = resolveWaylandClientFrame(w, xdgMatch);
      const isCsdWindow =
        settings.windowDecorationMode === "csd" ||
        (settings.windowDecorationMode === "auto" && clientFrame);
      const constraints = resolveWaylandOuterConstraints(w, isCsdWindow);
      return [{
        id: `wayland:${w.appId}`,
        appId: xdgMatch?.appId ?? matched.id,
        title: w.title || xdgMatch?.name || matched.name || w.appId,
        iconName: matched.iconName,
        iconUrl: resolvedIconUrl,
        waylandAppId: w.appId,
        waylandDesktopId: w.desktopId,
        pid: w.pid,
        clientFrame,
        cursor: w.cursor,
        syncedFrame: syncedParentFrames.get(w.appId),
        tiled: meta.tiled ?? null,
        workspace: meta.workspace,
        position: meta.position,
        size: meta.size,
        minSize: {
          width: w.minWidth ? constraints.minSize.width : (matched.minSize?.width ?? constraints.minSize.width),
          height: w.minHeight ? constraints.minSize.height : (matched.minSize?.height ?? constraints.minSize.height),
        },
        maxSize:
          constraints.maxWidth || constraints.maxHeight
            ? {
                width: constraints.maxWidth ?? screenWidth,
                height: constraints.maxHeight ?? screenHeight,
              }
            : undefined,
        minimized: meta.minimized,
        maximized: meta.maximized,
        fullscreen: meta.fullscreen,
        pinned: meta.pinned,
        ready: !unreadyWindowIds.has(`wayland:${w.appId}`),
        zIndex: meta.zIndex,
      }];
    });

  const tabGroupOf = new Map<string, string>();
  const stacks: Record<string, StackNode> = {};
  for (const [group, root] of Object.entries(browserTabGroups)) {
    if (root.kind !== "stack") continue;
    stacks[group] = root;
    for (const tab of root.tabs) tabGroupOf.set(tab, group);
  }
  const describeBrowserWindow = (bw: (typeof browserWindows)[number]) => {
    const webAppMatch = findMatchingWebApp(bw.url, settings.installedWebApps);
    const pendingTitle =
      pendingWebTitles.get(bw.appId) ??
      pendingWebTitles.get(bw.url);
    const resolvedTitle =
      pendingTitle ??
      resolveWebAppTitle({
        rawUrl: bw.url,
        liveTitle: browserTitles[bw.id],
        hostTitle: bw.title,
        installedApps: settings.installedWebApps,
      });
    // Domicile app modules (`domicile open --app <entry.js>`) are our own
    // isolated apps: take title and icon from the window / desktop entry.
    const mod = resolveAppModuleByUrl(bw.url);
    const isAppModule = Boolean(mod || (bw.isApp && bw.url.startsWith("domicile://app-")));
    const appId = webViewAppId(bw, webAppMatch?.id);
    return {
      // Plain pages belong to the Web Browser (one Dock icon); app-mode
      // windows of sites that are not installed keep a tile of their own.
      appId,
      isModule: Boolean(mod),
      minSize: mod?.size,
      title: isAppModule
        ? browserTitles[bw.id] || bw.title || bw.appId || mod?.id || resolvedTitle
        : resolvedTitle,
      iconUrl: isAppModule
        ? (mod || bw.appId ? getAppIconUrl(appId) : undefined) ||
          browserFavicons[bw.id]
        : browserFavicons[bw.id] ||
          webAppMatch?.iconUrl ||
          getWebAppFaviconUrl(bw.url),
    };
  };
  const browserById = new Map(browserWindows.map((bw) => [bw.id, bw]));

  const listedGroups = new Set<string>();
  const resolvedBrowserWindows = browserWindows.flatMap((first): DesktopWindowInstance[] => {
    const group = tabGroupOf.get(first.id) ?? first.id;
    const grp = stacks[group];
    // One window per group, listed at its first tab (a stable DOM order,
    // so switching tabs never moves iframes) and drawn from the active one.
    if (grp) {
      if (listedGroups.has(group)) return [];
      listedGroups.add(group);
    }
    const bw = grp ? browserById.get(grp.active) ?? first : first;
    const meta = browserMeta[group];
    if (!meta) return [];
    const described = describeBrowserWindow(bw);
    const browserTabs = grp?.tabs.flatMap((tabId): BrowserTab[] => {
      const tab = browserById.get(tabId);
      if (!tab) return [];
      const d = tabId === bw.id ? described : describeBrowserWindow(tab);
      return [
        {
          id: tabId,
          url: tab.url,
          title: d.title,
          iconUrl: d.iconUrl,
          ...(grp.pinned?.includes(tabId) ? { pinned: true } : {}),
          ...(tab.isApp ? { isApp: true } : {}),
        },
      ];
    });
    return [{
      id: `browser:${group}`,
      // A Web Browser window stays one while an app module is its active tab.
      appId:
        meta.browserApp && (!described.isModule || (browserTabs?.length ?? 0) > 1)
          ? "browser"
          : described.appId,
      title: described.title,
      iconName: "globe",
      iconUrl: described.iconUrl,
      browserWindowId: bw.id,
      browserUrl: bw.url,
      browserIsApp: bw.isApp,
      browserTabs,
      clientFrame: true,
      workspace: meta.workspace,
      position: meta.position,
      size: meta.size,
      minSize: described.minSize ?? { width: 420, height: 300 },
      minimized: meta.minimized,
      maximized: meta.maximized,
      fullscreen: meta.fullscreen,
      pinned: meta.pinned,
      tiled: meta.tiled ?? null,
      ready: !unreadyWindowIds.has(`browser:${group}`),
      zIndex: meta.zIndex,
    }];
  });

  // Keep stable insertion order in DOM so zIndex CSS handles stacking without
  // moving <iframe> nodes via insertBefore (which reloads iframes on focus).
  return [...resolvedShellWindows, ...resolvedBrowserWindows, ...toplevels];
}
