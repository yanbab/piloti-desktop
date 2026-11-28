/**
 * Keyboard shortcuts of the Web Browser, as GNOME Web and Chrome bind them.
 * The page's own chords reach the shell as `domicile-guest-keydown`, so the
 * same table serves both.
 */
export type BrowserCommand =
  | { kind: "focus-address" }
  | { kind: "new-tab" }
  | { kind: "new-window" }
  | { kind: "close-tab" }
  | { kind: "reopen-tab" }
  | { kind: "back" }
  | { kind: "forward" }
  | { kind: "reload" }
  | { kind: "find" }
  | { kind: "find-next" }
  | { kind: "find-previous" }
  | { kind: "zoom-in" }
  | { kind: "zoom-out" }
  | { kind: "zoom-reset" }
  | { kind: "next-tab" }
  | { kind: "previous-tab" }
  /** 0-based; -1 is the last tab. */
  | { kind: "select-tab"; index: number };

export interface ShortcutKey {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export function browserShortcut(e: ShortcutKey): BrowserCommand | null {
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.key === "F5" && !e.altKey) return { kind: "reload" };
  if (e.altKey && !mod && !e.shiftKey) {
    if (e.key === "ArrowLeft") return { kind: "back" };
    if (e.key === "ArrowRight") return { kind: "forward" };
    return null;
  }
  if (!mod || e.altKey) return null;
  // Tabs by position: the digit keys, wherever the layout puts the digits.
  const digit = /^Digit([1-9])$/.exec(e.code ?? "")?.[1] ?? (/^[1-9]$/.test(key) ? key : null);
  if (digit && !e.shiftKey) {
    const n = Number(digit);
    return { kind: "select-tab", index: n === 9 ? -1 : n - 1 };
  }
  if (e.key === "Tab") return { kind: e.shiftKey ? "previous-tab" : "next-tab" };
  if (e.key === "PageDown" && !e.shiftKey) return { kind: "next-tab" };
  if (e.key === "PageUp" && !e.shiftKey) return { kind: "previous-tab" };
  if (key === "+" || key === "=" || e.code === "NumpadAdd") return { kind: "zoom-in" };
  if (key === "-" || key === "_" || e.code === "NumpadSubtract") return { kind: "zoom-out" };
  if ((key === "0" || e.code === "Digit0" || e.code === "Numpad0") && !e.shiftKey) {
    return { kind: "zoom-reset" };
  }
  if (key === "r") return { kind: "reload" };
  if (key === "g") return { kind: e.shiftKey ? "find-previous" : "find-next" };
  if (key === "t") return { kind: e.shiftKey ? "reopen-tab" : "new-tab" };
  if (e.shiftKey) return null;
  if (key === "l") return { kind: "focus-address" };
  if (key === "f") return { kind: "find" };
  if (key === "w") return { kind: "close-tab" };
  if (key === "n") return { kind: "new-window" };
  return null;
}

/** The tab `command` moves to, from `ids` (in bar order) and the active id. */
export function browserTabTarget(
  command: BrowserCommand,
  ids: readonly string[],
  activeId: string | undefined
): string | null {
  if (ids.length < 2) return null;
  const at = activeId ? ids.indexOf(activeId) : -1;
  let next: number;
  if (command.kind === "next-tab") next = (at + 1) % ids.length;
  else if (command.kind === "previous-tab") next = (at - 1 + ids.length) % ids.length;
  else if (command.kind === "select-tab") {
    next = command.index < 0 ? ids.length - 1 : command.index;
    if (next >= ids.length) return null;
  } else return null;
  return ids[next] === activeId ? null : ids[next];
}
