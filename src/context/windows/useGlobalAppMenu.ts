import { resolveAppModuleByUrl } from "@/data/app-modules";
import * as React from "react";
import { selectAll } from "@/lib/core/select-all";
import { APP_CATALOG, type AppDefinition } from "@/data/catalog";
import { type InstalledWebApp, resolveWebAppTitle } from "@/data/web-apps";
import type { XdgDesktopEntry } from "xdg-desktop-entry";
import { getEngine } from "@/lib/engine/engine";
import { matchAppFromWayland } from "../AppsContext";
import type { SystemBackendsContextValue } from "../SystemBackendsContext";
import type { DesktopWindowInstance } from "../WindowsContext";
import { getRunIn, RUN_SEPARATELY_ACTION, setRunIn } from "@/lib/windows/run-mode";

export interface UseGlobalAppMenuParams {
  focusedWindow: DesktopWindowInstance | undefined;
  focusedWindowId: string | null;
  installedWebApps: InstalledWebApp[];
  installedXdgApps: XdgDesktopEntry[];
  backendsCtx: SystemBackendsContextValue;
  closeWindow: (id: string) => void;
  toggleMinimizeWindow: (id: string) => void;
  toggleMaximizeWindow: (id: string) => void;
  tileWindow: (id: string, side: "left" | "right") => void;
  launchApp: (
    appId: string,
    options?: { payload?: string; forceNew?: boolean; forceCsd?: boolean },
  ) => void;
  setLauncherOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setControlPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useGlobalAppMenu({
  focusedWindow,
  focusedWindowId,
  installedWebApps,
  installedXdgApps,
  backendsCtx,
  closeWindow,
  toggleMinimizeWindow,
  toggleMaximizeWindow,
  tileWindow,
  launchApp,
  setLauncherOpen,
  setControlPanelOpen,
}: UseGlobalAppMenuParams) {
  const activeAppDef = React.useMemo<AppDefinition>(() => {
    if (focusedWindow) {
      // Our app modules are web views too, but they are our apps, not web pages.
      // The shell can't reach their menu actions.
      const moduleDef =
        resolveAppModuleByUrl(focusedWindow.browserUrl) &&
        APP_CATALOG.find((a) => a.id === focusedWindow.appId);
      if (moduleDef) return { ...moduleDef, menus: [] };
      if (focusedWindow.browserWindowId) {
        const safeLabel = resolveWebAppTitle({
          rawUrl: focusedWindow.browserUrl,
          hostTitle: focusedWindow.title,
          installedApps: installedWebApps,
          fallback: "Web",
        });
        return {
          ...(APP_CATALOG.find((a) => a.id === "browser") ?? {
            category: "Internet" as const,
            iconName: "globe" as const,
            pinnedByDefault: false,
            defaultSize: { width: 880, height: 560 },
            menus: [],
          }),
          id: focusedWindow.appId,
          name: safeLabel,
          shortName: safeLabel,
          description: focusedWindow.browserUrl || "Web Application",
          iconUrl: focusedWindow.iconUrl,
        };
      }
      const def = APP_CATALOG.find((a) => a.id === focusedWindow.appId);
      if (def) return def;
      const xdgMatch = installedXdgApps.find(
        (e) =>
          e.appId === focusedWindow.appId ||
          e.desktopId === focusedWindow.appId ||
          e.appId.toLowerCase() === focusedWindow.appId.toLowerCase() ||
          e.desktopId.replace(/\.desktop$/i, "").toLowerCase() ===
            focusedWindow.appId.toLowerCase(),
      );
      const matched = matchAppFromWayland(
        focusedWindow.appId,
        focusedWindow.title,
      );
      if (xdgMatch) {
        return {
          ...matched,
          id: xdgMatch.appId,
          name: xdgMatch.name,
          shortName: xdgMatch.name,
          iconUrl: xdgMatch.iconUrl ?? matched.iconUrl,
        };
      }
      return matched;
    }
    return {
      id: "desktop",
      name: "Desktop",
      shortName: "Desktop",
      description: "Piloti Desktop Shell",
      category: "System",
      iconName: "sparkles",
      pinnedByDefault: false,
      defaultSize: { width: 800, height: 500 },
      menus: [
        {
          title: "File",
          items: [
            {
              label: "New Folder",
              actionId: "desktop:new-folder",
            },
            {
              label: "New Text File",
              actionId: "desktop:new-text-file",
            },
          ],
        },
        {
          title: "View",
          items: [
            ...(!getEngine().capabilities.compositor
              ? [
                  {
                    label: "Full Screen",
                    actionId: "shell:fullscreen",
                    separatorAfter: true,
                  },
                ]
              : []),
            {
              label: "Arrange Icons",
              actionId: "desktop:align-icons",
            },
            {
              label: "Change Wallpaper",
              actionId: "launch:wallpaper",
            },
          ],
        },
      ],
    };
  }, [focusedWindow, installedWebApps, installedXdgApps]);

  const handleMenuAction = React.useCallback(
    (actionId: string) => {
      if (actionId === "window:close" && focusedWindowId) {
        closeWindow(focusedWindowId);
      } else if (actionId === "window:minimize" && focusedWindowId) {
        toggleMinimizeWindow(focusedWindowId);
      } else if (actionId === "window:zoom" && focusedWindowId) {
        toggleMaximizeWindow(focusedWindowId);
      } else if (actionId === "window:tile-left" && focusedWindowId) {
        tileWindow(focusedWindowId, "left");
      } else if (actionId === "window:tile-right" && focusedWindowId) {
        tileWindow(focusedWindowId, "right");
      } else if (actionId === RUN_SEPARATELY_ACTION && focusedWindow) {
        const { appId } = focusedWindow;
        setRunIn(appId, getRunIn(appId) === "isolated" ? "shell" : "isolated");
      } else if (actionId === "app:new-window" && focusedWindow) {
        launchApp(focusedWindow.appId, { forceNew: true });
      } else if (actionId === "edit:select-all") {
        // Once the menu has closed and given focus back.
        window.setTimeout(() => selectAll(focusedWindowId), 0);
      } else if (actionId === "desktop:new-folder") {
        window.dispatchEvent(new CustomEvent("piloti:desktop-new-folder"));
      } else if (actionId === "desktop:new-text-file") {
        window.dispatchEvent(new CustomEvent("piloti:desktop-new-file"));
      } else if (actionId === "desktop:align-icons") {
        window.dispatchEvent(new CustomEvent("piloti:desktop-align-icons"));
      } else if (actionId === "shell:fullscreen") {
        if (typeof document !== "undefined") {
          if (document.fullscreenElement) {
            void document.exitFullscreen?.();
          } else {
            void document.documentElement.requestFullscreen?.();
          }
        }
      } else if (actionId === "launch:wallpaper") {
        launchApp("settings", { payload: "wallpaper" });
      } else if (actionId === "files:new-folder") {
        window.dispatchEvent(new CustomEvent("piloti:files-new-folder"));
      } else if (actionId === "files:new-text-file") {
        window.dispatchEvent(new CustomEvent("piloti:files-new-file"));
      } else if (actionId === "shell:screenshot") {
        void backendsCtx.takeScreenshot();
      } else if (actionId === "shell:record") {
        void backendsCtx.startScreenRecording();
      } else if (actionId === "shell:reload") {
        window.location.reload();
      } else if (actionId.startsWith("settings:")) {
        const section = actionId.split(":")[1];
        launchApp("settings", { payload: section });
      } else if (actionId.startsWith("console:")) {
        const mod = actionId.split(":")[1];
        launchApp("console", { payload: mod });
      } else if (actionId.startsWith("launch:")) {
        const target = actionId.split(":")[1];
        launchApp(target);
      } else if (
        actionId === "shell:launcher" ||
        actionId === "shell:palette"
      ) {
        setLauncherOpen(true);
      } else if (
        actionId === "shell:control-panel" ||
        actionId === "shell:control-center"
      ) {
        setControlPanelOpen((v) => !v);
      } else if (
        (actionId.startsWith("texts:") || actionId.startsWith("files:")) &&
        focusedWindowId
      ) {
        window.dispatchEvent(
          new CustomEvent("piloti:app-action", {
            detail: { windowId: focusedWindowId, actionId },
          }),
        );
      }
    },
    [
      backendsCtx,
      closeWindow,
      focusedWindow,
      focusedWindowId,
      launchApp,
      setControlPanelOpen,
      setLauncherOpen,
      tileWindow,
      toggleMaximizeWindow,
      toggleMinimizeWindow,
    ],
  );

  return { activeAppDef, handleMenuAction };
}

