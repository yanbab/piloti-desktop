/** Folders as a Domicile app module, once `$HOME` is known (`main.tsx`). */
import { DomicileProvider } from "@domicile-desktop/react/domicile-provider";
import type { AppMain } from "@domicile-desktop/sdk/app";
import type { AppDomicile } from "@domicile-desktop/sdk/desktop/app-desktop";
import * as React from "react";
import type { Vfs } from "@/core/ports/vfs";
import { PilotiQueryProvider } from "@/platform/shared/query-client";
import { watchDocumentFocus } from "@/ui/apps/document-focus";
import { FilesApp } from "@/ui/apps/files/FilesApp";
import { createStandaloneFilesHost } from "@/ui/apps/files/standalone-host";
import { mountModuleApp } from "@/ui/apps/module-app";
import { FilesHostProvider } from "@/ui/components/files-host";

/**
 * What Folders' code reads as `piloti`: this module's Domicile and its VFS.
 * `usePiloti()` wants a shell's desktop, which Domicile knows by its `windows`:
 * a module has none, so they read as `undefined` (Folders asks the shell).
 */
function withModuleVfs(domicile: AppDomicile, vfs: Vfs) {
  return new Proxy(domicile, {
    get: (target, key) => (key === "vfs" ? vfs : Reflect.get(target, key, target)),
    has: (target, key) => key === "vfs" || key === "windows" || Reflect.has(target, key),
  });
}

export const start: AppMain = (root, domicile) =>
  // The shell lays the window controls over the sidebar and header (`csd: true`
  // in core/data/app-modules.ts).
  mountModuleApp({ appId: "files", title: "Folders", decorations: "host" }, async (module) => {
    const path = await module.takeOpenFile();
    const { host: app, files, desktop, shell, instance } = module;
    const host = createStandaloneFilesHost({
      windowId: instance,
      desktop: {
        current: desktop.current,
        watch: desktop.watch,
        update: (patch) => {
          if (!desktop.update(patch)) console.warn("[piloti] settings: no dconf, nothing changed");
        },
      },
      apps: app.apps,
      files,
      shell,
      launch: (appId, payload) => module.request({ do: "launch", appId, ...(payload ? { payload } : null) }),
      open: (target, options) => module.request({ do: "open", path: target, ...options }),
      notify: app.notify,
      dropOut: (paths, point) => module.request({ do: "drop-items", paths: [...paths], ...point }),
      dragItems: (paths) => module.request({ do: "drag-items", paths: [...paths] }),
      watchDrag: module.onDrag,
      watchFocus: watchDocumentFocus,
    });
    const piloti = withModuleVfs(domicile, app.vfs);
    return () => (
      <DomicileProvider domicile={piloti as never}>
        <PilotiQueryProvider>
          <FilesHostProvider value={host}>
            <FilesApp initialPath={path ?? undefined} windowId={instance} />
          </FilesHostProvider>
        </PilotiQueryProvider>
      </DomicileProvider>
    );
  })(root, domicile);
