/**
 * The on-screen keyboard's target for the shell's own text fields: inputs,
 * text areas and editable elements in this document (Launcher, Folders, apps
 * that run in the shell).
 *
 * Text goes in through `execCommand("insertText")`, as typing would: React
 * sees an `input` event and the field's undo history keeps it. Keys are sent
 * as `keydown`/`keyup` first, so a field's own handlers (Enter in the
 * Launcher, arrows in a list) run; when none takes the key, the default is
 * done here.
 *
 * Native windows and `<webview>` guests are out of reach until Domicile
 * offers an input method to the shell (see `core/ports/text-input.ts`).
 */
import type { TextInputKey, TextInputTarget } from "@/core/ports/text-input";

const TEXT_INPUT_TYPES = new Set(["", "text", "search", "url", "email", "tel", "password", "number"]);

/** Whether `el` takes typed text. */
export function isEditableElement(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.has(el.type.toLowerCase()) && !el.readOnly && !el.disabled;
  }
  return el.isContentEditable;
}

/** The focused element, looking into open shadow roots. */
function deepActiveElement(doc: Document): Element | null {
  let el = doc.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
}

function isMultiline(el: HTMLElement): boolean {
  return el instanceof HTMLTextAreaElement || (!(el instanceof HTMLInputElement) && el.isContentEditable);
}

/** Moves the caret of an input or text area one character, collapsing a selection. */
function moveCaret(el: HTMLElement, by: -1 | 1): void {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    window.getSelection()?.modify?.("move", by < 0 ? "backward" : "forward", "character");
    return;
  }
  try {
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const at = start !== end ? (by < 0 ? start : end) : Math.max(0, Math.min(el.value.length, start + by));
    el.setSelectionRange(at, at);
  } catch {
    // Inputs of type number or email have no selection to move.
  }
}

function sendKey(el: HTMLElement, key: TextInputKey): boolean {
  const init: KeyboardEventInit = { key, code: key, bubbles: true, cancelable: true, composed: true };
  const handled = !el.dispatchEvent(new KeyboardEvent("keydown", init));
  el.dispatchEvent(new KeyboardEvent("keyup", init));
  return handled;
}

export function createDomTextTarget(doc: Document = document): TextInputTarget {
  const field = (): HTMLElement | null => {
    const el = deepActiveElement(doc);
    return isEditableElement(el) ? el : null;
  };

  return {
    available: () => field() !== null,

    commitText(text) {
      const el = field();
      if (!el) return false;
      if (!doc.execCommand("insertText", false, text) && el instanceof HTMLInputElement) {
        // Inputs without a selection API (number, email) refuse execCommand.
        el.value += text;
        el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      }
      return true;
    },

    pressKey(key) {
      const el = field();
      if (!el) return false;
      if (sendKey(el, key)) return true;
      switch (key) {
        case "Backspace":
          doc.execCommand("delete", false);
          break;
        case "Enter":
          if (isMultiline(el)) doc.execCommand("insertLineBreak", false) || doc.execCommand("insertText", false, "\n");
          else if (el instanceof HTMLInputElement) el.form?.requestSubmit();
          break;
        case "Tab":
          if (isMultiline(el)) doc.execCommand("insertText", false, "\t");
          break;
        case "ArrowLeft":
          moveCaret(el, -1);
          break;
        case "ArrowRight":
          moveCaret(el, 1);
          break;
        default:
          break;
      }
      return true;
    },

    subscribe(listener) {
      // A field may lose focus without a `focusout` (removed from the DOM), so
      // `focusin` on the next element also tells.
      doc.addEventListener("focusin", listener, true);
      doc.addEventListener("focusout", listener, true);
      return () => {
        doc.removeEventListener("focusin", listener, true);
        doc.removeEventListener("focusout", listener, true);
      };
    },
  };
}
