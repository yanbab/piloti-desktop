import * as React from "react";
import { HeaderEdgesContext, useAppChrome } from "@/ui/components/elements/app-chrome";
import { HeaderPortalScope } from "@/ui/components/elements/header-portal";
import { AdwSplitView, type AdwSplitViewProps } from "@/ui/components/ui/adw-split-view";

export type { AdwSplitSidebarItem as SidebarItem } from "@/ui/components/ui/adw-split-view";

/**
 * `ui/adw-split-view` for apps: it takes the window from the app chrome, and a
 * `HeaderBar` given as `header` draws the right edge (the sidebar has the left
 * one, until it collapses to icons).
 */
export function AppSplitView({
  header,
  ...props
}: Omit<AdwSplitViewProps, "appId" | "windowId" | "isCsd">) {
  const { appId, windowId, decorations } = useAppChrome();
  return (
    <HeaderPortalScope>
      <AdwSplitView
        {...props}
        appId={appId}
        windowId={windowId}
        isCsd={decorations === "client"}
        header={(ctx) => (
          <HeaderEdgesContext.Provider value={ctx.sidebarCompact ? "inset" : "end"}>
            {typeof header === "function" ? header(ctx) : header}
          </HeaderEdgesContext.Provider>
        )}
      />
    </HeaderPortalScope>
  );
}
