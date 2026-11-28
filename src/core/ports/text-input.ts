/**
 * Where the on-screen keyboard sends what it types.
 *
 * Today the shell's own text fields take it (`ui/shell/osk/dom-text-target.ts`).
 * Once Domicile exposes an input method to the shell (text-input-v3 for native
 * windows, the same for `<webview>` guests), a second target sends the same
 * calls to the focused window, and the keyboard itself does not change.
 */

/** The keys the on-screen keyboard presses, beyond text. */
export type TextInputKey =
  | "Backspace"
  | "Enter"
  | "Tab"
  | "Escape"
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "ArrowDown";

export interface TextInputTarget {
  /** Whether a text field takes input now. */
  available(): boolean;
  /** Insert text at the caret, replacing the selection. False when no field took it. */
  commitText(text: string): boolean;
  /** Press and release a key in the field. False when no field took it. */
  pressKey(key: TextInputKey): boolean;
  /** Calls `listener` when {@link available} may have changed; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}
