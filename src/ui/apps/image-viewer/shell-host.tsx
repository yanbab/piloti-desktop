/** The Image Viewer in a shell window, or its demo iframe. */
import * as React from "react";
import { getEngine } from "@/core/ports/engine";
import { createShellDocumentHost } from "@/platform/shared/app-shell-host";
import { usePiloti } from "@/platform/shared/piloti";
import { ImageViewerApp } from "@/ui/apps/image-viewer/ImageViewerApp";
import type { ImageViewerHost } from "@/ui/apps/image-viewer/host";

export const ShellImageViewerApp = (props: { initialPath?: string; windowId?: string }) => {
  const piloti = usePiloti();
  const host = React.useMemo<ImageViewerHost>(
    () => ({
      ...createShellDocumentHost(piloti),
      binaryFiles: getEngine().capabilities.realFilesystem,
    }),
    [piloti],
  );
  return <ImageViewerApp {...props} host={host} />;
};
