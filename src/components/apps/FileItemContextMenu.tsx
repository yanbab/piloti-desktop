import * as React from "react";
import { createPortal } from "react-dom";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  AlertCircleIcon,
  BriefcaseIcon,
  HeartIcon,
  TagIcon,
} from "lucide-react";
import { AppSquircleIcon } from "@/components/shell/AppSymbol";
import {
  MENU_ITEM_CLASS,
  MENU_LABEL_CLASS,
  MENU_POPUP_CLASS,
  MENU_SEPARATOR_CLASS,
} from "@/components/ui/menu-styles";
import { useApps } from "@/context/AppsContext";
import { useSettings } from "@/context/DesktopStateContext";
import { APP_CATALOG } from "@/data/catalog";
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
} from "@/lib/xdg/xdg-mimeapps";

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

const TAG_ORDER: readonly VfsEmblemId[] = [
  "favorite",
  "important",
  "work",
  "personal",
];

function TagIconGlyph({
  tag,
  active,
}: {
  tag: VfsEmblemId;
  active: boolean;
}) {
  if (tag === "favorite") {
    return (
      <HeartIcon
        className={cn("size-3.5 text-red-500", active && "fill-current")}
      />
    );
  }
  if (tag === "important") {
    return <AlertCircleIcon className="size-3.5" />;
  }
  if (tag === "work") {
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
  onCompress,
  onExtract,
  onDownload,
  onPaste,
  canPaste = false,
  isFavorite = false,
  onToggleFavorite,
  activeEmblems,
  onToggleEmblem,
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
  const domicile = useDomicile();
  const { isBrowserRuntime } = useSettings();
  const { getAppIconUrl, installedXdgApps } = useApps();
  const [mimeConfig, setMimeConfig] = React.useState<MimeAppsConfig | null>(null);

  React.useEffect(() => {
    if (!menu) return;
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
  const hasSelection = multiCount > 0;
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

  const resolvedTags = new Set<VfsEmblemId>(activeEmblems ?? []);
  if (isFavorite) {
    resolvedTags.add("favorite");
  }

  const canCut = hasSelection && (onCutItems || onCut) && !isVirtualView;
  const canCopy = hasSelection && (onCopyItems || onCopy);
  const canDoDuplicate = hasSelection && Boolean(onDuplicate) && !isVirtualView;
  const canDoCompress = hasSelection && Boolean(onCompress) && !isVirtualView;
  const canDoDownload =
    Boolean(onDownload) &&
    isBrowserRuntime &&
    isSingle &&
    menu.item.kind === "file";
  const canDoRename = isSingle && !isVirtualView;
  const canDoPaste = Boolean(onPaste) && canPaste && !isVirtualView;
  const canDoTrash = hasSelection;

  const itemBtnClass = cn(
    MENU_ITEM_CLASS,
    "w-full text-left hover:bg-adw-menu-highlight disabled:pointer-events-none disabled:opacity-40",
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
                {multiCount > 1
                  ? `${_("Restore")} (${multiCount})`
                  : _("Restore")}
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
              {multiCount > 1
                ? `${_("Delete Permanently")} (${multiCount})`
                : _("Delete Permanently")}
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
              <>
                <div className={MENU_SEPARATOR_CLASS} />
                <div className={cn(MENU_LABEL_CLASS, "text-[11px] font-medium")}>
                  {_("Open With")}
                </div>
                {openWithApps.map((appOpt) => {
                  const catApp = APP_CATALOG.find((a) => a.id === appOpt.appId);
                  const xdgApp = installedXdgApps.find(
                    (a) =>
                      a.appId === appOpt.appId ||
                      a.desktopId === appOpt.desktopId,
                  );
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
                        onOpenWithApp(target, appOpt.appId);
                      }}
                      className={itemBtnClass}
                    >
                      <AppSquircleIcon
                        iconName={catApp?.iconName}
                        iconUrl={iconUrl}
                        gradient={catApp?.gradient}
                        squircle={false}
                        className="size-4 shrink-0"
                        glyphClassName="size-3"
                      />
                      <span className="truncate">
                        {_(catApp?.name ?? appOpt.label)}
                      </span>
                    </button>
                  );
                })}
              </>
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
              {multiCount > 1 ? `${_("Cut")} (${multiCount})` : _("Cut")}
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
              {multiCount > 1 ? `${_("Copy")} (${multiCount})` : _("Copy")}
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
              {multiCount > 1
                ? `${_("Duplicate")} (${multiCount})`
                : _("Duplicate")}
            </button>
            {onCompress && (
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
                {multiCount > 1
                  ? `${_("Compress")} (${multiCount})`
                  : _("Compress")}
              </button>
            )}
            {onExtract &&
              !isVirtualView &&
              isSingle &&
              menu.item.kind === "file" &&
              menu.item.name.toLowerCase().endsWith(".zip") && (
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
            {onDownload && (
              <button
                type="button"
                role="menuitem"
                disabled={!canDoDownload}
                onClick={() => {
                  onClose();
                  onDownload(menu.item);
                }}
                className={itemBtnClass}
              >
                {_("Download")}
              </button>
            )}
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

            {onToggleEmblem ? (
              <>
                <div className={MENU_SEPARATOR_CLASS} />
                <div className="px-[12px] py-1">
                  <div className="mb-1 text-[11px] font-medium text-adw-label-secondary">
                    {_("Tags")}
                  </div>
                  <div className="flex items-center gap-1">
                    {TAG_ORDER.map((tag) => {
                      const meta = VFS_EMBLEM_META[tag];
                      const active = resolvedTags.has(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          title={_(meta.label)}
                          aria-label={_(meta.label)}
                          aria-pressed={active}
                          onClick={() => {
                            onClose();
                            onToggleEmblem(targetItems, tag);
                          }}
                          className={cn(
                            "flex size-7 items-center justify-center rounded-md border transition-colors active:bg-[color-mix(in_srgb,currentColor_22%,transparent)]",
                            meta.colorClass,
                            active
                              ? "border-current/45 bg-[color-mix(in_srgb,currentColor_14%,transparent)] hover:bg-[color-mix(in_srgb,currentColor_22%,transparent)]"
                              : "border-transparent opacity-75 hover:opacity-100 hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)]",
                          )}
                        >
                          <TagIconGlyph tag={tag} active={active} />
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
                  className={itemBtnClass}
                >
                  {isFavorite
                    ? _("Remove from Favorites")
                    : _("Add to Favorites")}
                </button>
              </>
            ) : null}

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
