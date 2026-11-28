import { emitShellEvent } from "@/lib/core/shell-events";

/** Closes menus and popovers: a web page swallows the events that would. */
export function dismissOpenPopups() {
  emitShellEvent("piloti:dismiss-popups");
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })
  );
  document.body.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
    })
  );
}
