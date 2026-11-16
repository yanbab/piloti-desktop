import * as React from "react";

/**
 * Tracks whether the Alt modifier key is currently held globally,
 * enabling alternate menu actions (e.g., Quit -> Force Quit)
 * even dynamically while a context menu is already open.
 */
export function useAltKey(): boolean {
  const [altPressed, setAltPressed] = React.useState(false);

  React.useEffect(() => {
    const syncFromEvent = (e: KeyboardEvent | MouseEvent | PointerEvent) => {
      setAltPressed(Boolean(e.altKey));
    };
    const syncGuestKey = (e: Event) => {
      const detail = (e as CustomEvent<{ altKey?: boolean }>).detail;
      if (detail && typeof detail.altKey === "boolean") {
        setAltPressed(detail.altKey);
      }
    };
    const clear = () => setAltPressed(false);

    window.addEventListener("keydown", syncFromEvent, true);
    window.addEventListener("keyup", syncFromEvent, true);
    window.addEventListener("pointerdown", syncFromEvent, true);
    window.addEventListener("contextmenu", syncFromEvent, true);
    window.addEventListener("domicile-guest-keydown", syncGuestKey);
    window.addEventListener("blur", clear);

    return () => {
      window.removeEventListener("keydown", syncFromEvent, true);
      window.removeEventListener("keyup", syncFromEvent, true);
      window.removeEventListener("pointerdown", syncFromEvent, true);
      window.removeEventListener("contextmenu", syncFromEvent, true);
      window.removeEventListener("domicile-guest-keydown", syncGuestKey);
      window.removeEventListener("blur", clear);
    };
  }, []);

  return altPressed;
}

