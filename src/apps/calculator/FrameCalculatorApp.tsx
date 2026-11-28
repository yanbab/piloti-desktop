/** The Calculator in its own iframe (the browser demo's separate windows). */
import * as React from "react";
import { CalculatorApp } from "@/apps/calculator/CalculatorApp";
import type { CalculatorHost } from "@/apps/calculator/host";
import { useIsolatedAppBridge } from "@/lib/engine/app-bridge";
import { createShellAppHost } from "@/lib/engine/app-shell-host";
import { usePiloti } from "@/lib/engine/piloti";

export const FrameCalculatorApp = ({ windowId, isCsd }: { windowId: string; isCsd: boolean }) => {
  const piloti = usePiloti();
  const actions = React.useRef<(actionId: string) => void>(() => {});
  const bridge = useIsolatedAppBridge(windowId, isCsd, (id) => actions.current(id));
  const bridgeRef = React.useRef(bridge);
  bridgeRef.current = bridge;

  const host = React.useMemo<CalculatorHost>(() => {
    const app = createShellAppHost(piloti);
    return {
      readState: app.readState,
      writeState: app.writeState,
      close: () => bridgeRef.current.closeWindow(),
      resize: (_id, { width, height }) => bridgeRef.current.resizeWindow(width, height),
      onMenuAction: (_id, listener) => {
        actions.current = listener;
        return () => void (actions.current = () => {});
      },
    };
  }, [piloti]);

  return <CalculatorApp windowId={windowId} host={host} />;
};
