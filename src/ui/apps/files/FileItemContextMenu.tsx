import { isExtractableArchive } from "@/platform/shared/fs-bridge";
import * as React from "react";
import { ChevronRightIcon } from "@/ui/components/ui/symbols";
import { useCapabilities } from "@/ui/hooks/use-capabilities";
import { usePopupSurface } from "@/ui/hooks/popup-layer";
import { createPortal } from "react-dom";
import { usePiloti } from "@/platform/shared/piloti";
import { AppSquircleIcon } from "@/ui/components/common/AppSymbol";
import {
  MENU_ITEM_CLASS,
  MENU_POPUP_CLASS,
  MENU_SEPARATOR_CLASS,
} from "@/ui/components/ui/menu-styles";
import { useFilesHost } from "@/ui/components/files-host";
import { APP_CATALOG } from "@/core/data/catalog";
import type { IconGridItem } from "@/core/files/desktop-icons";
import { _ } from "@/core/util/i18n";
import { cn } from "@/core/util/utils";
import type { VfsEmblemId } from "@/core/files/emblems";
import {
  inferMimeType,
  loadMimeAppsConfig,
  type MimeAppOption,
  type MimeAppsConfig,
  resolveAppsForMime,
} from "@/core/xdg/xdg-mimeapps";

export interface FileItemContextMenuState {
  item: IconGridItem;
  x: number;
  y: number;
}

export type FileContextMenuKind =
  | "normal"
  | "desktop"
  | "trash"
  | "favorites"
  | "recents";

/** An item that opens its entries in a menu beside it, on hover or click. */
function ContextSubmenu({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const closeTimer = React.useRef<number | undefined>(undefined);

  // Beside the item, flipped and lifted as needed to stay on screen.
  React.useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const popup = popupRef.current;
    if (!open || !trigger || !popup) return;
    const at = trigger.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = popup;
    const fitsRight = at.right + width <= window.innerWidth;
    popup.style.left = fitsRight ? "100%" : `${-width}px`;
    popup.style.top = `${Math.min(-6, window.innerHeight - at.top - height - 6)}px`;
  }, [open]);

  React.useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const show = () => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  // A short delay lets the pointer cross other items on its way in.
  const hideSoon = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 200);
  };

  return (
    <div className="relative" onPointerEnter={show} onPointerLeave={hideSoon}>
      <button
        ref={triggerRef}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={show}
        className={cn(className, open && "bg-ui-menu-highlight")}
      >
        <span className="flex-1">{label}</span>
        <ChevronRightIcon className="size-3.5" />
      </button>
      {open && (
        <div ref={popupRef} role="menu" className={cn(MENU_POPUP_CLASS, "absolute w-max min-w-44")}>
          {children}
        </div>
      )}
    </div>
  );
}

export function FileItemContextMenu({
  menu,
  context = "normal",
  isTrash = false,
  selectedItems,
  onClose,
  onOpen,
  onOpenWithApp,
  onMakeLink,
  onOpenInNewWindow,
  onOpenContainingFolder,
  onShowOriginal,
  onToggleBookmark,
  bookmarkedPaths,
  onRestore,
  onRestoreItems,
  onOpenInTerminal,
  onCut,
  onCutItems,
  onCopy,
  onCopyItems,
  onDuplicate,
  onCompress,
  onExtract,
  onDownload,
  onPaste,
  canPaste = false,
  onRename,
  onTrash,
  onTrashItems,
}: {
  menu: FileItemContextMenuState | null;
  context?: FileContextMenuKind;
  isTrash?: boolean;
  selectedItems?: IconGridItem[];
  onClose: () => void;
  onOpen: (item: IconGridItem) => void;
  onOpenWithApp?: (item: IconGridItem, app: MimeAppOption) => void;
  /** Create a link file (`.desktop`, Type=Link) pointing at the items. */
  onMakeLink?: (items: IconGridItem[]) => void;
  onOpenInNewWindow?: (item: IconGridItem) => void;
  onOpenContainingFolder?: (item: IconGridItem) => void;
  /** Symbolic links: reveal the target in Folders. */
  onShowOriginal?: (item: IconGridItem) => void;
  /** Folders: add to / remove from the sidebar bookmarks. */
  onToggleBookmark?: (item: IconGridItem) => void;
  bookmarkedPaths?: ReadonlySet<string>;
  onRestore?: (item: IconGridItem) => void;
  onRestoreItems?: (items: IconGridItem[]) => void;
  onOpenInTerminal?: (item: IconGridItem) => void;
  onEditText?: (item: IconGridItem) => void;
  onCut?: (item: IconGridItem) => void;
  onCutItems?: (items: IconGridItem[]) => void;
  onCopy?: (item: IconGridItem) => void;
  onCopyItems?: (items: IconGridItem[]) => void;
  onDuplicate?: (items: IconGridItem[]) => void;
  onCompress?: (items: IconGridItem[]) => void;
  onExtract?: (item: IconGridItem) => void;
  onDownload?: (item: IconGridItem) => void;
  onPaste?: () => void;
  canPaste?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (item: IconGridItem) => void;
  activeEmblems?: readonly VfsEmblemId[];
  onToggleEmblem?: (items: IconGridItem[], emblem: VfsEmblemId) => void;
  onRename: (item: IconGridItem) => void;
  onTrash: (item: IconGridItem) => void;
  onTrashItems?: (items: IconGridItem[]) => void;
}) {
  const piloti = usePiloti();
  const { realFilesystem } = useCapabilities();
  const { getAppIconUrl, installedXdgApps } = useFilesHost().useApps();
  const [mimeConfig, setMimeConfig] = React.useState<MimeAppsConfig | null>(null);
  usePopupSurface(Boolean(menu), onClose);

  React.useEffect(() => {
    if (!menu) return;
    let cancelled = false;
    void loadMimeAppsConfig(piloti).then((cfg) => {
      if (!cancelled) setMimeConfig(cfg);
    });
    return () => {
      cancelled = true;
    };
  }, [piloti, realFilesystem, menu]);

  if (!menu) return null;

  const effectiveContext: FileContextMenuKind = isTrash ? "trash" : context;
  const targetItems =
    selectedItems &&
    selectedItems.length > 0 &&
    selectedItems.some((i) => i.id === menu.item.id)
      ? selectedItems
      : [menu.item];
  const multiCount = targetItems.length;
  const hasSelection = multiCount > 0;
  const isSingle = multiCount === 1;
  const openWithApps: MimeAppOption[] =
    isSingle && mimeConfig
      ? resolveAppsForMime(
          inferMimeType(menu.item.name, menu.item.kind === "directory" ? "directory" : "file"),
          mimeConfig,
          installedXdgApps,
        )
      : [];
  const isVirtualView =
    effectiveContext === "favorites" || effectiveContext === "recents";

  const inTrash = effectiveContext === "trash";
  const canCut = hasSelection && (onCutItems || onCut) && !isVirtualView && !inTrash;
  const canCopy = hasSelection && (onCopyItems || onCopy);
  const canDoDuplicate = hasSelection && Boolean(onDuplicate) && !isVirtualView && !inTrash;
  const canDoCompress = hasSelection && Boolean(onCompress) && !isVirtualView && !inTrash;
  const showCompress = Boolean(onCompress);
  const showExtract = Boolean(
    onExtract &&
      !isVirtualView &&
      isSingle &&
      menu.item.kind === "file" &&
      isExtractableArchive(menu.item.name),
  );
  const showDownload =
    Boolean(onDownload) &&
    !realFilesystem &&
    isSingle &&
    menu.item.kind === "file";
  const canDoRename = isSingle && !isVirtualView && !inTrash;
  const canDoPaste = Boolean(onPaste) && canPaste && !isVirtualView;
  const canDoTrash = hasSelection;

  const itemBtnClass = cn(
    MENU_ITEM_CLASS,
    "w-full text-left hover:bg-ui-menu-highlight disabled:pointer-events-none disabled:opacity-40",
  );

  const left =
    typeof window !== "undefined"
      ? Math.min(window.innerWidth - 224, menu.x)
      : menu.x;
  const top =
    typeof window !== "undefined"
      ? Math.min(window.innerHeight - 360, menu.y)
      : menu.y;

  const content = (
    <div
      data-popup-backdrop=""
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
        className={cn(MENU_POPUP_CLASS, "fixed min-w-52 overflow-visible")}
      >
        {effectiveContext === "trash" ? (
          <>
            {(onRestoreItems || onRestore) && (
              <button
                type="button"
                role="menuitem"
                disabled={!hasSelection}
                onClick={() => {
                  onClose();
                  if (onRestoreItems) onRestoreItems(targetItems);
                  else if (onRestore) {
                    for (const t of targetItems) onRestore(t);
                  }
                }}
                className={itemBtnClass}
              >
                {_("Restore")}
              </button>
            )}
            <div className={MENU_SEPARATOR_CLASS} />
            <button
              type="button"
              role="menuitem"
              disabled={!hasSelection}
              onClick={() => {
                onClose();
                if (onTrashItems) onTrashItems(targetItems);
                else {
                  for (const t of targetItems) onTrash(t);
                }
              }}
              className={cn(itemBtnClass, "text-destructive")}
            >
              {_("Delete Permanently")}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              role="menuitem"
              disabled={!isSingle}
              onClick={() => {
                const target = menu.item;
                onClose();
                onOpen(target);
              }}
              className={itemBtnClass}
            >
              {_("Open")}
            </button>

            {isSingle && menu.item.kind === "directory" && onOpenInNewWindow && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const target = menu.item;
                  onClose();
                  onOpenInNewWindow(target);
                }}
                className={itemBtnClass}
              >
                {_("Open in New Window")}
              </button>
            )}
            {isSingle && isVirtualView && onOpenContainingFolder && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const target = menu.item;
                  onClose();
                  onOpenContainingFolder(target);
                }}
                className={itemBtnClass}
              >
                {_("Open Containing Folder")}
              </button>
            )}
            {isSingle && onShowOriginal && menu.item.isSymlink && menu.item.symlinkTarget && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const target = menu.item;
                  onClose();
                  onShowOriginal(target);
                }}
                className={itemBtnClass}
              >
                {_("Show Original")}
              </button>
            )}
            {isSingle && onToggleBookmark && menu.item.kind === "directory" && !isTrash && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const target = menu.item;
                  onClose();
                  onToggleBookmark(target);
                }}
                className={itemBtnClass}
              >
                {bookmarkedPaths?.has(menu.item.path ?? menu.item.id)
                  ? _("Remove from Bookmarks")
                  : _("Add to Bookmarks")}
              </button>
            )}
            {isSingle && onOpenInTerminal && menu.item.kind === "directory" && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const target = menu.item;
                  onClose();
                  onOpenInTerminal(target);
                }}
                className={itemBtnClass}
              >
                {_("Open in Terminal")}
              </button>
            )}

            {isSingle && onOpenWithApp && openWithApps.length > 0 && (
              <ContextSubmenu label={_("Open With")} className={itemBtnClass}>
                {openWithApps.map((appOpt) => {
                  const catApp = APP_CATALOG.find(
                    (a) => a.id === (appOpt.builtinAppId ?? appOpt.appId),
                  );
                  const xdgApp = appOpt.entry;
                  const iconUrl = getAppIconUrl(
                    catApp?.id ?? xdgApp?.appId ?? appOpt.appId,
                  );
                  return (
                    <button
                      key={appOpt.desktopId}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        const target = menu.item;
                        onClose();
                        onOpenWithApp(target, appOpt);
                      }}
                      className={itemBtnClass}
                    >
                      <AppSquircleIcon
                        iconName={catApp?.iconName}
                        iconUrl={iconUrl}
                        squircle={false}
                        className="size-4 shrink-0"
                        glyphClassName="size-4"
                      />
                      <span className="truncate">
                        {_(catApp?.name ?? appOpt.label)}
                      </span>
                    </button>
                  );
                })}
              </ContextSubmenu>
            )}

            <div className={MENU_SEPARATOR_CLASS} />

            <button
              type="button"
              role="menuitem"
              disabled={!canCut}
              onClick={() => {
                onClose();
                if (onCutItems) onCutItems(targetItems);
                else onCut?.(menu.item);
              }}
              className={itemBtnClass}
            >
              {_("Cut")}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!canCopy}
              onClick={() => {
                onClose();
                if (onCopyItems) onCopyItems(targetItems);
                else onCopy?.(menu.item);
              }}
              className={itemBtnClass}
            >
              {_("Copy")}
            </button>
            {onPaste && (
              <button
                type="button"
                role="menuitem"
                disabled={!canDoPaste}
                onClick={() => {
                  onClose();
                  onPaste();
                }}
                className={itemBtnClass}
              >
                {_("Paste")}
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              disabled={!canDoDuplicate}
              onClick={() => {
                onClose();
                onDuplicate?.(targetItems);
              }}
              className={itemBtnClass}
            >
              {_("Duplicate")}
            </button>
            {onMakeLink && !isVirtualView && !isTrash && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onClose();
                  onMakeLink(targetItems);
                }}
                className={itemBtnClass}
              >
                {_("Make Link")}
              </button>
            )}

            <div className={MENU_SEPARATOR_CLASS} />
            <button
              type="button"
              role="menuitem"
              disabled={!canDoRename}
              onClick={() => {
                const target = menu.item;
                onClose();
                onRename(target);
              }}
              className={itemBtnClass}
            >
              {_("Rename…")}
            </button>

            {(showCompress || showExtract || showDownload) && (
              <>
                <div className={MENU_SEPARATOR_CLASS} />
                {showCompress && onCompress && (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!canDoCompress}
                    onClick={() => {
                      onClose();
                      onCompress(targetItems);
                    }}
                    className={itemBtnClass}
                  >
                    {_("Compress")}
                  </button>
                )}
                {showExtract && onExtract && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onClose();
                      onExtract(menu.item);
                    }}
                    className={itemBtnClass}
                  >
                    {_("Extract Here")}
                  </button>
                )}
                {showDownload && onDownload && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onClose();
                      onDownload(menu.item);
                    }}
                    className={itemBtnClass}
                  >
                    {_("Download")}
                  </button>
                )}
              </>
            )}

            <div className={MENU_SEPARATOR_CLASS} />
            <button
              type="button"
              role="menuitem"
              disabled={!canDoTrash}
              onClick={() => {
                onClose();
                if (onTrashItems) onTrashItems(targetItems);
                else {
                  for (const t of targetItems) onTrash(t);
                }
              }}
              className={itemBtnClass}
            >
              {_("Move to Trash")}
            </button>
          </>
        )}
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(content, document.body)
    : content;
}
