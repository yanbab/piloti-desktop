// Domicile app module: the Terminal in its own process. See docs/ARCHITECTURE.md.
import * as React from "react";
import { openWithDefaultApp, readSystemSample } from "@/platform/shared/system-commands";
import { mountModuleApp } from "@/ui/apps/module-app";
import { watchDocumentFocus } from "@/ui/apps/document-focus";
import type { TerminalHost } from "@/ui/apps/terminal/host";
import { XtermTerminalApp } from "@/ui/apps/terminal/XtermTerminalApp";

// The Terminal draws its own header bar; the shell lays its controls over it
// (`csd: true` in core/data/app-modules.ts).
export const main = mountModuleApp(
  { appId: "terminal", title: "Terminal", decorations: "host" },
  async (module) => {
    const { host: app, files, processes, desktop, shell, instance } = module;
    const system = { files, processes } as TerminalHost["system"];
    const host: TerminalHost = {
      vfs: app.vfs,
      system,
      shell,
      apps: app.apps,
      launch: (appId, payload) => app.apps.launch(appId, payload ? { payload } : undefined),
      // As any program: the file's default application, through the session.
      open: (path) => openWithDefaultApp(module, path),
      notify: app.notify,
      desktop: {
        current: desktop.current,
        watch: desktop.watch,
        update: (patch) => {
          if (!desktop.update(patch)) console.warn("[piloti] settings: no dconf, nothing changed");
        },
      },
      readSample: () => readSystemSample({ vfs: app.vfs, processes }),
      // A module has only its own Domicile: files, processes, dbus.
      globals: { piloti: { vfs: app.vfs, files, processes }, files },
      watchFocus: watchDocumentFocus,
      onSelectAll: (listener) => {
        const onAction = (e: Event) => {
          const { windowId, actionId } = (e as CustomEvent).detail ?? {};
          if (windowId === instance && actionId === "edit:select-all") listener();
        };
        addEventListener("piloti:app-action", onAction);
        return () => removeEventListener("piloti:app-action", onAction);
      },
      simulatedProcesses: false,
    };
    return () => <XtermTerminalApp host={host} />;
  },
);
