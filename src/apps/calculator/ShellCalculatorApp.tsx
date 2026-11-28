/** The Calculator in a shell window. */
import * as React from "react";
import { CalculatorApp } from "@/apps/calculator/CalculatorApp";
import type { CalculatorHost } from "@/apps/calculator/host";
import { isCloseOnLeft } from "@/components/ui/window";
import {
  useDesktopSetting,
  useWindowActions,
  useWindowManagerSelector,
} from "@/context/DesktopStateContext";
import { onAppAction, publishWindowMenuState } from "@/lib/engine/app-bridge";
import { createShellAppHost } from "@/lib/engine/app-shell-host";
import { usePiloti } from "@/lib/engine/piloti";
import { readVfsStateJson, VFS_STATE_PATHS } from "@/lib/engine/vfs-state";

export const ShellCalculatorApp = ({ windowId = "" }: { windowId?: string }) => {
  const piloti = usePiloti();
  const { updateWindowGeometry } = useWindowActions();
  // Standalone, there is no window to focus: it always listens.
  const focused = useWindowManagerSelector((wm) => !windowId || wm.focusedWindowId === windowId);
  const closeOnLeft = isCloseOnLeft(useDesktopSetting("windowButtonLayout"));

  const host = React.useMemo<CalculatorHost>(() => {
    const app = createShellAppHost(piloti);
    return {
      // Carries over what was kept in localStorage before.
      readState: (_key, isValid) =>
        readVfsStateJson(VFS_STATE_PATHS.calculator, "piloti.calculator.state.v1", isValid),
      writeState: app.writeState,
      close: app.close,
      resize: (id, size) => updateWindowGeometry(id, { size }),
      publishMenu: publishWindowMenuState,
      onMenuAction: onAppAction,
    };
  }, [piloti, updateWindowGeometry]);

  return (
    <CalculatorApp windowId={windowId} host={host} focused={focused} closeOnLeft={closeOnLeft} />
  );
};
