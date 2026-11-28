/**
 * The on-screen keyboard's layouts and what each button does. Plain data and a
 * reducer, so the panel (`ui/shell/osk/`) only draws and forwards.
 *
 * Buttons in braces are actions; any other button types its own text.
 */
import type { TextInputKey } from "@/core/ports/text-input";

export type OskLayer = "default" | "shift" | "numbers";

export type OskLayout = Record<OskLayer, string[]>;

export type OskLayoutId = "fr" | "us";

const FR: OskLayout = {
  default: [
    "a z e r t y u i o p {bksp}",
    "q s d f g h j k l m {enter}",
    "{shift} w x c v b n é è à {shift}",
    "{numbers} , {space} . ' {hide}",
  ],
  shift: [
    "A Z E R T Y U I O P {bksp}",
    "Q S D F G H J K L M {enter}",
    "{shift} W X C V B N É È À {shift}",
    "{numbers} ; {space} : ! {hide}",
  ],
  numbers: [
    "1 2 3 4 5 6 7 8 9 0 {bksp}",
    "@ # € % & - + ( ) / {enter}",
    "{abc} ç ù ê â ô \" ? _ {abc}",
    "{tab} {left} {space} {right} {hide}",
  ],
};

const US: OskLayout = {
  default: [
    "q w e r t y u i o p {bksp}",
    "a s d f g h j k l ' {enter}",
    "{shift} z x c v b n m , . {shift}",
    "{numbers} - {space} ? {hide}",
  ],
  shift: [
    "Q W E R T Y U I O P {bksp}",
    "A S D F G H J K L \" {enter}",
    "{shift} Z X C V B N M ; : {shift}",
    "{numbers} _ {space} ! {hide}",
  ],
  numbers: [
    "1 2 3 4 5 6 7 8 9 0 {bksp}",
    "@ # $ % & - + ( ) / {enter}",
    "{abc} * = < > [ ] { } {abc}",
    "{tab} {left} {space} {right} {hide}",
  ],
};

export const OSK_LAYOUTS: Record<OskLayoutId, OskLayout> = { fr: FR, us: US };

/** The layout for a keymap name (`fr`, `fr(azerty)`, `us`…): AZERTY for French and Belgian, else QWERTY. */
export function oskLayoutFor(keymap: string | undefined): OskLayoutId {
  const base = (keymap ?? "").trim().toLowerCase();
  return /^(fr|be)\b/.test(base) || base.startsWith("french") ? "fr" : "us";
}

export interface OskState {
  layer: OskLayer;
  /** Shift stays on after a letter (a double tap of Shift). */
  capsLock: boolean;
  /** When Shift was last tapped, for the double tap. */
  shiftAt: number;
}

export const OSK_INITIAL_STATE: OskState = { layer: "default", capsLock: false, shiftAt: -Infinity };

/** The longest gap, in milliseconds, between two taps of Shift that lock it. */
export const OSK_DOUBLE_TAP_MS = 400;

export type OskOutput =
  | { kind: "text"; text: string }
  | { kind: "key"; key: TextInputKey }
  | { kind: "hide" }
  | null;

const KEYS: Record<string, TextInputKey> = {
  "{bksp}": "Backspace",
  "{enter}": "Enter",
  "{tab}": "Tab",
  "{esc}": "Escape",
  "{left}": "ArrowLeft",
  "{right}": "ArrowRight",
  "{up}": "ArrowUp",
  "{down}": "ArrowDown",
};

/** What pressing `button` does, at time `now` (milliseconds). */
export function pressOskButton(
  state: OskState,
  button: string,
  now: number,
): { state: OskState; output: OskOutput } {
  switch (button) {
    case "{shift}": {
      if (state.layer !== "shift") {
        return { state: { layer: "shift", capsLock: false, shiftAt: now }, output: null };
      }
      if (!state.capsLock && now - state.shiftAt <= OSK_DOUBLE_TAP_MS) {
        return { state: { ...state, capsLock: true, shiftAt: now }, output: null };
      }
      return { state: { layer: "default", capsLock: false, shiftAt: now }, output: null };
    }
    case "{numbers}":
      return { state: { ...state, layer: "numbers", capsLock: false }, output: null };
    case "{abc}":
      return { state: { ...state, layer: "default", capsLock: false }, output: null };
    case "{hide}":
      return { state, output: { kind: "hide" } };
    case "{space}":
      return { state: afterText(state), output: { kind: "text", text: " " } };
  }
  const key = KEYS[button];
  if (key) return { state, output: { kind: "key", key } };
  if (/^\{.*\}$/.test(button) && button.length > 2) return { state, output: null };
  return { state: afterText(state), output: { kind: "text", text: button } };
}

/** Shift lasts one character unless locked. */
function afterText(state: OskState): OskState {
  return state.layer === "shift" && !state.capsLock ? { ...state, layer: "default" } : state;
}
