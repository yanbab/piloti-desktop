import * as React from "react";
import { createPortal } from "react-dom";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  AlertCircleIcon,
  BriefcaseIcon,
  ChevronRightIcon,
  HeartIcon,
  TagIcon,
} from "lucide-react";
import {
  MENU_ITEM_CLASS,
  MENU_POPUP_CLASS,
  MENU_SEPARATOR_CLASS,
} from "@/components/ui/menu-styles";
import { useSettings } from "@/context/DesktopStateContext";
import type { IconGridItem } from "@/lib/desktop-icons";
import { _ } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { VFS_EMBLEM_META, type VfsEmblemId } from "@/lib/web-vfs";
import {
  inferMimeType,
  loadMimeAppsConfig,
  type MimeAppOption,
  type MimeAppsConfig,
  resolveAppsForMime,
} from "@/lib/xdg-mimeapps";

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

const EMBLEM_ORDER: readonly VfsEmblemId[] = [
  "favorite",
  "important",
  "work",
  "personal",
];

function EmblemIconGlyph({
  emblem,
  active,
}: {
  emblem: VfsEmblemId;
  active: boolean;
}) {
  if (emblem === "favorite") {
    return <HeartIcon className={cn("size-3.5", active && "fill-current")} />;
  }
  if (emblem === "important") {
    return <AlertCircleIcon className="size-3.5" />;
  }
  if (emblem === "work") {
    return <BriefcaseIcon className="size-3.5" />;
  }
  return <TagIcon className="size-3.5" />;
}

export function FileItemContextMenu({
  menu,
  context = "normal",
  isTrash = false,
  selectedItems,
  onClose,
  onOpen,
  onOpenWithApp,
  onOpenInNewWindow,
  onOpenContainingFolder,
  onRestore,
  onRestoreItems,
  onOpenInTerminal,
  onCut,
  onCutItems,
  onCopy,
  onCopyItems,
  onDuplicate,
  onPaste,
  canPaste = false,
  isFavorite = false,
  onToggleFavorite,
  activeEmblems,
  onToggleEmblem,
  onRename,
  onGetInfo,
  onNewFolder,
  onNewTextFile,
  onTrash,
  onTrashItems,
}: {
  menu: FileItemContextMenuState | null;
  context?: FileContextMenuKind;
  isTrash?: boolean;
  selectedItems?: IconGridItem[];
  onClose: () => void;
  onOpen: (item: IconGridItem) => void;
  onOpenWithApp?: (item: IconGridItem, appId: string) => void;
  onOpenInNewWindow?: (item: IconGridItem) => void;
  onOpenContainingFolder?: (item: IconGridItem) => void;
  onRestore?: (item: IconGridItem) => void;
  onRestoreItems?: (items: IconGridItem[]) => void;
  onOpenInTerminal?: (item: IconGridItem) => void;
  onEditText?: (item: IconGridItem) => void;
  onCut?: (item: IconGridItem) => void;
  onCutItems?: (items: IconGridItem[]) => void;
  onCopy?: (item: IconGridItem) => void;
  onCopyItems?: (items: IconGridItem[]) => void;
  onDuplicate?: (items: IconGridItem[]) => void;
  onPaste?: () => void;
  canPaste?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (item: IconGridItem) => void;
  activeEmblems?: readonly VfsEmblemId[];
  onToggleEmblem?: (items: IconGridItem[], emblem: VfsEmblemId) => void;
  onRename: (item: IconGridItem) => void;
  onGetInfo?: (item: IconGridItem) => void;
  onNewFolder?: () => void;
  onNewTextFile?: () => void;
  onTrash: (item: IconGridItem) => void;
  onTrashItems?: (items: IconGridItem[]) => void;
}) {
  const domicile = useDomicile();
  const { isBrowserRuntime } = useSettings();
  const [mimeConfig, setMimeConfig] = React.useState<MimeAppsConfig | null>(null);
  const [openWithHovered, setOpenWithHovered] = React.useState(false);

  React.useEffect(() => {
    if (!menu) {
      setOpenWithHovered(false);
      return;
    }
    let cancelled = false;
    void loadMimeAppsConfig(domicile, isBrowserRuntime).then((cfg) => {
      if (!cancelled) setMimeConfig(cfg);
    });
    return () => {
      cancelled = true;
    };
  }, [domicile, isBrowserRuntime, menu]);

  if (!menu) return null;

  const effectiveContext: FileContextMenuKind = isTrash ? "trash" : context;
  const targetItems =
    selectedItems &&
    selectedItems.length > 0 &&
    selectedItems.some((i) => i.id === menu.item.id)
      ? selectedItems
      : [menu.item];
  const multiCount = targetItems.length;
  const isSingle = multiCount === 1;
  const openWithApps: MimeAppOption[] =
    isSingle && mimeConfig
      ? resolveAppsForMime(
          inferMimeType(
            menu.item.name,
            menu.item.kind === "directory" ? "directory" : "file",
          ),
          mimeConfig,
        )
      : [];
  const isVirtualView =
    effectiveContext === "favorites" || effectiveContext === "recents";

  const resolvedEmblems = new Set<VfsEmblemId>(activeEmblems ?? []);
  if (isFavorite) {
    resolvedEmblems.add("favorite");
  }

  const left =
    typeof window !== "undefined"
      ? Math.min(window.innerWidth - 216, menu.x)
      : menu.x;
  const top =
    typeof window !== "undefined"
      ? Math.min(window.innerHeight - 280, menu.y)
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
        className={cn(MENU_POPUP_CLASS, "fixed min-w-48")}
      >
        {effectiveContext === "trash" ? (
          <>
            {(onRestoreItems || onRestore) && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onClose();
                  if (onRestoreItems) onRestoreItems(targetItems);
                  else if (onRestore) {
                    for (const t of targetItems) onRestore(t);
                  }
                }}
                className={cn(
                  MENU_ITEM_CLASS,
                  "w-full text-left hover:bg-adw-menu-highlight",
                )}
              >
                {multiCount > 1
                  ? `${_("Restore")} (${multiCount})`
                  : _("Restore")}
              </button>
            )}
            <div className={MENU_SEPARATOR_CLASS} />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onClose();
                if (onTrashItems) onTrashItems(targetItems);
                else {
                  for (const t of targetItems) onTrash(t);
                }
              }}
              className={cn(
                MENU_ITEM_CLASS,
                "w-full text-left text-destructive hover:bg-adw-menu-highlight",
              )}
            >
              {multiCount > 1
                ? `${_("Delete Permanently")} (${multiCount})`
                : _("Delete Permanently")}
            </button>
          </>
        ) : (
          <>
            {isSingle && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const target = menu.item;
                  onClose();
                  onOpen(target);
                }}
                className={cn(
                  MENU_ITEM_CLASS,
                  "w-full text-left hover:bg-adw-menu-highlight",
                )}
              >
                {_("Open")}
              </button>
            )}
            {isSingle && onOpenWithApp && openWithApps.length >= 2 && (
              <div
                className="relative"
                onMouseEnter={() => setOpenWithHovered(true)}
                onMouseLeave={() => setOpenWithHovered(false)}
              >
                <button
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={openWithHovered}
                  onClick={() => setOpenWithHovered((v) => !v)}
                  className={cn(
                    MENU_ITEM_CLASS,
                    "flex w-full items-center justify-between text-left hover:bg-adw-menu-highlight",
                  )}
                >
                  <span>{_("Open With")}</span>
                  <ChevronRightIcon className="size-3.5 opacity-70" />
                </button>
                {openWithHovered && (
                  <div
                    role="menu"
                    className={cn(
                      MENU_POPUP_CLASS,
                      "absolute top-0 left-full ml-1 min-w-40",
                    )}
                  >
                    {openWithApps.map((appOpt) => (
                      <button
                        key={appOpt.desktopId}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          const target = menu.item;
                          onClose();
                          onOpenWithApp(target, appOpt.appId);
                        }}
                        className={cn(
                          MENU_ITEM_CLASS,
                          "w-full text-left hover:bg-adw-menu-highlight",
                        )}
                      >
                        {_(appOpt.label)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {isSingle &&
              menu.item.kind === "directory" &&
              onOpenInNewWindow && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const target = menu.item;
                    onClose();
                    onOpenInNewWindow(target);
                  }}
                  className={cn(
                    MENU_ITEM_CLASS,
                    "w-full text-left hover:bg-adw-menu-highlight",
                  )}
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
                className={cn(
                  MENU_ITEM_CLASS,
                  "w-full text-left hover:bg-adw-menu-highlight",
                )}
              >
                {_("Open Containing Folder")}
              </button>
            )}
            {isSingle &&
              onOpenInTerminal &&
              menu.item.kind === "directory" && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const target = menu.item;
                    onClose();
                    onOpenInTerminal(target);
                  }}
                  className={cn(
                    MENU_ITEM_CLASS,
                    "w-full text-left hover:bg-adw-menu-highlight",
                  )}
                >
                  {_("Open in Terminal")}
                </button>
              )}

            {(onCut ||
              onCutItems ||
              onCopy ||
              onCopyItems ||
              onDuplicate ||
              (onPaste && canPaste && !isVirtualView)) && (
              <>
                <div className={MENU_SEPARATOR_CLASS} />
                {(onCutItems || onCut) && !isVirtualView && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onClose();
                      if (onCutItems) onCutItems(targetItems);
                      else onCut?.(menu.item);
                    }}
                    className={cn(
                      MENU_ITEM_CLASS,
                      "w-full text-left hover:bg-adw-menu-highlight",
                    )}
                  >
                    {multiCount > 1
                      ? `${_("Cut")} (${multiCount})`
                      : _("Cut")}
                  </button>
                )}
                {(onCopyItems || onCopy) && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onClose();
                      if (onCopyItems) onCopyItems(targetItems);
                      else onCopy?.(menu.item);
                    }}
                    className={cn(
                      MENU_ITEM_CLASS,
                      "w-full text-left hover:bg-adw-menu-highlight",
                    )}
                  >
                    {multiCount > 1
                      ? `${_("Copy")} (${multiCount})`
                      : _("Copy")}
                  </button>
                )}
                {onDuplicate && !isVirtualView && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onClose();
                      onDuplicate(targetItems);
                    }}
                    className={cn(
                      MENU_ITEM_CLASS,
                      "w-full text-left hover:bg-adw-menu-highlight",
                    )}
                  >
                    {multiCount > 1
                      ? `${_("Duplicate")} (${multiCount})`
                      : _("Duplicate")}
                  </button>
                )}
                {onPaste && canPaste && !isVirtualView && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onClose();
                      onPaste();
                    }}
                    className={cn(
                      MENU_ITEM_CLASS,
                      "w-full text-left hover:bg-adw-menu-highlight",
                    )}
                  >
                    {_("Paste")}
                  </button>
                )}
              </>
            )}

            {onToggleEmblem ? (
              <>
                <div className={MENU_SEPARATOR_CLASS} />
                <div className="px-2.5 py-1">
                  <div className="mb-1 text-[10.5px] font-semibold tracking-wide text-adw-dim uppercase">
                    {_("Emblems")}
                  </div>
                  <div className="flex items-center gap-1">
                    {EMBLEM_ORDER.map((emblem) => {
                      const meta = VFS_EMBLEM_META[emblem];
                      const active = resolvedEmblems.has(emblem);
                      return (
                        <button
                          key={emblem}
                          type="button"
                          title={meta.label}
                          aria-label={meta.label}
                          aria-pressed={active}
                          onClick={() => {
                            onClose();
                            onToggleEmblem(targetItems, emblem);
                          }}
                          className={cn(
                            "flex size-7 items-center justify-center rounded-md border transition-colors active:bg-[color-mix(in_srgb,currentColor_22%,transparent)]",
                            meta.colorClass,
                            active
                              ? "border-current/45 bg-[color-mix(in_srgb,currentColor_14%,transparent)] hover:bg-[color-mix(in_srgb,currentColor_22%,transparent)]"
                              : "border-transparent opacity-75 hover:opacity-100 hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)]",
                          )}
                        >
                          <EmblemIconGlyph emblem={emblem} active={active} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : onToggleFavorite && isSingle ? (
              <>
                <div className={MENU_SEPARATOR_CLASS} />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const target = menu.item;
                    onClose();
                    onToggleFavorite(target);
                  }}
                  className={cn(
                    MENU_ITEM_CLASS,
                    "w-full text-left hover:bg-adw-menu-highlight",
                  )}
                >
                  {isFavorite
                    ? _("Remove from Favorites")
                    : _("Add to Favorites")}
                </button>
              </>
            ) : null}

            {isSingle && (
              <>
                <div className={MENU_SEPARATOR_CLASS} />
                {!isVirtualView && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      const target = menu.item;
                      onClose();
                      onRename(target);
                    }}
                    className={cn(
                      MENU_ITEM_CLASS,
                      "w-full text-left hover:bg-adw-menu-highlight",
                    )}
                  >
                    {_("Rename…")}
                  </button>
                )}
                {onGetInfo && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      const target = menu.item;
                      onClose();
                      onGetInfo(target);
                    }}
                    className={cn(
                      MENU_ITEM_CLASS,
                      "w-full text-left hover:bg-adw-menu-highlight",
                    )}
                  >
                    {_("Get Info")}
                  </button>
                )}
              </>
            )}

            {(onNewFolder || onNewTextFile) && !isVirtualView && (
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
                      "w-full text-left hover:bg-adw-menu-highlight",
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
                      "w-full text-left hover:bg-adw-menu-highlight",
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
                onClose();
                if (onTrashItems) onTrashItems(targetItems);
                else {
                  for (const t of targetItems) onTrash(t);
                }
              }}
              className={cn(
                MENU_ITEM_CLASS,
                "w-full text-left hover:bg-adw-menu-highlight",
              )}
            >
              {multiCount > 1
                ? `${_("Move to Trash")} (${multiCount})`
                : _("Move to Trash")}
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

