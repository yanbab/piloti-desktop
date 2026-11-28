/** `ShellHost` for an app running in the shell: its window manager, directly. */
import * as React from "react";
import { shellWindowsKey, type ShellHost, type ShellWindow } from "@/core/ports/shell-host";
import { toShellWindows } from "@/core/windows/shell-windows";
import { useWindowActions } from "@/ui/context/DesktopStateContext";
import { WindowManagerStoreContext } from "@/ui/context/windows/window-manager-store";

export function useShellHost(): ShellHost {
  const store = React.useContext(WindowManagerStoreContext);
  if (!store) throw new Error("useShellHost must be used within DesktopStateProvider");
  const { closeWindow, focusWindow } = useWindowActions();
  return React.useMemo<ShellHost>(
    () => ({
      watchWindows(listener) {
        let last = "";
        const check = () => {
          const windows: ShellWindow[] = toShellWindows(store.get().windows);
          const key = shellWindowsKey(windows);
          if (key === last) return;
          last = key;
          listener(windows);
        };
        check();
        return store.subscribe(check);
      },
      closeWindow,
      focusWindow,
    }),
    [store, closeWindow, focusWindow],
  );
}
