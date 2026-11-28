import * as React from "react";
import { createPortal } from "react-dom";
import { HistoryIcon, StarIcon } from "lucide-react";
import { SymbolicIcon } from "@/ui/components/ui/symbolic-icon";
import { _ } from "@/core/util/i18n";
import { cn } from "@/core/util/utils";
import type { AddressSuggestion } from "@/ui/shell/windows/browser-history";

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

/**
 * Pages under the address field: bookmarks when nothing is typed yet, then
 * bookmarks and history matching what is typed. Picked with the arrows and
 * Enter, or a click (on press, before the field loses focus). Drawn on the
 * page's layer, under `anchor`, so the header bar does not clip it.
 */
export function BrowserAddressSuggestions({
  anchor,
  items,
  selected,
  empty,
  onPick,
  onHover,
}: {
  anchor: HTMLElement | null;
  items: readonly AddressSuggestion[];
  selected: number;
  /** Nothing typed: the list is the bookmarks. */
  empty: boolean;
  onPick: (url: string) => void;
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
      style={{ top: rect.bottom + 4, left: rect.left, width: rect.width }}
      role="listbox"
      aria-label={empty ? _("Bookmarks") : _("Suggestions")}
      data-slot="browser-address-suggestions"
      className="fixed z-[750] overflow-hidden rounded-ui-box border border-ui-separator py-1 text-ui-label shadow-ui-menu ui-material-menu"
    >
      {empty && (
        <div className="px-3 pt-1 pb-0.5 text-ui-caption font-semibold text-ui-label-secondary">
          {_("Bookmarks")}
        </div>
      )}
      {items.map((item, i) => (
        <div
          key={item.url}
          role="option"
          aria-selected={i === selected}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(item.url);
          }}
          onMouseEnter={() => onHover(i)}
          className={cn(
            "mx-1 flex cursor-default items-center gap-2 rounded-ui-control px-2 py-1 text-ui-body",
            i === selected && "bg-ui-accent text-white"
          )}
        >
          <SymbolicIcon
            name={item.bookmarked ? "starred" : "document-open-recent"}
            fallback={item.bookmarked ? StarIcon : HistoryIcon}
            className={cn(
              "size-3.5 shrink-0",
              i === selected ? "text-white" : item.bookmarked ? "text-ui-accent" : "text-ui-label-secondary",
              item.bookmarked && "fill-current"
            )}
          />
          <span className="min-w-0 flex-1 truncate">
            {item.title || displayUrl(item.url)}
          </span>
          <span
            className={cn(
              "max-w-[45%] shrink-0 truncate text-ui-small",
              i === selected ? "text-white/80" : "text-ui-label-secondary"
            )}
          >
            {displayUrl(item.url)}
          </span>
        </div>
      ))}
    </div>,
    document.body
  );
}
