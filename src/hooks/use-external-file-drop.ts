import * as React from "react";
import { importFsFiles } from "@/lib/engine/fs-bridge";
import { usePiloti } from "@/lib/engine/piloti";

/**
 * Files dragged in from outside the shell (browser demo, other programs) are
 * copied into the folder. Spread `handlers` on the folder's view.
 */
export function useExternalFileDrop(
  dirPath: string,
  enabled: boolean,
  onImported?: () => void,
) {
  const piloti = usePiloti();
  const [active, setActive] = React.useState(false);
  const handlers = {
    onDragOver: (e: React.DragEvent) => {
      if (!enabled || !e.dataTransfer?.types?.includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (!active) setActive(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActive(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (!enabled || !e.dataTransfer?.files?.length) return;
      e.preventDefault();
      setActive(false);
      // Spatial views place the new icons where they were dropped.
      window.dispatchEvent(
        new CustomEvent("residence:desktop-drop-position", {
          detail: {
            destPath: dirPath,
            names: Array.from(e.dataTransfer.files, (f) => f.name),
            clientX: e.clientX,
            clientY: e.clientY,
          },
        }),
      );
      void importFsFiles(piloti, dirPath, e.dataTransfer.files).then(() => {
        onImported?.();
        window.dispatchEvent(
          new CustomEvent("piloti:folder-drop-anim", { detail: { path: dirPath } }),
        );
      });
    },
  };
  return { active, handlers };
}
