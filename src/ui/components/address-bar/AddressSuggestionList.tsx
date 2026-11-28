import * as React from "react";
import { createPortal } from "react-dom";
import { FolderIcon, HistoryIcon, StarIcon, type LucideIcon } from "lucide-react";
import type { SymbolicIconName } from "@/core/icons/shell-icon-names";
import { SymbolicIcon } from "@/ui/components/ui/symbolic-icon";
import { cn } from "@/core/util/utils";
import type { AddressSuggestion, AddressSuggestionIcon } from "@/core/address/types";

const ICONS: Record<AddressSuggestionIcon, { name: SymbolicIconName; fallback: LucideIcon }> = {
  bookmark: { name: "starred", fallback: StarIcon },
  history: { name: "document-open-recent", fallback: HistoryIcon },
  folder: { name: "folder", fallback: FolderIcon },
};

/**
 * The list under an address field: pages, folders. Picked with the arrows
 * and Enter, or a click (on press, before the field loses focus). Drawn on
 * the page's layer, under `anchor`, so the header bar does not clip it.
 */
export function AddressSuggestionList({
  anchor,
  items,
  selected,
  heading,
  label,
  onPick,
  onHover,
}: {
  anchor: HTMLElement | null;
  items: readonly AddressSuggestion[];
  selected: number;
  /** A caption above the items (the browser's "Bookmarks" before typing). */
  heading?: string;
  label: string;
  onPick: (item: AddressSuggestion) => void;
  onHover: (index: number) => void;
}) {
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  React.useLayoutEffect(() => {
    if (!anchor) return;
    const measure = () => setRect(anchor.getBoundingClientRect());
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [anchor]);
  if (items.length === 0 || !rect || typeof document === "undefined") return null;
  return createPortal(
    <div
      style={{ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 240) }}
      role="listbox"
      aria-label={label}
      data-slot="address-suggestions"
      className="fixed z-[750] overflow-hidden rounded-ui-box border border-ui-separator py-1 text-ui-label shadow-ui-menu ui-material-menu"
    >
      {heading && (
        <div className="px-3 pt-1 pb-0.5 text-ui-caption font-semibold text-ui-label-secondary">
          {heading}
        </div>
      )}
      {items.map((item, i) => {
        const icon = ICONS[item.icon];
        const active = i === selected;
        return (
          <div
            key={item.key}
            role="option"
            aria-selected={active}
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(item);
            }}
            onMouseEnter={() => onHover(i)}
            className={cn(
              "mx-1 flex cursor-default items-center gap-2 rounded-ui-control px-2 py-1 text-ui-body",
              active && "bg-ui-accent text-white"
            )}
          >
            <SymbolicIcon
              name={icon.name}
              fallback={icon.fallback}
              className={cn(
                "size-3.5 shrink-0",
                active
                  ? "text-white"
                  : item.icon === "bookmark"
                    ? "text-ui-accent"
                    : "text-ui-label-secondary",
                item.icon === "bookmark" && "fill-current"
              )}
            />
            <span className="min-w-0 flex-1 truncate">{item.title}</span>
            {item.detail !== item.title && (
              <span
                className={cn(
                  "max-w-[45%] shrink-0 truncate text-ui-small",
                  active ? "text-white/80" : "text-ui-label-secondary"
                )}
              >
                {item.detail}
              </span>
            )}
          </div>
        );
      })}
    </div>,
    document.body
  );
}
