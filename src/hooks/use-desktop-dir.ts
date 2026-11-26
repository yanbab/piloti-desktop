import * as React from "react";
import { useApps } from "@/context/DesktopStateContext";
import { useCapabilities } from "@/hooks/use-capabilities";
import { normalizeVfsPath, WEB_VFS_HOME } from "@/lib/core/vfs-paths";
import { resolveVfsTemplatesDir } from "@/lib/engine/fs-bridge";
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

/** The XDG Templates folder ("New Document" in menus). */
export function useTemplatesDirPath(): string {
  const { realFilesystem } = useCapabilities();
  const { xdgUserDirs } = useApps();
  return React.useMemo(() => {
    // The demo reads its own `user-dirs.dirs`.
    if (!realFilesystem) return resolveVfsTemplatesDir();
    return normalizeVfsPath(resolveUserDirPath("TEMPLATES", xdgUserDirs, WEB_VFS_HOME));
  }, [realFilesystem, xdgUserDirs]);
}
