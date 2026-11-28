import * as React from "react";
import { getEngine } from "@/core/ports/engine";
import type { Piloti } from "@/platform/shared/piloti";
import { runPowerAction } from "@/platform/shared/system-commands";
import type { Notify } from "@/core/ports/capture";
import { clearXdgSession } from "@/core/xdg/xdg-session-management";
import type { SettingsContextValue } from "@/ui/context/SettingsContext";

export type PowerAction = "logout" | "restart" | "poweroff";

interface PowerHost {
  piloti: Piloti;
  settings: SettingsContextValue["settings"];
  updateSettings: SettingsContextValue["updateSettings"];
  lockSession: () => void;
  /** The demo comes back from a power cycle locked. */
  setBrowserLocked: (locked: boolean) => void;
  pushNotification: (n: Parameters<Notify>[0] & { urgency?: string }) => void;
}

/** The power dialog, and ending the session (simulated in the demo). */
export function usePower({
  piloti,
  settings,
  updateSettings,
  lockSession,
  setBrowserLocked,
  pushNotification,
}: PowerHost) {
  const { systemServices } = getEngine().capabilities;
  const [pendingPowerAction, setPendingPowerAction] =
    React.useState<PowerAction | null>(null);
  const [sessionExiting, setSessionExiting] = React.useState(false);
  const [webPowerPhase, setWebPowerPhase] = React.useState<
    "active" | "restarting" | "powered-off"
  >("active");

  const powerOnSimulatedMachine = React.useCallback(() => {
    setWebPowerPhase("restarting");
    window.setTimeout(() => {
      setWebPowerPhase("active");
      setBrowserLocked(true);
    }, 850);
  }, [setBrowserLocked]);

  const requestPowerAction = React.useCallback((action: PowerAction) => {
    console.info("[Piloti] power-dialog: open", action);
    setPendingPowerAction(action);
  }, []);

  const cancelPowerAction = React.useCallback(() => {
    console.info("[Piloti] power-dialog: cancel");
    setPendingPowerAction(null);
  }, []);

  const executePowerAction = React.useCallback(
    async (action: PowerAction, restoreWindows?: boolean) => {
      console.info("[Piloti] power-action:", action, {
        restoreWindows: restoreWindows ?? settings.restoreWindowsOnLogin,
      });
      setPendingPowerAction(null);

      if (typeof restoreWindows === "boolean") {
        updateSettings({ restoreWindowsOnLogin: restoreWindows });
        if (!restoreWindows) {
          clearXdgSession();
        }
      } else if (!settings.restoreWindowsOnLogin) {
        clearXdgSession();
      }

      const labels: Record<PowerAction, string> = {
        logout: "Log Out",
        restart: "Restart",
        poweroff: "Turn Off",
      };

      if (!systemServices) {
        setSessionExiting(true);
        await new Promise((resolve) => window.setTimeout(resolve, 180));
        if (action === "logout") {
          lockSession();
          setSessionExiting(false);
        } else if (action === "restart") {
          setWebPowerPhase("restarting");
          setSessionExiting(false);
          await new Promise((resolve) => window.setTimeout(resolve, 950));
          setWebPowerPhase("active");
          lockSession();
        } else {
          setWebPowerPhase("powered-off");
          setSessionExiting(false);
        }
        return;
      }

      setSessionExiting(true);
      await new Promise((resolve) => window.setTimeout(resolve, 180));

      try {
        const res = await runPowerAction(piloti, action);
        res.match({
          Ok: (ran) => {
            if (ran.code !== 0) {
              setSessionExiting(false);
              pushNotification({
                appName: "Piloti Session",
                summary: `${labels[action]} Failed`,
                body: ran.stderr?.trim() || `Exited with status ${ran.code}`,
                urgency: "critical",
              });
            }
          },
          Err: (err) => {
            setSessionExiting(false);
            pushNotification({
              appName: "Piloti Session",
              summary: `${labels[action]} Failed`,
              body: String(err),
              urgency: "critical",
            });
          },
        });
      } catch (err) {
        setSessionExiting(false);
        pushNotification({
          appName: "Piloti Session",
          summary: `${labels[action]} Failed`,
          body: err instanceof Error ? err.message : String(err),
          urgency: "critical",
        });
      }
    },
    [
      piloti,
      systemServices,
      lockSession,
      pushNotification,
      settings.restoreWindowsOnLogin,
      updateSettings,
    ]
  );

  const confirmPowerAction = React.useCallback(
    async (restoreWindows?: boolean) => {
      const action = pendingPowerAction;
      if (!action) return;
      await executePowerAction(action, restoreWindows);
    },
    [executePowerAction, pendingPowerAction]
  );

  return React.useMemo(
    () => ({
      sessionExiting,
      webPowerPhase,
      powerOnSimulatedMachine,
      pendingPowerAction,
      requestPowerAction,
      cancelPowerAction,
      confirmPowerAction,
      executePowerAction,
    }),
    [
      sessionExiting,
      webPowerPhase,
      powerOnSimulatedMachine,
      pendingPowerAction,
      requestPowerAction,
      cancelPowerAction,
      confirmPowerAction,
      executePowerAction,
    ],
  );
}
