import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSettings, useSystemBackends } from "@/context/DesktopStateContext";
import { _ } from "@/lib/i18n";

const AUTO_CONFIRM_SECONDS = 60;

/**
 * Menu-styled centered confirmation dialog for Log Out, Restart, and Turn Off
 * built from standard Dialog, Switch, and Button primitives.
 */
export function PowerActionDialog() {
  const { settings, updateSettings } = useSettings();
  const { pendingPowerAction, cancelPowerAction, confirmPowerAction } =
    useSystemBackends();

  const lastPowerActionRef = React.useRef<"logout" | "restart" | "poweroff">(
    "logout"
  );
  if (pendingPowerAction !== null) {
    lastPowerActionRef.current = pendingPowerAction;
  }
  const activePowerAction = pendingPowerAction ?? lastPowerActionRef.current;

  const [secondsLeft, setSecondsLeft] = React.useState(AUTO_CONFIRM_SECONDS);
  const restoreRef = React.useRef(settings.restoreWindowsOnLogin);
  restoreRef.current = settings.restoreWindowsOnLogin;

  React.useEffect(() => {
    if (pendingPowerAction === null) {
      setSecondsLeft(AUTO_CONFIRM_SECONDS);
      return;
    }
    setSecondsLeft(AUTO_CONFIRM_SECONDS);

    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          void confirmPowerAction(restoreRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [confirmPowerAction, pendingPowerAction]);

  const title =
    activePowerAction === "logout"
      ? _("Log Out")
      : activePowerAction === "restart"
        ? _("Restart")
        : _("Turn Off");

  const unit = secondsLeft === 1 ? _("second") : _("seconds");
  const description =
    activePowerAction === "logout"
      ? _("The session will log out automatically in %d %s.", secondsLeft, unit)
      : activePowerAction === "restart"
        ? _("This computer will restart automatically in %d %s.", secondsLeft, unit)
        : _("This computer will turn off automatically in %d %s.", secondsLeft, unit);

  return (
    <Dialog
      open={pendingPowerAction !== null}
      onOpenChange={(open) => {
        if (!open) cancelPowerAction();
      }}
    >
      <DialogContent
        variant="menu"
        showCloseButton={false}
        className="w-[312px] max-w-[calc(100vw-2rem)] p-4 text-center"
      >
        <DialogHeader className="items-center gap-1.5 px-2 pt-1 pb-2 text-center">
          <DialogTitle className="text-[16px] font-bold tracking-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="text-adw-body leading-snug tabular-nums">
            {description}
          </DialogDescription>
        </DialogHeader>

        <label className="flex cursor-default items-center justify-center gap-2.5 rounded-adw-item px-2.5 py-2.5 select-none">
          <Checkbox
            aria-label={_("Restore open windows")}
            checked={settings.restoreWindowsOnLogin}
            onCheckedChange={(checked) =>
              updateSettings({ restoreWindowsOnLogin: Boolean(checked) })
            }
          />
          <span className="text-[13px] font-normal text-adw-label">
            {_("Restore open windows")}
          </span>
        </label>

        <DialogFooter className="grid grid-cols-2 gap-2 pt-2 sm:justify-stretch">
          <Button
            type="button"
            variant="secondary"
            size="default"
            className="h-9 w-full rounded-md font-semibold"
            onClick={() => cancelPowerAction()}
          >
            {_("Cancel")}
          </Button>
          <Button
            type="button"
            variant={
              activePowerAction === "poweroff" ? "destructive" : "default"
            }
            size="default"
            autoFocus
            className="h-9 w-full rounded-md font-semibold"
            onClick={() =>
              void confirmPowerAction(settings.restoreWindowsOnLogin)
            }
          >
            {title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
