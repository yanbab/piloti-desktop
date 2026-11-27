import * as React from "react";
import { AppChromeProvider, type AppChrome } from "@/components/elements/app-chrome";
import { HeaderBar } from "@/components/elements/header-bar";
import { WindowMenuButton } from "@/components/common/WindowMenuButton";

/** The app chrome of a window the shell hosts itself. */
export function WindowAppChrome({
  windowId,
  appId,
  isCsd,
  children,
}: {
  windowId: string;
  appId: string;
  isCsd: boolean;
  children: React.ReactNode;
}) {
  const chrome = React.useMemo<AppChrome>(
    () => ({
      appId,
      windowId,
      decorations: isCsd ? "client" : "server",
      // Under a server-side titlebar the menu button is up there already.
      menu: isCsd
        ? (side) => <WindowMenuButton side={side} windowId={windowId} />
        : undefined,
    }),
    [appId, windowId, isCsd],
  );
  return <AppChromeProvider value={chrome}>{children}</AppChromeProvider>;
}

/** The titlebar the shell draws for a window with server-side decorations. */
export function ShellTitlebar({
  windowId,
  appId,
  title,
}: {
  windowId: string;
  appId: string;
  title: string;
}) {
  return (
    <WindowAppChrome windowId={windowId} appId={appId} isCsd>
      <HeaderBar>
        <HeaderBar.Title>{title}</HeaderBar.Title>
      </HeaderBar>
    </WindowAppChrome>
  );
}
