import * as React from "react";
import { useCapabilities } from "@/hooks/use-capabilities";
import { usePiloti } from "@/lib/engine/piloti";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { DynamicFileIcon, DynamicFolderIcon } from "@/data/folder-icons";
import { useOpenPath } from "@/hooks/use-open-path";
import { useSettings, useWindowActions } from "@/context/DesktopStateContext";
import { _ } from "@/lib/core/i18n";
import { listFsDir } from "@/lib/engine/fs-bridge";
import {
  subscribeWebVfs,
  type WebVfsEntry,
} from "@/lib/engine-web/web-vfs";
import { dockFolderLabel } from "@/lib/shell/dock-folders";
import { inferFileVisual } from "@/lib/shell/desktop-icons";

const MAX_STACK_ITEMS = 60;

export interface DockFolderStackProps {
  path: string;
  anchor: DOMRect;
  dockPosition: "bottom" | "left" | "right";
  onClose: () => void;
}

/** Popover "stack" listing the contents of a docked folder (24px icons + names). */
export function DockFolderStack({
  path,
  anchor,
  dockPosition,
  onClose,
}: DockFolderStackProps) {
  const piloti = usePiloti();
  const { settings } = useSettings();
  const { realFilesystem } = useCapabilities();
  const { launchApp } = useWindowActions();
  const { openPath } = useOpenPath();
  const [entries, setEntries] = React.useState<WebVfsEntry[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const list = await listFsDir(piloti, path);
      if (cancelled) return;
      const visible = list.filter((e) => !e.name.startsWith("."));
      visible.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
          numeric: true,
        });
      });
      setEntries(visible);
    };
    void load();
    const unsub = !realFilesystem ? subscribeWebVfs(() => void load(), { path, mode: "children" }) : undefined;
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [piloti, realFilesystem, path]);


  const openFolder = React.useCallback(
    (target: string) => {
      onClose();
      launchApp("nautilus", { payload: target, forceNew: true });
    },
    [launchApp, onClose]
  );

  const openEntry = React.useCallback(
    (entry: WebVfsEntry) => {
      onClose();
      void openPath(entry.path, { kind: entry.kind, name: entry.name });
    },
    [onClose, openPath]
  );

  const shown = (entries ?? []).slice(0, MAX_STACK_ITEMS);

  // Same accent-tinted folder/file drawings as Folders and the Desktop, so every
  // entry has an icon (the icon-theme lookup misses most mime icons).
  const renderIcon = (entry: WebVfsEntry) => {
    if (entry.kind === "directory") {
      return (
        <DynamicFolderIcon
          accentColor={settings.accentColor}
          pathOrName={entry.path}
          className="size-6 shrink-0"
        />
      );
    }
    const visual = inferFileVisual(entry.name, entry.kind, undefined, {
      isEmpty: typeof entry.size === "number" ? entry.size === 0 : undefined,
    });
    return (
      <DynamicFileIcon
        accentColor={settings.accentColor}
        name={entry.name}
        iconCandidates={visual.iconCandidates}
        className="size-6 shrink-0"
      />
    );
  };

  const isOwnTile = (target: EventTarget | null | undefined) =>
    target instanceof Element &&
    Boolean(target.closest(`[data-dock-folder-path="${CSS.escape(path)}"]`));

  return (
    <DropdownMenu
      open
      onOpenChange={(open, details) => {
        // A press on this folder's own tile toggles it (the Dock handles it).
        if (!open && !isOwnTile(details?.event?.target)) onClose();
      }}
    >
      <DropdownMenuContent
        data-menu="stack"
        aria-label={dockFolderLabel(path)}
        data-slot="dock-folder-stack"
        anchor={{ getBoundingClientRect: () => anchor }}
        side={dockPosition === "left" ? "right" : dockPosition === "right" ? "left" : "top"}
        align="center"
        sideOffset={12}
        collisionAvoidance={{ side: "flip", align: "shift" }}
        className="flex max-h-[min(70vh,520px)] w-60 flex-col"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {entries === null ? null : shown.length === 0 ? (
            <div className="px-3 py-2 text-adw-body text-adw-label-tertiary">
              {_("Folder is empty")}
            </div>
          ) : (
            shown.map((entry) => (
              <DropdownMenuItem key={entry.path} onClick={() => openEntry(entry)}>
                {renderIcon(entry)}
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openFolder(path)}>
          {_("Open in Folders")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
