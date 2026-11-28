import * as React from "react";
import { onModuleRequest } from "@/platform/shared/module-ipc";
import { useWindowActions } from "@/ui/context/DesktopStateContext";
import { useOpenPath } from "@/ui/hooks/use-open-path";

/**
 * An app module asks the shell to launch an app or open a file: as the shell's
 * own Folders would, with its built-in apps and the user's default apps.
 */
export function useModuleOpenRequests(): void {
  const { launchApp } = useWindowActions();
  const { openPath } = useOpenPath();
  const live = React.useRef({ launchApp, openPath });
  live.current = { launchApp, openPath };
  React.useEffect(
    () =>
      onModuleRequest((_id, request) => {
        if (request.do === "launch") {
          live.current.launchApp(request.appId, request.payload ? { payload: request.payload } : undefined);
        } else if (request.do === "open") {
          void live.current.openPath(request.path, { kind: request.kind, preferApp: request.preferApp });
        }
      }),
    [],
  );
}
