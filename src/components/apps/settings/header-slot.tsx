import * as React from "react";
import { createPortal } from "react-dom";

/**
 * Lets a Settings pane put controls on the right of the Settings headerbar
 * (search, a view switcher…): `<SettingsHeaderActions>` portals into the slot.
 */
export const SettingsHeaderSlot = React.createContext<HTMLElement | null>(null);

export function SettingsHeaderActions({ children }: { children: React.ReactNode }) {
  const slot = React.useContext(SettingsHeaderSlot);
  return slot ? createPortal(children, slot) : null;
}
