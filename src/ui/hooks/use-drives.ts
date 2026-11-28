import * as React from "react";
import type { FilesNotify } from "@/ui/components/files-host";
import { _ } from "@/core/util/i18n";
import { hardware } from "@/platform/shared/hardware";
import { usePiloti, type Piloti } from "@/platform/shared/piloti";
import type { DriveInfo } from "@/core/ports/hardware";

// One watch for every window and the Dock.
let drives: DriveInfo[] = [];
let stopWatch: (() => void) | null = null;
const listeners = new Set<() => void>();

function subscribe(piloti: Piloti, listener: () => void): () => void {
  listeners.add(listener);
  stopWatch ??= hardware().drives.watch(piloti, (next) => {
    drives = next;
    for (const each of [...listeners]) each();
  });
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    stopWatch?.();
    stopWatch = null;
  };
}

/** The removable drives, with mount and eject; failures are notified. */
export function useDrives(notify: FilesNotify) {
  const piloti = usePiloti();
  const list = React.useSyncExternalStore(
    React.useCallback((listener: () => void) => subscribe(piloti, listener), [piloti]),
    () => drives,
  );

  const failed = React.useCallback(
    (summary: string, error: unknown) => {
      notify({
        appName: _("Folders"),
        summary,
        body: error instanceof Error ? error.message : String(error),
      });
    },
    [notify],
  );

  /** Where the drive is mounted, mounting it if needed; `null` if it can't be. */
  const mount = React.useCallback(
    (drive: DriveInfo): Promise<string | null> =>
      drive.mountPath
        ? Promise.resolve(drive.mountPath)
        : hardware()
            .drives.mount(piloti, drive.id)
            .catch((error) => {
              failed(_("Could not open %s", drive.label), error);
              return null;
            }),
    [piloti, failed],
  );

  const eject = React.useCallback(
    (drive: DriveInfo) =>
      void hardware()
        .drives.eject(piloti, drive.id)
        .catch((error) => failed(_("Could not eject %s", drive.label), error)),
    [piloti, failed],
  );

  return { drives: list, mount, eject };
}

/** Whether `path` is `drive`'s mount point or inside it. */
export function isOnDrive(path: string, drive: Pick<DriveInfo, "mountPath">): boolean {
  const root = drive.mountPath;
  return root !== null && (path === root || path.startsWith(`${root}/`));
}
