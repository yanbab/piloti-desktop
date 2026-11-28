/**
 * The on-screen keyboard: a panel the shell draws at the bottom of the screen.
 *
 * Domicile has no layer-shell, so wvkbd or squeekboard cannot show; the shell
 * draws the keyboard itself (simple-keyboard). A press never takes the
 * keyboard focus: `preventDefault()` on `pointerdown` keeps it in the field,
 * and Domicile then asks nothing of the focused window. Its presses don't
 * dismiss the open menu or Launcher either (`KEEPS_POPUPS_ATTRIBUTE`).
 *
 * It slides up and down like the Overview's workspaces strip (`ui/fx/slide.ts`).
 *
 * What it types goes to a `TextInputTarget`: the shell's own fields for now.
 */
import * as React from "react";
import Keyboard from "react-simple-keyboard";
import { _ } from "@/core/util/i18n";
import {
  OSK_INITIAL_STATE,
  OSK_LAYOUTS,
  oskLayoutFor,
  pressOskButton,
  type OskState,
} from "@/core/osk/osk-layouts";
import type { TextInputTarget } from "@/core/ports/text-input";
import { useDesktopSetting } from "@/ui/context/DesktopStateContext";
import { useKeymaps } from "@/ui/hooks/keyboard";
import { KEEPS_POPUPS_ATTRIBUTE } from "@/ui/hooks/popup-layer";
import { slideTransition, useSlideShown } from "@/ui/fx/slide";
import { createDomTextTarget } from "./dom-text-target";
import { hideOnScreenKeyboard } from "./osk-store";

function useAvailable(target: TextInputTarget): boolean {
  return React.useSyncExternalStore(
    (listener) => target.subscribe(() => queueMicrotask(listener)),
    () => target.available(),
    () => false,
  );
}

/** `open` false slides it out; the parent unmounts it after (`useSlidePresence`). */
export function OnScreenKeyboard({ open }: { open: boolean }) {
  const target = React.useMemo(() => createDomTextTarget(), []);
  const available = useAvailable(target);
  const keyboardLayout = useDesktopSetting("keyboardLayout");
  const { active } = useKeymaps();
  const layoutId = oskLayoutFor(keyboardLayout || active);
  const [state, setState] = React.useState<OskState>(OSK_INITIAL_STATE);
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const panelRef = React.useRef<HTMLDivElement>(null);
  const shown = useSlideShown(open);

  // Keep the focus where it is: in a shell field, or in a native window.
  React.useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const keep = (event: Event) => event.preventDefault();
    panel.addEventListener("pointerdown", keep, true);
    panel.addEventListener("mousedown", keep, true);
    return () => {
      panel.removeEventListener("pointerdown", keep, true);
      panel.removeEventListener("mousedown", keep, true);
    };
  }, []);

  const onKeyPress = React.useCallback(
    (button: string) => {
      const { state: next, output } = pressOskButton(stateRef.current, button, performance.now());
      stateRef.current = next;
      setState(next);
      if (!output) return;
      if (output.kind === "hide") hideOnScreenKeyboard();
      else if (output.kind === "text") target.commitText(output.text);
      else target.pressKey(output.key);
    },
    [target],
  );

  const display = React.useMemo(
    () => ({
      "{bksp}": "⌫",
      "{enter}": "⏎",
      "{shift}": "⇧",
      "{space}": _("space"),
      "{numbers}": "?123",
      "{abc}": layoutId === "fr" ? "AZE" : "ABC",
      "{tab}": "⇥",
      "{left}": "←",
      "{right}": "→",
      "{hide}": "⌨",
    }),
    [layoutId],
  );

  return (
    <div
      ref={panelRef}
      className="ui-osk"
      role="group"
      aria-label={_("On-Screen Keyboard")}
      data-caps-lock={state.capsLock || undefined}
      data-shown={shown || undefined}
      aria-hidden={!open || undefined}
      style={{ transition: slideTransition() }}
      {...{ [KEEPS_POPUPS_ATTRIBUTE]: "" }}
    >
      {!available && (
        <p className="ui-osk-hint">
          {_("Tap a text field in Piloti to type. Other applications can't receive this keyboard yet.")}
        </p>
      )}
      <Keyboard
        theme="ui-osk-keys"
        layout={OSK_LAYOUTS[layoutId]}
        layoutName={state.layer}
        display={display}
        onKeyPress={onKeyPress}
        preventMouseDownDefault
        disableCaretPositioning
        buttonTheme={[
          { class: "ui-osk-action", buttons: "{bksp} {enter} {shift} {numbers} {abc} {tab} {left} {right} {hide}" },
          { class: "ui-osk-space", buttons: "{space}" },
          { class: "ui-osk-wide", buttons: "{numbers} {abc} {tab} {hide}" },
          ...(state.layer === "shift" ? [{ class: "ui-osk-latched", buttons: "{shift}" }] : []),
        ]}
      />
    </div>
  );
}
