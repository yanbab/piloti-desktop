import * as React from "react";
import { parseWindowButtonLayout } from "@/ui/components/ui/window";

/**
 * Who draws a window's decorations around an app:
 * - `client`: the app's header bar is the titlebar (CSD);
 * - `server`: the shell draws a titlebar above the app (SSD), so a header bar
 *   is only a toolbar;
 * - `host`: the app runs in its own document and the shell lays the window
 *   controls over its header bar.
 */
export type Decorations = "client" | "server" | "host";

export interface AppChrome {
  appId: string;
  windowId?: string;
  decorations: Decorations;
  /**
   * The window menu button for one side of a header bar. It draws itself only
   * on the side opposite the window controls.
   */
  menu?: (side: "left" | "right") => React.ReactNode;
  /** `host` only: pixels to keep free for the shell's controls. */
  insets?: { left: number; right: number };
}

// Without a host, draw no decorations.
const AppChromeContext = React.createContext<AppChrome>({
  appId: "",
  decorations: "server",
});

/** Set by the host of an app. Memoise `value`: every header bar reads it. */
export const AppChromeProvider = AppChromeContext.Provider;

export function useAppChrome(): AppChrome {
  return React.useContext(AppChromeContext);
}

/**
 * Which window edges a header bar draws; a container narrows it. `inset` draws
 * both sides while sitting beside a collapsed sidebar.
 */
export type HeaderEdges = "both" | "start" | "end" | "none" | "inset";

export const HeaderEdgesContext = React.createContext<HeaderEdges>("both");

/**
 * Padding a `host` header keeps for the controls the shell lays over it: 24px
 * buttons 8px apart plus margins (see `AppModuleSurface`), else the usual 9px.
 */
export function hostControlInsets(buttonLayout?: string) {
  const { left, right } = parseWindowButtonLayout(buttonLayout);
  const inset = (count: number) => (count ? 14 + 32 * count : 9);
  return { left: inset(left.length), right: inset(right.length) };
}
