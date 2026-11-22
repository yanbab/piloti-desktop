import * as React from "react";
import { MoreVerticalIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSettings, useWindowManager } from "@/context/DesktopStateContext";
import { _ } from "@/lib/core/i18n";

export function isWindowControlsLeft(layout?: string): boolean {
  const raw = (layout ?? ":close").trim();
  return raw.indexOf(":") > 0 && !raw.startsWith(":");
}

export function WindowMenuButton({
  windowId,
  side,
  extraItems,
}: {
  windowId?: string;
  side?: "left" | "right";
  appId?: string;
  iconUrl?: string;
  iconName?: string;
  gradient?: string;
  isWebApp?: boolean;
  extraItems?: React.ReactNode;
}) {
  const { settings } = useSettings();
  const {
    windows,
    minimizeWindow,
    toggleMaximizeWindow,
    tileWindow,
    closeWindow,
  } = useWindowManager();

  const win = windowId ? windows.find((w) => w.id === windowId) : undefined;
  const [open, setOpen] = React.useState(false);

  if (!settings.showWindowMenu) {
    return null;
  }
  if (side === "right") {
    return null;
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        if (nextOpen && eventDetails?.reason === "trigger-press") {
          return;
        }
        setOpen(nextOpen);
      }}
    >
      <DropdownMenuTrigger
        aria-label={_("Window menu")}
        onClick={() => setOpen((v) => !v)}
        className="group/wmenu flex size-7 shrink-0 cursor-default items-center justify-center rounded-md outline-none select-none active:bg-black/12 data-popup-open:bg-black/10 dark:active:bg-white/16 dark:data-popup-open:bg-white/14"
      >
        <MoreVerticalIcon className="size-4 opacity-75 group-hover/wmenu:opacity-100 group-active/wmenu:opacity-100 group-data-popup-open/wmenu:opacity-100" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {extraItems && (
          <>
            {extraItems}
            {windowId && <DropdownMenuSeparator />}
          </>
        )}
        {windowId && (
          <>
            <DropdownMenuItem onClick={() => minimizeWindow(windowId)}>
              {_("Minimize")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleMaximizeWindow(windowId)}>
              {win?.maximized ? _("Restore") : _("Maximize")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => tileWindow(windowId, "left")}>
              {_("Tile Left")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => tileWindow(windowId, "right")}>
              {_("Tile Right")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => closeWindow(windowId)}>
              {_("Close")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
