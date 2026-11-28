import * as React from "react";
import { usePiloti } from "@/platform/shared/piloti";
import { defineSettings } from "@/platform/shared/settings";

/**
 * How Folders shows a folder. A window opened on a folder is spatial: each
 * folder keeps its own view, in its GVfs metadata. A window opened from the
 * Launcher or the Dock is not: one view for every folder, in the app's
 * settings, which is also what a folder without its own view looks like.
 */
export interface FolderView {
  view: "grid" | "list" | "desktop";
  sortBy: "manual" | "name" | "kind" | "modified" | "size";
  sortDir: "asc" | "desc";
  gridZoom: number;
  listZoom: number;
  showHidden: boolean;
}

const METADATA_KEY = "metadata::piloti-view";
const SAVE_DELAY_MS = 300;

const settings = defineSettings("org.piloti.folders", {
  view: "grid",
  "sort-by": "name",
  "sort-dir": "asc",
  "grid-zoom": 5,
  "list-zoom": 0,
  "show-hidden": false,
  "info-pane": false,
  "info-pane-width": 240,
});

const readGlobal = (): FolderView => ({
  view: settings.get("view") as FolderView["view"],
  sortBy: settings.get("sort-by") as FolderView["sortBy"],
  sortDir: settings.get("sort-dir") as FolderView["sortDir"],
  gridZoom: settings.get("grid-zoom"),
  listZoom: settings.get("list-zoom"),
  showHidden: settings.get("show-hidden"),
});

function writeGlobal(view: FolderView) {
  settings.set("view", view.view);
  settings.set("sort-by", view.sortBy);
  settings.set("sort-dir", view.sortDir);
  settings.set("grid-zoom", view.gridZoom);
  settings.set("list-zoom", view.listZoom);
  settings.set("show-hidden", view.showHidden);
}

function parseView(raw: string | undefined): Partial<FolderView> {
  try {
    const value: unknown = JSON.parse(raw ?? "{}");
    return value && typeof value === "object" ? (value as Partial<FolderView>) : {};
  } catch {
    return {};
  }
}

/** The info pane is the same in every window, spatial or not. */
export const infoPaneMemory = {
  read: () => ({ open: settings.get("info-pane"), width: settings.get("info-pane-width") }),
  write: ({ open, width }: { open?: boolean; width?: number }) => {
    if (open !== undefined) settings.set("info-pane", open);
    if (width !== undefined) settings.set("info-pane-width", width);
  },
};

/** `folder`: the folder keeping its own view, or `null` for the shared one. */
export function useFolderView(folder: string | null) {
  const piloti = usePiloti();
  const [view, setView] = React.useState(readGlobal);
  const viewRef = React.useRef(view);
  const folderRef = React.useRef(folder);
  // Saves wait: the zoom slider changes at frame rate.
  const pending = React.useRef<{ timer: number; save: () => void } | null>(null);

  const apply = React.useCallback((next: FolderView) => {
    viewRef.current = next;
    setView(next);
  }, []);
  const flush = React.useCallback(() => {
    const job = pending.current;
    if (!job) return;
    pending.current = null;
    window.clearTimeout(job.timer);
    job.save();
  }, []);

  React.useLayoutEffect(() => {
    folderRef.current = folder;
    const shared = readGlobal();
    apply(shared);
    let current = true;
    if (folder) {
      void piloti.vfs
        .metadata(folder, [METADATA_KEY])
        .then((meta) => {
          // Not over a change made while reading.
          if (current && viewRef.current === shared) {
            apply({ ...shared, ...parseView(meta[METADATA_KEY]) });
          }
        })
        .catch(() => {});
    }
    return () => {
      current = false;
      flush();
    };
  }, [apply, flush, folder, piloti]);

  const set = React.useCallback(
    <K extends keyof FolderView>(key: K, value: React.SetStateAction<FolderView[K]>) => {
      const before = viewRef.current[key];
      const after = typeof value === "function" ? value(before) : value;
      if (after === before) return;
      const next = { ...viewRef.current, [key]: after };
      apply(next);
      const target = folderRef.current;
      if (pending.current) window.clearTimeout(pending.current.timer);
      pending.current = {
        timer: window.setTimeout(flush, SAVE_DELAY_MS),
        save: () => {
          if (!target) writeGlobal(next);
          else {
            void piloti.vfs
              .setMetadata(target, { [METADATA_KEY]: JSON.stringify(next) })
              .catch(() => {});
          }
        },
      };
    },
    [apply, flush, piloti],
  );

  return { ...view, set };
}
