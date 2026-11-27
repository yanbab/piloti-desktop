import * as React from "react";
import type { Piloti } from "@/lib/engine/piloti";
import { launchDesktopCommand } from "@/lib/engine/system-commands";
import { emitShellEvent } from "@/lib/core/shell-events";
import { useCapabilities } from "@/hooks/use-capabilities";

export interface UseGlobalShortcutsParams {
  piloti: Piloti;
  overviewOpen: boolean;
  setOverviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleOverview: () => void;
  setLauncherOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setControlPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  altTabOpen: boolean;
  cycleAltTab: (dir: 1 | -1) => void;
  commitAltTab: () => void;
  closeAltTab: () => void;
  switchWorkspace: (delta: -1 | 1) => void;
  takeScreenshot: () => Promise<void>;
  focusedWindowId: string | null;
  launchApp: (
    appId: string,
    options?: { payload?: string; forceNew?: boolean; forceCsd?: boolean },
  ) => void;
  closeWindow: (id: string) => void;
  toggleMinimizeWindow: (id: string) => void;
  toggleMaximizeWindow: (id: string) => void;
  tileWindow: (id: string, side: "left" | "right") => void;
}

export function useGlobalShortcuts({
  piloti,
  overviewOpen,
  setOverviewOpen,
  toggleOverview,
  setLauncherOpen,
  setControlPanelOpen,
  altTabOpen,
  cycleAltTab,
  commitAltTab,
  closeAltTab,
  switchWorkspace,
  takeScreenshot,
  focusedWindowId,
  launchApp,
  closeWindow,
  toggleMinimizeWindow,
  toggleMaximizeWindow,
  tileWindow,
}: UseGlobalShortcutsParams) {
  const { compositor } = useCapabilities();
  // Global Domicile key grabs
  React.useEffect(() => {
    const chords = [
      "Alt+Space",
      "Alt+space",
      "Alt+Tab",
      "Alt+Shift+Tab",
      "Meta+Return",
      "Meta+Left",
      "Meta+Right",
      "Meta+Up",
      "F3",
      "Print",
      "Meta+k",
    ];
    for (const c of chords) {
      try {
        piloti.keyboard.grab(c);
      } catch {
        // ignore invalid keysym warnings in fake host
      }
    }
    const unlisten = piloti.keyboard.on("shortcut", ({ chord }) => {
      if (chord === "Meta+k" || chord === "Meta+K") {
        piloti.windows.focusShell();
        emitShellEvent("piloti:open-command-hud");
      } else if (chord === "Alt+Space" || chord === "Alt+space") {
        piloti.windows.focusShell();
        setLauncherOpen((v) => !v);
      } else if (chord === "Alt+Tab") {
        piloti.windows.focusShell();
        cycleAltTab(1);
      } else if (chord === "Alt+Shift+Tab") {
        piloti.windows.focusShell();
        cycleAltTab(-1);
      } else if (chord === "Meta+Return") {
        launchDesktopCommand(piloti, ["kitty"]);
      } else if (chord === "Meta+Left") {
        switchWorkspace(-1);
      } else if (chord === "Meta+Right") {
        switchWorkspace(1);
      } else if (chord === "Meta+Up" || chord === "F3") {
        toggleOverview();
      } else if (chord === "Print") {
        void takeScreenshot();
      }
    });
    const unlistenRelease = piloti.keyboard.on(
      "shortcutrelease",
      ({ chord, altKey }) => {
        if ((chord === "Alt+Tab" || chord === "Alt+Shift+Tab") && !altKey) {
          commitAltTab();
        }
      },
    );
    const unlistenMods = piloti.keyboard.on("modifierschange", () => {
      if (
        altTabOpen &&
        piloti.keyboard.modifiers &&
        !piloti.keyboard.modifiers.alt
      ) {
        commitAltTab();
      }
    });
    return () => {
      unlisten();
      unlistenRelease();
      unlistenMods();
      for (const c of chords) {
        try {
          piloti.keyboard.ungrab(c);
        } catch {
          // ignore
        }
      }
    };
  }, [
    altTabOpen,
    commitAltTab,
    cycleAltTab,
    piloti,
    setLauncherOpen,
    switchWorkspace,
    takeScreenshot,
    toggleOverview,
  ]);

  // DOM keyboard shortcuts (Browser Dev Mode & shell-focused windows)
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (overviewOpen && e.key === "Escape") {
        e.preventDefault();
        setOverviewOpen(false);
        return;
      }
      if (
        (e.key === "F3" && !e.altKey && !e.ctrlKey && !e.metaKey) ||
        (e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey && e.key === "ArrowUp")
      ) {
        e.preventDefault();
        toggleOverview();
        return;
      }
      if (!compositor && e.altKey && e.code === "Space") {
        e.preventDefault();
        setOverviewOpen(false);
        setLauncherOpen((v) => !v);
        return;
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey &&
        e.key.toLowerCase() === "k"
      ) {
        // Cmd+K: Help ▸ search menus (application HUD).
        e.preventDefault();
        setOverviewOpen(false);
        emitShellEvent("piloti:open-command-hud");
        return;
      }
      if (!compositor && e.altKey && e.key === "Tab") {
        e.preventDefault();
        setOverviewOpen(false);
        cycleAltTab(e.shiftKey ? -1 : 1);
        return;
      }
      if (altTabOpen) {
        if (e.key === "ArrowRight" || (!compositor && e.key === "Tab")) {
          e.preventDefault();
          cycleAltTab(e.shiftKey ? -1 : 1);
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          cycleAltTab(-1);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          commitAltTab();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeAltTab();
          return;
        }
      }
      if (e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          switchWorkspace(-1);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          switchWorkspace(1);
          return;
        }
      }
      if (e.altKey && e.key === ",") {
        e.preventDefault();
        launchApp("settings");
        return;
      }
      if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setControlPanelOpen((v) => !v);
        return;
      }
      if (e.altKey && e.key.toLowerCase() === "w" && focusedWindowId) {
        e.preventDefault();
        closeWindow(focusedWindowId);
        return;
      }
      if (e.altKey && e.key.toLowerCase() === "m" && focusedWindowId) {
        e.preventDefault();
        toggleMinimizeWindow(focusedWindowId);
        return;
      }
      if (e.altKey && e.key.toLowerCase() === "f" && focusedWindowId) {
        e.preventDefault();
        toggleMaximizeWindow(focusedWindowId);
        return;
      }
      if (e.altKey && e.key === "[" && focusedWindowId) {
        e.preventDefault();
        tileWindow(focusedWindowId, "left");
        return;
      }
      if (e.altKey && e.key === "]" && focusedWindowId) {
        e.preventDefault();
        tileWindow(focusedWindowId, "right");
        return;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (altTabOpen && e.key === "Alt") {
        commitAltTab();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(
      "domicile-guest-keydown",
      onKeyDown as EventListener,
    );
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(
        "domicile-guest-keydown",
        onKeyDown as EventListener,
      );
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    altTabOpen,
    closeAltTab,
    closeWindow,
    commitAltTab,
    cycleAltTab,
    focusedWindowId,
    compositor,
    launchApp,
    overviewOpen,
    setControlPanelOpen,
    setLauncherOpen,
    setOverviewOpen,
    switchWorkspace,
    tileWindow,
    toggleMaximizeWindow,
    toggleMinimizeWindow,
    toggleOverview,
  ]);
}
