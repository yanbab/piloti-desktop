// Domicile app module: the Image Viewer in its own process. See docs/ARCHITECTURE.md.
import * as React from "react";
import { _ } from "@/core/util/i18n";
import { createModuleDocumentHost } from "@/platform/shared/app-module-host";
import { ImageViewerApp } from "@/ui/apps/image-viewer/ImageViewerApp";
import type { ImageViewerHost } from "@/ui/apps/image-viewer/host";
import { mountModuleApp } from "@/ui/apps/module-app";

// The shell draws this module's titlebar (`csd: false` in core/data/app-modules.ts).
export const main = mountModuleApp(
  { appId: "image-viewer", title: "Image Viewer", stateKeys: ["image-viewer-state"], decorations: "server" },
  async (module) => {
    const path = await module.takeOpenFile();
    const host: ImageViewerHost = {
      ...(await createModuleDocumentHost(module, module.files, () => _("Image Viewer"))),
      binaryFiles: true,
    };
    return () => (
      <ImageViewerApp host={host} initialPath={path ?? undefined} windowId={module.instance} />
    );
  },
);
