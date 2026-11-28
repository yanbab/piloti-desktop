/// <reference types="@domicile-desktop/react/elements" />
import * as React from "react";
import {
  FileChooserMode,
  PortalAnswerKind,
  PortalRequest,
  type PortalAnswer,
} from "@domicile-desktop/sdk/portal";
import { FileChooserPortalDialog } from "@/ui/shell/dialogs/PortalDialogs";
import { _ } from "@/core/util/i18n";

/**
 * A page's file picker (`<input type="file">`): the shell's own file chooser,
 * the one apps get through the portal. Downloads never come here, they save
 * straight to the download folder.
 */
export function BrowserFileChooser({
  event,
  onDone,
}: {
  event: DomicileFileChooserEvent;
  onDone: () => void;
}) {
  const request = React.useMemo(
    () =>
      PortalRequest.FileChooser(
        { id: 0, appId: "browser", parentAppId: undefined },
        {
          acceptLabel: undefined,
          choices: [],
          currentFilter: undefined,
          currentFolder: event.currentFolder || undefined,
          currentName: event.mode === "save" ? event.suggestedName : undefined,
          directory: event.mode === "open-folder",
          files: [],
          filters: event.accept.length
            ? [{ name: _("Accepted Files"), extensions: [...event.accept] }]
            : [],
          home: event.home,
          mode: event.mode === "save" ? FileChooserMode.Save : FileChooserMode.Open,
          multiple: event.mode === "open-multiple",
          title: "",
        }
      ),
    [event]
  );
  const answer = (ans: PortalAnswer) => {
    try {
      if (ans.kind === PortalAnswerKind.FileChooser && ans.chosen.paths.length > 0) {
        event.choose(
          event.mode === "open-multiple" ? ans.chosen.paths : [ans.chosen.paths[0]]
        );
      } else {
        event.cancel();
      }
    } catch {
      // Already answered, or the page went away.
    }
    onDone();
  };
  return <FileChooserPortalDialog request={request} onAnswer={answer} />;
}
