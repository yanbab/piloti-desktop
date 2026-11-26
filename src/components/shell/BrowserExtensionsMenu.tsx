import * as React from "react";
import { PinIcon, PinOffIcon, PuzzleIcon, SettingsIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";

export interface BrowserExtensionItem {
  id: string;
  name: string;
  /** Image URL; falls back to a puzzle piece. */
  icon?: string;
  badgeText?: string;
  badgeColor?: string;
  enabled?: boolean;
  /** Toggle-style extension (Dark Reader in web mode). */
  pressed?: boolean;
  /** Popup currently open for this extension. */
  active?: boolean;
  onActivate: () => void;
}

const BUTTON_CLASS =
  "relative flex size-7 items-center justify-center rounded-shell-control transition-colors disabled:pointer-events-none disabled:opacity-40";

function ExtensionIcon({ item }: { item: BrowserExtensionItem }) {
  return item.icon ? (
    <img src={item.icon} alt="" draggable={false} className="size-4 rounded-[3px] object-contain" />
  ) : (
    <PuzzleIcon className="size-3.5" />
  );
}

function Badge({ item }: { item: BrowserExtensionItem }) {
  if (!item.badgeText) return null;
  return (
    <span
      style={{
        backgroundColor:
          item.badgeColor && item.badgeColor !== "#00000000" ? item.badgeColor : "var(--shell-accent)",
      }}
      className="pointer-events-none absolute right-0.5 bottom-0.5 min-w-3 rounded-full px-0.5 text-center text-[8.5px] leading-tight font-bold text-white shadow-xs"
    >
      {item.badgeText}
    </span>
  );
}

/**
 * Chrome-style extensions button: pinned extensions get their own toolbar
 * button; the puzzle-piece menu lists every extension with a pin toggle.
 */
export function BrowserExtensionsMenu({
  items,
  pinnedIds,
  onTogglePin,
  onManage,
}: {
  items: readonly BrowserExtensionItem[];
  pinnedIds: readonly string[];
  onTogglePin: (id: string) => void;
  onManage: () => void;
}) {
  const pinned = items.filter((item) => pinnedIds.includes(item.id));
  return (
    <>
      {pinned.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={item.enabled === false}
          aria-label={item.name}
          aria-pressed={item.pressed}
          onClick={item.onActivate}
          className={cn(
            BUTTON_CLASS,
            item.active || item.pressed
              ? "bg-black/14 dark:bg-white/18"
              : "hover-fill:bg-black/8 dark:hover-fill:bg-white/10",
          )}
        >
          <ExtensionIcon item={item} />
          <Badge item={item} />
        </button>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={_("Extensions")}
          className={cn(BUTTON_CLASS, "hover-fill:bg-black/8 data-[popup-open]:bg-black/14 dark:hover-fill:bg-white/10 dark:data-[popup-open]:bg-white/18")}
        >
          <PuzzleIcon className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>{_("Extensions")}</DropdownMenuLabel>
          {items.length === 0 && (
            <div className="px-3 py-3 text-shell-callout text-shell-label-secondary">
              {_("No extensions installed.")}
            </div>
          )}
          {items.map((item) => {
            const isPinned = pinnedIds.includes(item.id);
            return (
              <div key={item.id} className="flex items-center gap-1">
                <DropdownMenuItem
                  disabled={item.enabled === false}
                  onClick={item.onActivate}
                  className="min-w-0 flex-1 gap-2.5"
                >
                  <span className="relative flex size-5 shrink-0 items-center justify-center">
                    <ExtensionIcon item={item} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                </DropdownMenuItem>
                <button
                  type="button"
                  aria-label={isPinned ? _("Unpin from toolbar") : _("Pin to toolbar")}
                  aria-pressed={isPinned}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin(item.id);
                  }}
                  className={cn(
                    "mr-1 flex size-7 shrink-0 items-center justify-center rounded-shell-control transition-colors hover-fill:bg-black/8 dark:hover-fill:bg-white/10",
                    isPinned && "text-shell-accent",
                  )}
                >
                  {isPinned ? <PinOffIcon className="size-3.5" /> : <PinIcon className="size-3.5" />}
                </button>
              </div>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onManage} className="gap-2.5">
            <SettingsIcon className="size-4" />
            {_("Manage Extensions")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
