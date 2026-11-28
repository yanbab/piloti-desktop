import * as React from "react";
import { useApps } from "@/ui/context/DesktopStateContext";
import { useCapabilities } from "@/ui/hooks/use-capabilities";
import { normalizeVfsPath, WEB_VFS_HOME } from "@/core/files/vfs-paths";
import { demoFiles } from "@/core/ports/demo-files";
import { resolveUserDirPath } from "@/core/xdg/xdg-user-dirs";

/** The XDG Desktop folder. */
export function useDesktopDirPath(): string {
  const { realFilesystem } = useCapabilities();
  const { xdgUserDirs } = useApps();
  return React.useMemo(() => {
    if (!realFilesystem) return `${WEB_VFS_HOME}/Desktop`;
    return normalizeVfsPath(resolveUserDirPath("DESKTOP", xdgUserDirs, WEB_VFS_HOME));
  }, [realFilesystem, xdgUserDirs]);
}

/** The XDG Templates folder ("New Document" in menus). */
export function useTemplatesDirPath(): string {
  const { realFilesystem } = useCapabilities();
  const { xdgUserDirs } = useApps();
  return React.useMemo(() => {
    // The demo reads its own `user-dirs.dirs`.
    if (!realFilesystem) return demoFiles().templatesDir();
    return normalizeVfsPath(resolveUserDirPath("TEMPLATES", xdgUserDirs, WEB_VFS_HOME));
  }, [realFilesystem, xdgUserDirs]);
}
