import * as React from "react";
import { usePopupSurface } from "@/lib/shell/popup-layer";
import { emitShellEvent, onShellEvent } from "@/lib/shell/shell-events";
import { createPortal } from "react-dom";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  MENU_ITEM_CLASS,
  MENU_POPUP_CLASS,
  MENU_SEPARATOR_CLASS,
} from "@/components/ui/menu-styles";
import { DynamicFileIcon, DynamicFolderIcon } from "@/data/folder-icons";
import { useOpenPath } from "@/hooks/use-open-path";
import { useSettings, useWindowActions } from "@/context/DesktopStateContext";
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";
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
  const domicile = useDomicile();
  const { isBrowserRuntime, settings } = useSettings();
  const { launchApp } = useWindowActions();
  const { openPath } = useOpenPath();
  const [entries, setEntries] = React.useState<WebVfsEntry[] | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  usePopupSurface(true, onClose);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const list = await listFsDir(domicile, isBrowserRuntime, path);
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
    const unsub = isBrowserRuntime ? subscribeWebVfs(() => void load(), { path, mode: "children" }) : undefined;
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [domicile, isBrowserRuntime, path]);

  React.useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && panelRef.current?.contains(target)) return;
      const el = target instanceof Element ? target : null;
      // Let the dock tile toggle the stack itself.
      if (el?.closest(`[data-dock-folder-path="${CSS.escape(path)}"]`)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onClose);
    const offDismissPopups = onShellEvent("piloti:dismiss-popups", onClose);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onClose);
      offDismissPopups();
    };
  }, [onClose, path]);

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

  const style: React.CSSProperties = { position: "fixed", zIndex: 300 };
  const margin = 12;
  if (dockPosition === "left") {
    style.left = anchor.right + margin;
    style.bottom = Math.max(8, window.innerHeight - anchor.bottom);
  } else if (dockPosition === "right") {
    style.right = window.innerWidth - anchor.left + margin;
    style.bottom = Math.max(8, window.innerHeight - anchor.bottom);
  } else {
    style.bottom = window.innerHeight - anchor.top + margin;
    style.right = Math.max(
      8,
      Math.min(
        window.innerWidth - 240,
        window.innerWidth - (anchor.left + anchor.width / 2) - 110
      )
    );
  }

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

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      aria-label={dockFolderLabel(path)}
      data-slot="dock-folder-stack"
      style={style}
      className={cn(
        MENU_POPUP_CLASS,
        "flex max-h-[min(70vh,520px)] w-60 flex-col animate-in fade-in-0 zoom-in-95"
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {entries === null ? null : shown.length === 0 ? (
          <div className="px-3 py-2 text-[13px] text-adw-label-tertiary">
            {_("Folder is empty")}
          </div>
        ) : (
          shown.map((entry) => {
            return (
              <button
                key={entry.path}
                type="button"
                role="menuitem"
                onClick={() => openEntry(entry)}
                className={cn(MENU_ITEM_CLASS, "w-full text-left hover:bg-adw-menu-highlight")}
              >
                {renderIcon(entry)}
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              </button>
            );
          })
        )}
      </div>
      <div className={MENU_SEPARATOR_CLASS} />
      <button
        type="button"
        role="menuitem"
        onClick={() => openFolder(path)}
        className={cn(MENU_ITEM_CLASS, "w-full text-left hover:bg-adw-menu-highlight")}
      >
        {_("Open in Folders")}
      </button>
    </div>,
    document.body
  );
}
