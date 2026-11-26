import * as React from "react";
import { useApps } from "@/context/DesktopStateContext";
import { useCapabilities } from "@/hooks/use-capabilities";
import { normalizeVfsPath, WEB_VFS_HOME } from "@/lib/engine-web/web-vfs";
import { resolveUserDirPath } from "@/lib/xdg/xdg-user-dirs";

/** The XDG Desktop folder. */
export function useDesktopDirPath(): string {
  const { realFilesystem } = useCapabilities();
  const { xdgUserDirs } = useApps();
  return React.useMemo(() => {
    if (!realFilesystem) return `${WEB_VFS_HOME}/Desktop`;
    return normalizeVfsPath(resolveUserDirPath("DESKTOP", xdgUserDirs, WEB_VFS_HOME));
  }, [realFilesystem, xdgUserDirs]);
}
