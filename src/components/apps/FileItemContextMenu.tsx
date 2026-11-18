import { createPortal } from "react-dom";
import {
  MENU_ITEM_CLASS,
  MENU_POPUP_CLASS,
  MENU_SEPARATOR_CLASS,
} from "@/components/ui/menu-styles";
import type { IconGridItem } from "@/lib/desktop-icons";
import { _ } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface FileItemContextMenuState {
  item: IconGridItem;
  x: number;
  y: number;
}

export function FileItemContextMenu({
  menu,
  isTrash = false,
  onClose,
  onOpen,
  onOpenInTerminal,
  onEditText,
  onRename,
  onNewFolder,
  onNewTextFile,
  onTrash,
}: {
  menu: FileItemContextMenuState | null;
  isTrash?: boolean;
  onClose: () => void;
  onOpen: (item: IconGridItem) => void;
  onOpenInTerminal?: (item: IconGridItem) => void;
  onEditText?: (item: IconGridItem) => void;
  onRename: (item: IconGridItem) => void;
  onNewFolder?: () => void;
  onNewTextFile?: () => void;
  onTrash: (item: IconGridItem) => void;
}) {
  if (!menu) return null;

  const left =
    typeof window !== "undefined"
      ? Math.min(window.innerWidth - 196, menu.x)
      : menu.x;
  const top =
    typeof window !== "undefined"
      ? Math.min(window.innerHeight - 200, menu.y)
      : menu.y;

  const content = (
    <div
      className="fixed inset-0 z-[500]"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        role="menu"
        style={{ left: `${left}px`, top: `${top}px` }}
        onClick={(e) => e.stopPropagation()}
        className={cn(MENU_POPUP_CLASS, "fixed min-w-44")}
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            const target = menu.item;
            onClose();
            onOpen(target);
          }}
          className={cn(MENU_ITEM_CLASS, "w-full text-left hover:bg-adw-menu-highlight")}
        >
          {_("Open")}
        </button>
        {onOpenInTerminal && menu.item.kind === "directory" && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const target = menu.item;
              onClose();
              onOpenInTerminal(target);
            }}
            className={cn(MENU_ITEM_CLASS, "w-full text-left hover:bg-adw-menu-highlight")}
          >
            {_("Open in Terminal")}
          </button>
        )}
        {onEditText && menu.item.kind === "file" && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const target = menu.item;
              onClose();
              onEditText(target);
            }}
            className={cn(MENU_ITEM_CLASS, "w-full text-left hover:bg-adw-menu-highlight")}
          >
            {_("Edit in Text Editor")}
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            const target = menu.item;
            onClose();
            onRename(target);
          }}
          className={cn(MENU_ITEM_CLASS, "w-full text-left hover:bg-adw-menu-highlight")}
        >
          {_("Rename…")}
        </button>

        {(onNewFolder || onNewTextFile) && (
          <>
            <div className={MENU_SEPARATOR_CLASS} />
            {onNewFolder && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onClose();
                  onNewFolder();
                }}
                className={cn(
                  MENU_ITEM_CLASS,
                  "w-full text-left hover:bg-adw-menu-highlight"
                )}
              >
                {_("New Folder")}
              </button>
            )}
            {onNewTextFile && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onClose();
                  onNewTextFile();
                }}
                className={cn(
                  MENU_ITEM_CLASS,
                  "w-full text-left hover:bg-adw-menu-highlight"
                )}
              >
                {_("New Text File")}
              </button>
            )}
          </>
        )}

        <div className={MENU_SEPARATOR_CLASS} />
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            const target = menu.item;
            onClose();
            onTrash(target);
          }}
          className={cn(
            MENU_ITEM_CLASS,
            "w-full text-left hover:bg-adw-menu-highlight"
          )}
        >
          {isTrash ? _("Delete Permanently") : _("Move to Trash")}
        </button>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(content, document.body)
    : content;
}

