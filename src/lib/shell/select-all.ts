import { emitShellEvent } from "@/lib/shell/shell-events";

/**
 * Select All (Edit menu and Ctrl/Cmd+A): a text field selects its text, an
 * editor its document; otherwise the view of the window (or the desktop)
 * answers `piloti:select-all` and selects its items.
 */

const TEXT_FIELD =
  'input:not([type="checkbox"], [type="radio"], [type="range"], [type="button"]), textarea:not(.xterm-helper-textarea), [contenteditable]:not([contenteditable="false"])';
const MENUS = '[role="menu"], [role="menubar"], [data-slot="menubar"], [data-slot="menubar-content"]';

/** What had focus before a menu took it. */
let lastFocused: Element | null = null;

function selectText(field: HTMLElement) {
  field.focus({ preventScroll: true });
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.select();
  else document.execCommand("selectAll");
}

function windowElement(windowId: string): HTMLElement | null {
  return document.querySelector(`[data-window-id="${CSS.escape(windowId)}"]`);
}

/** Select All in the window `windowId`, or on the desktop when `null`. */
export function selectAll(windowId: string | null) {
  const scope = windowId ? windowElement(windowId) : null;
  const focused = lastFocused?.isConnected ? lastFocused : null;
  const inScope = focused && (scope ? scope.contains(focused) : !focused.closest("[data-window-id]"));
  if (inScope && focused.matches(TEXT_FIELD)) {
    selectText(focused as HTMLElement);
    return;
  }
  if (!emitShellEvent("piloti:select-all", { windowId }, { cancelable: true })) return;
  const editor = scope?.querySelector<HTMLElement>(".cm-content, textarea:not(.xterm-helper-textarea)");
  if (editor) selectText(editor);
}

export function installSelectAll(focusedWindowId: () => string | null): () => void {
  const onFocus = (e: FocusEvent) => {
    const target = e.target as Element | null;
    if (target && !target.closest(MENUS)) lastFocused = target;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    if (e.key.toLowerCase() !== "a") return;
    const target = e.target instanceof Element ? e.target : null;
    // Text fields do it themselves; in a terminal Ctrl+A belongs to the shell.
    if (target?.matches(`${TEXT_FIELD}, .xterm-helper-textarea`)) return;
    const windowId = target?.closest("[data-desktop-icons-root]")
      ? null
      : (target?.closest("[data-window-id]")?.getAttribute("data-window-id") ??
        focusedWindowId());
    if (!emitShellEvent("piloti:select-all", { windowId }, { cancelable: true })) {
      e.preventDefault();
    }
  };
  document.addEventListener("focusin", onFocus, true);
  window.addEventListener("keydown", onKeyDown);
  return () => {
    document.removeEventListener("focusin", onFocus, true);
    window.removeEventListener("keydown", onKeyDown);
  };
}
