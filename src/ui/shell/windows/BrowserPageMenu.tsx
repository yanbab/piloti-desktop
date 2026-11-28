/// <reference types="@domicile-desktop/react/elements" />
import * as React from "react";
import type { WebViewContextMenuAction } from "@domicile-desktop/sdk/webview-element";
import {
  MENU_ITEM_CLASS,
  MENU_POPUP_CLASS,
  MENU_SEPARATOR_CLASS,
  MENU_SHORTCUT_CLASS,
} from "@/ui/components/ui/menu-styles";
import { _ } from "@/core/util/i18n";
import { cn } from "@/core/util/utils";

export interface PageMenuCommands {
  canGoBack: boolean;
  canGoForward: boolean;
  back: () => void;
  forward: () => void;
  reload: () => void;
  print: () => void;
  /** Absent outside the Web Browser (web apps have no tabs). */
  openInNewTab?: (url: string) => void;
  openInNewWindow: (url: string) => void;
  searchWeb: (text: string) => void;
}

type Item =
  | { kind: "separator" }
  | { kind: "item"; label: string; shortcut?: string; disabled?: boolean; run: () => void };

function shorten(text: string, max = 24): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** The items for what was under the click, as Chrome groups them. */
export function buildPageMenuItems(e: DomicileContextMenuEvent, cmd: PageMenuCommands): Item[] {
  const run = (action: WebViewContextMenuAction) => () => {
    try {
      e.run(action);
    } catch {
      // A newer menu replaced this one, or the page went away.
    }
  };
  const groups: Item[][] = [];

  if (e.misspelledWord && e.spellingSuggestions.length > 0) {
    groups.push(
      e.spellingSuggestions.slice(0, 4).map((word) => ({
        kind: "item" as const,
        label: word,
        run: () => {
          try {
            e.replaceMisspelling(word);
          } catch {
            // Replaced by a newer menu.
          }
        },
      }))
    );
  }
  if (e.linkUrl) {
    groups.push([
      ...(cmd.openInNewTab
        ? [{ kind: "item" as const, label: _("Open Link in New Tab"), run: () => cmd.openInNewTab!(e.linkUrl) }]
        : []),
      { kind: "item", label: _("Open Link in New Window"), run: () => cmd.openInNewWindow(e.linkUrl) },
      { kind: "item", label: _("Copy Link Address"), run: run("copy-link-address") },
      { kind: "item", label: _("Save Link As…"), run: run("save-link-as") },
    ]);
  }
  const media = e.mediaType;
  if (media === "image" || media === "canvas") {
    groups.push([
      ...(media === "image" && e.srcUrl && cmd.openInNewTab
        ? [{ kind: "item" as const, label: _("Open Image in New Tab"), run: () => cmd.openInNewTab!(e.srcUrl) }]
        : []),
      ...(e.hasImageContents || media === "canvas"
        ? [{ kind: "item" as const, label: _("Copy Image"), run: run("copy-image") }]
        : []),
      ...(media === "image" && e.srcUrl
        ? [
          { kind: "item" as const, label: _("Copy Image Address"), run: run("copy-media-address") },
          { kind: "item" as const, label: _("Save Image As…"), run: run("save-media-as") },
        ]
        : []),
    ]);
  } else if (media === "video" || media === "audio") {
    groups.push([
      ...(e.canPictureInPicture
        ? [
          {
            kind: "item" as const,
            label: e.inPictureInPicture ? _("Exit Picture in Picture") : _("Picture in Picture"),
            run: run("picture-in-picture"),
          },
        ]
        : []),
      ...(e.srcUrl
        ? [
          { kind: "item" as const, label: _("Copy Media Address"), run: run("copy-media-address") },
          {
            kind: "item" as const,
            label: media === "video" ? _("Save Video As…") : _("Save Audio As…"),
            run: run("save-media-as"),
          },
        ]
        : []),
    ]);
  }
  if (e.isEditable) {
    groups.push([
      { kind: "item", label: _("Undo"), shortcut: "Ctrl+Z", disabled: !e.canUndo, run: run("undo") },
      { kind: "item", label: _("Redo"), shortcut: "Ctrl+Shift+Z", disabled: !e.canRedo, run: run("redo") },
    ]);
    groups.push([
      { kind: "item", label: _("Cut"), shortcut: "Ctrl+X", disabled: !e.canCut, run: run("cut") },
      { kind: "item", label: _("Copy"), shortcut: "Ctrl+C", disabled: !e.canCopy, run: run("copy") },
      { kind: "item", label: _("Paste"), shortcut: "Ctrl+V", disabled: !e.canPaste, run: run("paste") },
      { kind: "item", label: _("Delete"), disabled: !e.canDelete, run: run("delete") },
    ]);
    groups.push([
      { kind: "item", label: _("Select All"), shortcut: "Ctrl+A", disabled: !e.canSelectAll, run: run("select-all") },
    ]);
  } else if (e.selectionText.trim()) {
    groups.push([
      { kind: "item", label: _("Copy"), shortcut: "Ctrl+C", run: run("copy") },
      {
        kind: "item",
        label: _("Search the Web for “%s”", shorten(e.selectionText)),
        run: () => cmd.searchWeb(e.selectionText.trim()),
      },
    ]);
  }
  if (!e.linkUrl && media === "none" && !e.isEditable && !e.selectionText.trim()) {
    groups.push([
      { kind: "item", label: _("Back"), shortcut: "Alt+Left", disabled: !cmd.canGoBack, run: cmd.back },
      { kind: "item", label: _("Forward"), shortcut: "Alt+Right", disabled: !cmd.canGoForward, run: cmd.forward },
      { kind: "item", label: _("Reload"), shortcut: "Ctrl+R", run: cmd.reload },
    ]);
    groups.push([
      { kind: "item", label: _("Select All"), shortcut: "Ctrl+A", run: run("select-all") },
      { kind: "item", label: _("Print…"), shortcut: "Ctrl+P", run: cmd.print },
    ]);
  }
  groups.push([{ kind: "item", label: _("Inspect"), run: run("inspect") }]);

  const items: Item[] = [];
  for (const group of groups.filter((g) => g.length > 0)) {
    if (items.length > 0) items.push({ kind: "separator" });
    items.push(...group);
  }
  return items;
}

/**
 * The page's right-click menu: the engine draws none, it says what was under
 * the click and does the browser's part of each item (`event.run`).
 */
export function BrowserPageMenu({
  event,
  commands,
  onClose,
}: {
  event: DomicileContextMenuEvent;
  commands: PageMenuCommands;
  onClose: () => void;
}) {
  const items = React.useMemo(() => buildPageMenuItems(event, commands), [event, commands]);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const [highlighted, setHighlighted] = React.useState(-1);
  const [position, setPosition] = React.useState({ left: event.x, top: event.y });
  // Opens down and right of the click, or flips where the page ends.
  React.useLayoutEffect(() => {
    const menu = menuRef.current;
    const box = menu?.offsetParent as HTMLElement | null;
    if (!menu || !box) return;
    const left = event.x + menu.offsetWidth > box.clientWidth ? event.x - menu.offsetWidth : event.x;
    const top = event.y + menu.offsetHeight > box.clientHeight ? event.y - menu.offsetHeight : event.y;
    setPosition({ left: Math.max(4, left), top: Math.max(4, top) });
  }, [event]);
  React.useEffect(() => {
    menuRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <>
      <div
        className="absolute inset-0 z-40"
        onPointerDown={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        ref={menuRef}
        role="menu"
        tabIndex={-1}
        data-slot="browser-page-menu"
        style={position}
        className={cn(MENU_POPUP_CLASS, "absolute z-50 min-w-52 outline-none")}
      >
        {items.map((item, i) =>
          item.kind === "separator" ? (
            <div key={i} role="separator" className={MENU_SEPARATOR_CLASS} />
          ) : (
            <div
              key={i}
              role="menuitem"
              aria-disabled={item.disabled || undefined}
              data-disabled={item.disabled ? "" : undefined}
              data-highlighted={i === highlighted && !item.disabled ? "" : undefined}
              onMouseEnter={() => setHighlighted(i)}
              onMouseLeave={() => setHighlighted(-1)}
              onClick={() => {
                if (item.disabled) return;
                onClose();
                item.run();
              }}
              className={MENU_ITEM_CLASS}
            >
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.shortcut && <span className={MENU_SHORTCUT_CLASS}>{item.shortcut}</span>}
            </div>
          )
        )}
      </div>
    </>
  );
}
