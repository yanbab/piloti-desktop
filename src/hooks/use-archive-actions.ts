import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { useSystemBackends } from "@/context/DesktopStateContext";
import { useCapabilities } from "@/hooks/use-capabilities";
import { compressFsEntries, extractFsArchive } from "@/lib/engine/fs-bridge";
import { recordCreated } from "@/lib/engine/fs-undo";
import { _ } from "@/lib/core/i18n";

/**
 * "Compress" and "Extract Here" for Folders and the Desktop. `onDone` reloads
 * the listing; the result can be undone, and a failure is notified.
 */
export function useArchiveActions(onDone: () => unknown) {
  const domicile = useDomicile();
  const { realFilesystem } = useCapabilities();
  const { pushNotification } = useSystemBackends();

  const finish = React.useCallback(
    async (job: Promise<string | null>, failure: string) => {
      const created = await job.catch(() => null);
      if (!created) {
        pushNotification({
          appName: _("Folders"),
          summary: failure,
          body: realFilesystem
            ? _("Check the file, free space and that libarchive-tools is installed.")
            : "",
        });
        return;
      }
      await onDone();
      recordCreated({ domicile }, [created], "Create");
    },
    [domicile, onDone, pushNotification, realFilesystem]
  );

  const compress = React.useCallback(
    (paths: readonly string[]) =>
      void finish(compressFsEntries(domicile, paths), _("Could not compress")),
    [domicile, finish]
  );
  const extract = React.useCallback(
    (path: string) =>
      void finish(extractFsArchive(domicile, path), _("Could not extract")),
    [domicile, finish]
  );

  return { compress, extract };
}
