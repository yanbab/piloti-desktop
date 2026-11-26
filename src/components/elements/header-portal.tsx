import * as React from "react";
import { createPortal } from "react-dom";

/**
 * Lets content deep inside an app put controls into its header bar: the header
 * holds a `HeaderBar.Outlet`, the content wraps controls in `HeaderBar.Portal`.
 * Both must be under one `HeaderPortalScope` (`AppSplitView` provides it).
 */
const HeaderPortalContext = React.createContext<{
  outlet: HTMLElement | null;
  setOutlet: (node: HTMLElement | null) => void;
} | null>(null);

export function HeaderPortalScope({ children }: { children: React.ReactNode }) {
  const [outlet, setOutlet] = React.useState<HTMLElement | null>(null);
  const value = React.useMemo(() => ({ outlet, setOutlet }), [outlet]);
  return <HeaderPortalContext.Provider value={value}>{children}</HeaderPortalContext.Provider>;
}

export function HeaderOutlet() {
  const scope = React.useContext(HeaderPortalContext);
  return (
    <div
      ref={scope?.setOutlet}
      data-slot="header-outlet"
      className="flex min-w-0 items-center gap-2 empty:hidden"
    />
  );
}

export function HeaderPortal({ children }: { children: React.ReactNode }) {
  const outlet = React.useContext(HeaderPortalContext)?.outlet;
  return outlet ? createPortal(children, outlet) : null;
}
