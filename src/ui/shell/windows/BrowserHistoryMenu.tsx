/// <reference types="@domicile-desktop/react/elements" />
import * as React from "react";
import { GlobeIcon } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/ui/components/ui/context-menu";
import { _ } from "@/core/util/i18n";
import { historyMenuEntries, type HistoryMenuEntry } from "@/ui/shell/windows/browser-history-menu";

/** How long a press on Back or Forward lasts before it opens the list. */
const LONG_PRESS_MS = 450;

/**
 * Back or Forward with its pages: a right-click, or a long press, lists them
 * nearest first, as Chrome does. Native only (the demo cannot read a page's
 * history); without a view the button is shown alone.
 */
export function BrowserHistoryMenu({
  view,
  direction,
  onOpenInNewTab,
  children,
}: {
  view: HTMLWebViewElement | null;
  direction: "back" | "forward";
  onOpenInNewTab?: (url: string) => void;
  children: React.ReactElement;
}) {
  const [entries, setEntries] = React.useState<HistoryMenuEntry[]>([]);
  const pressRef = React.useRef<{ timer: ReturnType<typeof setTimeout> } | null>(null);
  const firedRef = React.useRef(false);

  const load = React.useCallback(() => {
    if (!view) return;
    view
      .history()
      .then((h) => setEntries(historyMenuEntries(h, direction)))
      .catch(() => setEntries([]));
  }, [view, direction]);

  if (!view) return children;

  const cancelPress = () => {
    if (pressRef.current) clearTimeout(pressRef.current.timer);
    pressRef.current = null;
  };

  return (
    <ContextMenu onOpenChange={(open) => open && load()}>
      <ContextMenuTrigger
        className="contents"
        onPointerDown={(e) => {
          if (e.button !== 0 || e.pointerType === "touch") return;
          firedRef.current = false;
          const target = e.target as HTMLElement;
          const { clientX, clientY } = e;
          cancelPress();
          pressRef.current = {
            timer: setTimeout(() => {
              firedRef.current = true;
              pressRef.current = null;
              target.dispatchEvent(
                new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX, clientY, button: 2 })
              );
            }, LONG_PRESS_MS),
          };
        }}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onClickCapture={(e) => {
          // The press opened the list: the release is not a click on Back.
          if (firedRef.current) {
            firedRef.current = false;
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-72" data-slot={`browser-history-${direction}`}>
        {entries.length === 0 ? (
          <ContextMenuItem disabled>{_("No Pages")}</ContextMenuItem>
        ) : (
          entries.map((entry) => (
            <ContextMenuItem
              key={entry.id}
              title={entry.url}
              onClick={(e) => {
                if ((e.ctrlKey || e.metaKey) && onOpenInNewTab) onOpenInNewTab(entry.url);
                else view.goToHistoryEntry(entry.id);
              }}
            >
              {entry.favicon ? (
                <img src={entry.favicon} alt="" className="size-4 shrink-0" />
              ) : (
                <GlobeIcon className="size-4 shrink-0 opacity-50" />
              )}
              <span className="truncate">{entry.title}</span>
            </ContextMenuItem>
          ))
        )}
        {entries.length > 0 && direction === "back" && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => {
                const oldest = entries[entries.length - 1];
                if (oldest) view.goToHistoryEntry(oldest.id);
              }}
            >
              {_("Go to First Page")}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
