/** Selfies in a shell window, or its demo iframe. */
import * as React from "react";
import { WEB_VFS_HOME } from "@/core/files/vfs-paths";
import { resolveUserDirPath } from "@/core/xdg/xdg-user-dirs";
import { createShellAppHost } from "@/platform/shared/app-shell-host";
import { usePiloti } from "@/platform/shared/piloti";
import { SelfiesApp } from "@/ui/apps/selfies/SelfiesApp";
import type { SelfiesHost } from "@/ui/apps/selfies/host";
import { useOptionalApps } from "@/ui/context/AppsContext";
import { useCapabilities } from "@/ui/hooks/use-capabilities";

export const ShellSelfiesApp = ({ windowId }: { windowId?: string }) => {
  const piloti = usePiloti();
  const { realFilesystem } = useCapabilities();
  // Absent in the demo's iframe.
  const userDirs = useOptionalApps()?.xdgUserDirs;
  const host = React.useMemo<SelfiesHost>(() => {
    const app = createShellAppHost(piloti);
    return {
      ...app,
      userDir: (kind) =>
        realFilesystem && userDirs
          ? resolveUserDirPath(kind, userDirs, WEB_VFS_HOME)
          : app.userDir(kind),
      binaryFiles: realFilesystem,
    };
  }, [piloti, realFilesystem, userDirs]);
  return <SelfiesApp windowId={windowId} host={host} />;
};
