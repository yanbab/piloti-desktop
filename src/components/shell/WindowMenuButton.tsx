import * as React from "react";
import { countRender } from "@/lib/core/render-stats";
import { MoreVerticalIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useChromeSettings,
  useWindowActions,
  useWindowManagerSelector,
} from "@/context/DesktopStateContext";
import { _ } from "@/lib/core/i18n";
import {
  getWindowMenuItems,
  subscribeWindowPresentation,
} from "@/lib/shell/window-presentation";

export function isWindowControlsLeft(layout?: string): boolean {
  const raw = (layout ?? ":close").trim();
  return raw.indexOf(":") > 0 && !raw.startsWith(":");
}

export const WindowMenuButton = React.memo(function WindowMenuButton({
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
  countRender("WindowMenuButton");
  const { settings } = useChromeSettings();
  const { minimizeWindow, toggleMaximizeWindow, tileWindow, closeWindow } =
    useWindowActions();
  // Rendered in every app titlebar: only re-render when *this* window's
  // maximized state changes.
  const win = useWindowManagerSelector((wm) => {
    const found = windowId ? wm.windows.find((w) => w.id === windowId) : undefined;
    return found ? { maximized: found.maximized } : undefined;
  });
  const [open, setOpen] = React.useState(false);
  const pluginItems = React.useSyncExternalStore(
    subscribeWindowPresentation,
    getWindowMenuItems,
    getWindowMenuItems,
  );

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
        className="group/wmenu flex size-7 shrink-0 cursor-default items-center justify-center rounded-adw-control outline-none select-none active:bg-black/12 data-popup-open:bg-black/10 dark:active:bg-white/16 dark:data-popup-open:bg-white/14"
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
            {pluginItems
              .filter((item) => item.visible?.(windowId) ?? true)
              .map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  role="menuitemcheckbox"
                  aria-checked={item.checked?.(windowId) ?? false}
                  className="gap-3"
                  onClick={() => {
                    setOpen(false);
                    item.onSelect(windowId);
                  }}
                >
                  {item.label}
                  {item.checked?.(windowId) && (
                    <span aria-hidden className="ml-auto">✓</span>
                  )}
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => closeWindow(windowId)}>
              {_("Close")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
