/** Folders in the demo's iframe: the page around it holds the windows, settings and apps. */
import * as React from "react";
import { hostFiles } from "@/core/files/host-files";
import {
  type FrameRequest,
  postToShell,
  type ShellToAppMessage,
  useIsolatedAppBridge,
} from "@/platform/shared/app-bridge";
import { frameDesktop } from "@/platform/shared/app-frame-desktop";
import { createFrameShellHost } from "@/platform/shared/app-frame-shell";
import { createShellAppHost } from "@/platform/shared/app-shell-host";
import { usePiloti } from "@/platform/shared/piloti";
import { watchDocumentFocus } from "@/ui/apps/document-focus";
import { FilesApp } from "@/ui/apps/files/FilesApp";
import { createStandaloneFilesHost } from "@/ui/apps/files/standalone-host";
import { FilesHostProvider } from "@/ui/components/files-host";

export function FrameFilesApp({ windowId, initialPath }: { windowId: string; initialPath?: string }) {
  const piloti = usePiloti();
  // Says it is ready and takes the desktop's theme. The menu bar's actions
  // arrive by message: Folders hears them as in the shell, as window events
  // (which the bridge hears too, hence the guard).
  const relaying = React.useRef(false);
  useIsolatedAppBridge(windowId, true, (actionId) => {
    if (relaying.current) return;
    relaying.current = true;
    try {
      dispatchEvent(new CustomEvent("piloti:app-action", { detail: { windowId, actionId } }));
    } finally {
      relaying.current = false;
    }
  });
  const [host] = React.useState(() => {
    const request = (request: FrameRequest) => postToShell({ type: "piloti:shell-request", windowId, request });
    return createStandaloneFilesHost({
      windowId,
      desktop: frameDesktop(windowId),
      apps: createShellAppHost(piloti).apps,
      files: hostFiles(piloti),
      shell: createFrameShellHost(windowId),
      launch: (appId, payload) => request({ do: "launch", appId, ...(payload ? { payload } : null) }),
      open: (path, options) => request({ do: "open", path, ...options }),
      notify: ({ summary, body }) => postToShell({ type: "piloti:notify", windowId, summary, body }),
      dropOut: (paths, point) => request({ do: "drop-items", paths: [...paths], ...point }),
      dragItems: (paths) => request({ do: "drag-items", paths: [...paths] }),
      watchDrag: (listener) => {
        const onMessage = (e: MessageEvent) => {
          const msg = e.data as ShellToAppMessage | null;
          if (e.source === window.parent && msg?.type === "piloti:drag") listener(msg.state);
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
      },
      watchFocus: watchDocumentFocus,
    });
  });
  return (
    <FilesHostProvider value={host}>
      <FilesApp initialPath={initialPath} windowId={windowId} />
    </FilesHostProvider>
  );
}
