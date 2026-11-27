import * as React from "react";
import { usePiloti } from "@/lib/engine/piloti";
import { useSystemBackends } from "@/context/DesktopStateContext";
import { useCapabilities } from "@/hooks/use-capabilities";
import { compressFsEntries, extractFsArchive } from "@/lib/engine/fs-bridge";
import { recordCreated } from "@/lib/engine/fs-undo";
import { hasArchiver } from "@/lib/engine/system-commands";
import { _ } from "@/lib/core/i18n";

/**
 * "Compress" and "Extract Here" for Folders and the Desktop. `onDone` reloads
 * the listing; the result can be undone, and a failure is notified. Hide both
 * unless `available`.
 */
export function useArchiveActions(onDone: () => unknown) {
  const piloti = usePiloti();
  const { realFilesystem } = useCapabilities();
  const { pushNotification } = useSystemBackends();
  // The demo zips by itself; Linux needs `bsdtar` (libarchive-tools).
  const [available, setAvailable] = React.useState(!realFilesystem);
  React.useEffect(() => {
    if (!realFilesystem) return;
    let current = true;
    void hasArchiver(piloti).then((found) => current && setAvailable(found));
    return () => {
      current = false;
    };
  }, [piloti, realFilesystem]);

  const finish = React.useCallback(
    async (job: Promise<string | null>, failure: string) => {
      const created = await job.catch(() => null);
      if (!created) {
        pushNotification({
          appName: _("Folders"),
          summary: failure,
          body: realFilesystem ? _("Check the file and free space.") : "",
        });
        return;
      }
      await onDone();
      recordCreated({ piloti }, [created], "Create");
    },
    [piloti, onDone, pushNotification, realFilesystem]
  );

  const compress = React.useCallback(
    (paths: readonly string[]) =>
      void finish(compressFsEntries(piloti, paths), _("Could not compress")),
    [piloti, finish]
  );
  const extract = React.useCallback(
    (path: string) =>
      void finish(extractFsArchive(piloti, path), _("Could not extract")),
    [piloti, finish]
  );

  return { available, compress, extract };
}
